# Verifica Peru — Bot de WhatsApp

Bot que atiende automaticamente, por WhatsApp Business API, los 4 servicios
de verificacion de **Verifica Peru** (Huaraz):

1. Verificacion de autos usados antes de comprarlos
2. Verificacion de contratos de alquiler antes de firmarlos
3. Verificacion de papeletas y multas de transito pendientes
4. Verificacion de riesgo tributario ante SUNAT para independientes

Cada servicio cuesta S/ 20. El bot lleva toda la conversacion: saluda,
pregunta que servicio necesitas, recolecta los datos uno por uno, genera un
codigo de pago unico, espera tu confirmacion de pago, genera la
verificacion y entrega un resumen en espanol con hallazgos, riesgos y una
recomendacion final.

## Como esta armado

```
src/
  index.js                  Servidor Express + webhook de WhatsApp
  config.js                 Lee todas las variables de entorno (.env)
  db.js                     SQLite (better-sqlite3), crea las tablas
  whatsapp.js                Cliente de WhatsApp Cloud API (enviar texto, descargar fotos)
  payments.js                Genera codigos de pago (VP-XXXXXX) y su estado
  conversation/
    stateMachine.js          El flujo completo de conversacion (maquina de estados)
    store.js                 Guarda/lee el estado de cada cliente en SQLite
    messages.js               Textos fijos (bienvenida, ayuda, etc.)
    validators.js             Valida placa, RUC, año, brevete
  services/
    index.js                  Define los 4 servicios: preguntas y orden
    autos.js / alquiler.js / papeletas.js / tributario.js   Logica de cada verificacion
  providers/
    sunarp.js / sunat.js / papeletas.js  Adaptadores a proveedores externos de datos
    claude.js                  (Opcional) usa Claude para leer fotos de contratos
                                y redactar los resumenes finales en espanol
```

Todo el estado de cada conversacion y cada pedido se guarda en un archivo
SQLite (`data/verifica_peru.db` por defecto), asi que el bot recuerda en
que paso quedo cada cliente aunque el servidor se reinicie.

## Flujo de conversacion

1. Primer mensaje del cliente → el bot saluda y muestra las 4 opciones.
2. El cliente responde 1, 2, 3 o 4 → el bot confirma y empieza a preguntar
   los datos de ese servicio, uno por uno (espera la respuesta de cada
   pregunta antes de pasar a la siguiente):
   - **Autos usados**: placa, marca, modelo, año.
   - **Contrato de alquiler**: foto o texto del contrato completo.
   - **Papeletas**: numero de brevete y placa.
   - **Riesgo tributario**: RUC y si tiene boletas/facturas pendientes de declarar.
3. Con todos los datos, el bot dice *"listo, ya tengo todo lo que necesito
   para hacer tu verificacion"*, genera un **codigo de pago unico**
   (ej. `VP-4F7K2A`) y pide el deposito/transferencia usando ese codigo
   como referencia.
4. El bot espera a que el cliente escriba algo como *"ya pague"* (o envie
   una captura de pago).
5. Segun `REQUIRE_MANUAL_PAYMENT_CONFIRMATION` (ver mas abajo), el bot
   genera la verificacion automaticamente, o te avisa a ti por WhatsApp
   para que confirmes el deposito con un solo comando.
6. El bot entrega el resultado: un resumen en espanol con hallazgos,
   riesgos y una recomendacion final (¿es seguro proceder o no?).
7. Si alguna fuente no esta disponible, el bot lo dice honestamente y
   ofrece **reembolso** o una **segunda revision gratis**, sin necesidad
   de que intervengas.

Comandos que el cliente puede usar en cualquier momento: `menu`, `ayuda`,
`cancelar`.

## Sobre la confirmacion de pago (importante)

WhatsApp/Yape/Plin/transferencias bancarias **no le dan al bot ninguna
forma automatica de saber si un deposito realmente llego** (eso requeriria
integrar una pasarela de pago como Culqi, Izipay o Mercado Pago, que no
pediste). Por eso el bot ofrece dos modos, controlados por la variable
`REQUIRE_MANUAL_PAYMENT_CONFIRMATION` en tu `.env`:

- **`true` (recomendado, valor por defecto):** cuando el cliente dice "ya
  pague", el bot te escribe a **tu numero personal** (el que pongas en
  `ADMIN_WHATSAPP_NUMBERS`, distinto al numero del negocio) con el codigo
  del pedido. Tu solo respondes `CONFIRMAR VP-XXXXXX` (revisando tu Yape o
  tu banco) y el bot continua automaticamente y entrega el resultado al
  cliente. Si el pago no aparece, respondes `RECHAZAR VP-XXXXXX` y el bot
  le avisa al cliente para que revise. Este es el unico paso donde
  intervienes, y es opcional segun el nivel de riesgo de fraude que
  quieras asumir.
- **`false`:** el bot confia en la palabra del cliente y entrega el
  resultado apenas dice "ya pague", sin que tengas que hacer nada. Mas
  rapido para el cliente, pero sin ningun control de que el pago realmente
  llego.

Comandos disponibles desde tu numero de administrador:
`CONFIRMAR <codigo>`, `RECHAZAR <codigo>`, `ESTADO <codigo>`.

## Sobre las fuentes de verificacion (importante, leelo)

Pediste que el bot use "busqueda web o las APIs publicas correspondientes"
(SUNARP, SAT/municipalidades, SUNAT). En la practica:

- **SUNAT (RUC):** SUNAT si publica el estado de un RUC (activo/de baja,
  habido/no habido, actividad economica) y hay proveedores peruanos que lo
  revenden por API. **No existe** forma de que un tercero consulte tu
  deuda tributaria privada o tus declaraciones sin tu clave SOL — eso es
  confidencial por ley. El bot deja esto explicito en cada reporte.
- **SUNARP (vehiculos):** SUNARP no tiene una API publica gratuita para
  terceros; existen proveedores peruanos (de pago) que revenden estos
  datos. Necesitas contratar uno y poner su URL/token en `.env`.
- **Papeletas de transito:** cada municipalidad (SAT Lima, SAT de otras
  provincias, etc.) tiene su propio sistema; no hay una API nacional
  unica. Tambien se necesita un proveedor que agregue estas fuentes.

Por eso el bot usa **adaptadores configurables** (`src/providers/`): tu
consigues el acceso a un proveedor de datos peruano (igual que conseguiste
el token de WhatsApp) y lo pones en el `.env`. Mientras no lo configures,
el bot **no inventa resultados**: le dice honestamente al cliente que no
pudo verificar esa fuente y le ofrece reembolso o una revision gratis,
tal como pediste.

- **Contrato de alquiler:** este servicio no depende de una API externa.
  Si configuras `ANTHROPIC_API_KEY` (API de Claude), el bot puede **leer
  fotos del contrato** y hacer un analisis legal completo. Sin esa clave,
  el bot igual funciona con texto (pidiendole al cliente que copie y pegue
  el contrato) usando una lista de verificacion de clausulas clave del
  arrendamiento en Peru.

## Configuracion (.env)

Copia `.env.example` a `.env` y completa:

1. **WhatsApp Cloud API** (los consigues tu en developers.facebook.com,
   con la cuenta de WhatsApp Business de Verifica Peru):
   - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_VERIFY_TOKEN`: un texto que tu inventas (ponlo tambien al
     configurar el webhook en Meta)
   - `WHATSAPP_APP_SECRET`: recomendado, para verificar que los mensajes
     realmente vienen de Meta.
2. **Tu numero personal como administrador**: `ADMIN_WHATSAPP_NUMBERS`
3. **Datos de pago** que se le muestran al cliente: Yape, Plin y/o cuenta
   bancaria.
4. **(Opcional) `ANTHROPIC_API_KEY`**: para leer fotos de contratos y
   redactar los resumenes con mejor calidad.
5. **(Opcional) Proveedores de datos**: `VEHICULO_API_URL/KEY`,
   `RUC_API_URL/KEY`, `PAPELETAS_API_URL/KEY`.

## Instalar y correr

```bash
npm install
cp .env.example .env
# completa tus credenciales en .env
npm start
```

El servidor escucha en `PORT` (3000 por defecto) y expone:

- `GET /webhook` — verificacion del webhook (Meta la llama al configurarlo)
- `POST /webhook` — recibe los mensajes de WhatsApp

Para que Meta pueda llamar a tu webhook necesitas exponerlo con una URL
publica con HTTPS (por ejemplo desplegando el servidor en un hosting como
Render, Railway, Fly.io, un VPS con Nginx + certificado SSL, etc.). En
Meta for Developers, en la configuracion del webhook de WhatsApp, pon esa
URL + `/webhook` y el mismo valor de `WHATSAPP_VERIFY_TOKEN`, y suscribete
al campo `messages`.

## Base de datos

SQLite en `data/verifica_peru.db` (se crea sola). Tablas:

- `orders`: cada pedido — telefono, servicio, codigo de pago, estado del
  pago, y el resultado entregado.
- `conversations`: en que paso de la conversacion esta cada telefono.
- `processed_messages`: evita procesar dos veces el mismo mensaje si
  WhatsApp lo reintenta.

Puedes abrir el archivo con cualquier cliente SQLite (por ejemplo
`sqlite3 data/verifica_peru.db`) para revisar pedidos manualmente.

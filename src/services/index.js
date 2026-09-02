const validators = require('../conversation/validators');
const autos = require('./autos');
const alquiler = require('./alquiler');
const tributario = require('./tributario');
// El servicio de papeletas (./papeletas) esta pausado por ahora: no hay un
// proveedor de datos confiable conectado todavia. El codigo se queda listo
// para cuando se agregue, solo hay que volver a incluirlo aqui abajo.

const SERVICES = {
  '1': {
    key: 'autos',
    menuLabel: '1. Verificacion de auto usado antes de comprarlo',
    name: 'verificacion de auto usado',
    confirmMsg: 'Perfecto, vamos a verificar el auto antes de que lo compres. Te voy a pedir unos datos.',
    fields: [
      { key: 'placa', prompt: '¿Cual es la placa del vehiculo? (Ejemplo: ABC-123)', validate: validators.placa },
      { key: 'marca', prompt: '¿Cual es la marca del vehiculo? (Ejemplo: Toyota)', validate: validators.notEmpty },
      { key: 'modelo', prompt: '¿Cual es el modelo? (Ejemplo: Corolla)', validate: validators.notEmpty },
      { key: 'anio', prompt: '¿De que año es el vehiculo? (Ejemplo: 2018)', validate: validators.year },
    ],
    run: autos.run,
  },
  '2': {
    key: 'alquiler',
    menuLabel: '2. Verificacion de contrato de alquiler antes de firmarlo',
    name: 'verificacion de contrato de alquiler',
    confirmMsg: 'Perfecto, vamos a revisar el contrato antes de que lo firmes.',
    fields: [
      {
        key: 'contrato',
        prompt: 'Envíame el contrato completo. Puedes mandarlo como foto (bien enfocada, que se lea todo) o como texto copiado y pegado aqui mismo.',
        acceptMedia: true,
      },
    ],
    run: alquiler.run,
  },
  '3': {
    key: 'tributario',
    menuLabel: '3. Verificacion de riesgo tributario ante SUNAT (independientes)',
    name: 'verificacion de riesgo tributario SUNAT',
    confirmMsg: 'Perfecto, vamos a revisar tu situacion tributaria basica.',
    fields: [
      { key: 'ruc', prompt: '¿Cual es tu numero de RUC?', validate: validators.ruc },
      {
        key: 'pendientes',
        prompt: '¿Tienes boletas o facturas pendientes de declarar? Responde "si" o "no", y si puedes cuentame brevemente cuantas o desde cuando.',
        validate: validators.notEmpty,
      },
    ],
    run: tributario.run,
  },
};

function byChoice(text) {
  const t = (text || '').trim().toLowerCase();
  if (SERVICES[t]) return SERVICES[t];
  const match = Object.values(SERVICES).find((s) => t.includes(s.key) || t.includes(s.name.replace('verificacion de ', '')));
  return match || null;
}

function byKey(key) {
  return Object.values(SERVICES).find((s) => s.key === key) || null;
}

module.exports = { SERVICES, byChoice, byKey };

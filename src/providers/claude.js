const axios = require('axios');
const config = require('./../config');

function isEnabled() {
  return Boolean(config.anthropic.apiKey);
}

async function callClaude({ system, messages, maxTokens = 1200 }) {
  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: config.anthropic.model,
      max_tokens: maxTokens,
      system,
      messages,
    },
    {
      headers: {
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 60000,
    }
  );
  const blocks = res.data.content || [];
  return blocks.map((b) => b.text || '').join('\n').trim();
}

// Analiza el texto (o una foto en base64) de un contrato de alquiler peruano
// y devuelve una evaluacion de riesgos en espanol, lista para enviar al cliente.
async function analizarContrato({ texto, imagenBase64, imagenMediaType }) {
  const system = `Eres un abogado peruano especializado en arrendamiento de inmuebles.
Analizas contratos de alquiler para inquilinos y propietarios antes de que firmen.
Revisa: identificacion completa de las partes (DNI/RUC), direccion exacta del
inmueble, monto de la renta y moneda, plazo y fecha de inicio/fin, garantia o
deposito y condiciones de devolucion, penalidades por mora, clausula de
resolucion o desalojo (incluida la clausula de allanamiento a futuro desalojo
notarial de la Ley 30201, si existe), prohibicion o permiso de subarrendar,
servicios incluidos/excluidos, y si esta firmado y con fecha.
Responde SIEMPRE en espanol de Peru, en un tono claro y directo, con este
formato exacto:

HALLAZGOS:
- (lista breve de lo que si encontraste en el contrato)

RIESGOS:
- (lista breve de clausulas ausentes, ambiguas o desfavorables; si no hay
  riesgos relevantes, dilo explicitamente)

RECOMENDACION:
(un parrafo corto diciendo si es razonablemente seguro firmar, si conviene
firmar con cambios, o si no conviene firmar, y por que)`;

  const content = [];
  if (texto) {
    content.push({ type: 'text', text: `Contrato (texto):\n\n${texto}` });
  }
  if (imagenBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: imagenMediaType || 'image/jpeg', data: imagenBase64 },
    });
    content.push({ type: 'text', text: 'Este es el contrato en foto. Léelo y analízalo con el mismo formato.' });
  }

  return callClaude({ system, messages: [{ role: 'user', content }], maxTokens: 1200 });
}

// Redacta el resumen final en espanol para cualquiera de los 4 servicios,
// a partir de hallazgos estructurados (datos crudos de las APIs/consultas).
async function redactarResumen({ servicio, hallazgos }) {
  const system = `Eres un asistente de "Verifica Peru", un servicio que ayuda a
personas comunes en Peru a verificar autos usados, contratos de alquiler,
papeletas de transito y riesgo tributario ante SUNAT antes de tomar decisiones
de dinero. Con la informacion cruda que te paso, redacta en espanol de Peru
un resumen corto, claro y sin tecnicismos innecesarios, con esta estructura:

RESUMEN:
(2-3 frases explicando que se encontro)

RIESGOS ENCONTRADOS:
- (lista breve; si no hay riesgos, dilo)

RECOMENDACION FINAL:
(una frase clara: "es seguro proceder", "procede con precaucion porque...",
o "no es seguro proceder porque...")

Nunca inventes datos que no esten en la informacion que te doy.`;

  const message = `Servicio: ${servicio}\n\nInformacion encontrada (JSON):\n${JSON.stringify(hallazgos, null, 2)}`;

  return callClaude({
    system,
    messages: [{ role: 'user', content: [{ type: 'text', text: message }] }],
    maxTokens: 800,
  });
}

module.exports = { isEnabled, analizarContrato, redactarResumen };

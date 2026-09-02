const config = require('../config');
const { fetchFromProvider } = require('./httpProvider');

// Consulta del estado PUBLICO de un RUC en SUNAT (razon social, estado,
// condicion, actividad economica) via el proveedor externo configurado en
// RUC_API_URL / RUC_API_KEY. Importante: esto NO accede a la clave SOL del
// contribuyente ni a su informacion tributaria privada (deudas, declaraciones),
// porque esa informacion es confidencial y solo el propio titular del RUC
// puede consultarla con sus credenciales. Este servicio solo verifica lo
// que SUNAT publica de forma abierta.
async function consultarRuc(ruc) {
  return fetchFromProvider(
    { baseUrl: config.providers.ruc.url, apiKey: config.providers.ruc.key },
    '/sunat/ruc',
    { ruc }
  );
}

module.exports = { consultarRuc };

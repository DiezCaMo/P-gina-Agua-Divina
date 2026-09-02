const axios = require('axios');
const config = require('../config');

// Consulta del estado PUBLICO de un RUC en SUNAT (razon social, estado,
// condicion de domicilio) via ApiInti (https://apiinti.dev), configurado en
// RUC_API_URL / RUC_API_KEY. Importante: esto NO accede a la clave SOL del
// contribuyente ni a su informacion tributaria privada (deudas, declaraciones),
// porque esa informacion es confidencial y solo el propio titular del RUC
// puede consultarla con sus credenciales. Este servicio solo verifica lo
// que SUNAT publica de forma abierta.
async function consultarRuc(ruc) {
  const { url, key } = config.providers.ruc;
  if (!url || !key) {
    return { available: false, reason: 'sin_configurar' };
  }

  try {
    const res = await axios.get(`${url}/ruc/${ruc}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      timeout: 15000,
    });

    if (!res.data || res.data.success !== true || !res.data.data) {
      return { available: false, reason: 'respuesta_invalida' };
    }

    return { available: true, data: res.data.data };
  } catch (err) {
    return {
      available: false,
      reason: 'error_proveedor',
      detail: err.response ? `HTTP ${err.response.status}` : err.message,
    };
  }
}

module.exports = { consultarRuc };

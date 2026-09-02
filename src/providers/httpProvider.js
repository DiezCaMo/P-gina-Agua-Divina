const axios = require('axios');

/**
 * Adaptador HTTP generico para proveedores peruanos de datos publicos
 * (SUNARP/vehicular, SUNAT/RUC, papeletas municipales). Cada proveedor
 * real que Diego contrate expone su propio formato exacto, asi que este
 * cliente es intencionalmente simple: hace GET a `${baseUrl}${path}` con
 * el token como Bearer y como query param `token` (cubre ambos esquemas
 * comunes entre proveedores peruanos), y devuelve el JSON crudo.
 *
 * Si el proveedor no esta configurado (falta url o key), o la llamada
 * falla, se devuelve { available: false } para que el servicio pueda
 * responder con honestidad en vez de inventar datos.
 */
async function fetchFromProvider({ baseUrl, apiKey }, path, params = {}) {
  if (!baseUrl || !apiKey) {
    return { available: false, reason: 'sin_configurar' };
  }

  try {
    const res = await axios.get(`${baseUrl}${path}`, {
      params: { ...params, token: apiKey },
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 20000,
    });
    return { available: true, data: res.data };
  } catch (err) {
    return {
      available: false,
      reason: 'error_proveedor',
      detail: err.response ? `HTTP ${err.response.status}` : err.message,
    };
  }
}

module.exports = { fetchFromProvider };

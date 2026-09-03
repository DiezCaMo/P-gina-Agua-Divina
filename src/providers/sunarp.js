const axios = require('axios');
const config = require('../config');

// Todas estas consultas usan json.pe (https://json.pe), configurado en
// VEHICULO_API_URL / VEHICULO_API_KEY.
async function postJsonPe(path, placa) {
  const { url, key } = config.providers.vehiculo;
  if (!url || !key) {
    return { available: false, reason: 'sin_configurar' };
  }

  try {
    const res = await axios.post(
      `${url}${path}`,
      { placa },
      {
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    if (!res.data || res.data.success !== true || res.data.data === undefined) {
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

// Datos de fabrica del vehiculo: marca, modelo, color, motor, VIN.
function consultarPlaca(placa) {
  return postJsonPe('/placa', placa);
}

// Estado del SOAT vigente para la placa.
function consultarSoat(placa) {
  return postJsonPe('/soat', placa);
}

// Historial de revisiones tecnicas (un arreglo; el mas reciente trae "orden": "ULTIMO").
function consultarRevisionTecnica(placa) {
  return postJsonPe('/revision-tecnica', placa);
}

module.exports = { consultarPlaca, consultarSoat, consultarRevisionTecnica };

const axios = require('axios');
const config = require('../config');

// Consulta de datos vehiculares (marca, modelo, color, motor, VIN) por placa,
// via json.pe (https://json.pe), configurado en VEHICULO_API_URL / VEHICULO_API_KEY.
async function consultarPlaca(placa) {
  const { url, key } = config.providers.vehiculo;
  if (!url || !key) {
    return { available: false, reason: 'sin_configurar' };
  }

  try {
    const res = await axios.post(
      `${url}/placa`,
      { placa },
      {
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

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

module.exports = { consultarPlaca };

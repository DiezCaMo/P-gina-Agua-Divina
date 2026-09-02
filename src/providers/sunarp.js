const config = require('../config');
const { fetchFromProvider } = require('./httpProvider');

// Consulta de datos vehiculares (SUNARP/SOAT) por placa, via el proveedor
// externo que Diego configure en VEHICULO_API_URL / VEHICULO_API_KEY.
async function consultarPlaca(placa) {
  return fetchFromProvider(
    { baseUrl: config.providers.vehiculo.url, apiKey: config.providers.vehiculo.key },
    '/vehicular/placa',
    { placa }
  );
}

module.exports = { consultarPlaca };

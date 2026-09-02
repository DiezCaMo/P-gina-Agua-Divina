const config = require('../config');
const { fetchFromProvider } = require('./httpProvider');

// Consulta de papeletas / multas de transito pendientes por brevete y placa,
// via el proveedor externo configurado en PAPELETAS_API_URL / PAPELETAS_API_KEY.
// En Peru no existe una API publica unica para todas las municipalidades
// (cada SAT municipal maneja su propio sistema), por eso este es un
// adaptador generico: Diego debe contratar un proveedor que agregue estas
// fuentes (por ejemplo SAT de Lima u otro agregador nacional).
async function consultarPapeletas({ brevete, placa }) {
  return fetchFromProvider(
    { baseUrl: config.providers.papeletas.url, apiKey: config.providers.papeletas.key },
    '/transito/papeletas',
    { brevete, placa }
  );
}

module.exports = { consultarPapeletas };

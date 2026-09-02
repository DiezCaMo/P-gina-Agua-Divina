function timestamp() {
  return new Date().toISOString();
}

// Si el error viene de una llamada HTTP (axios) a la API de WhatsApp/Claude,
// esto imprime el detalle real que devolvio el servidor en vez del objeto
// gigante y truncado que muestra console.error por defecto.
function errorDetail(err) {
  if (err && err.response && err.response.data) {
    try {
      return JSON.stringify(err.response.data);
    } catch (jsonErr) {
      return String(err.response.data);
    }
  }
  return err && err.message ? err.message : String(err);
}

module.exports = {
  info: (...args) => console.log(`[${timestamp()}]`, ...args),
  warn: (...args) => console.warn(`[${timestamp()}]`, ...args),
  error: (...args) => console.error(`[${timestamp()}]`, ...args),
  errorDetail,
};

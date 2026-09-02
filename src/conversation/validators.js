const PLACA_RE = /^[A-Z0-9]{2,3}-?[A-Z0-9]{3,4}$/i;
const RUC_RE = /^(10|15|17|20)\d{9}$/;
const YEAR_RE = /^(19|20)\d{2}$/;
const BREVETE_RE = /^[A-Z]?\d{6,9}[A-Z]?$/i;

function notEmpty(text) {
  return text && text.trim().length > 0
    ? { ok: true, value: text.trim() }
    : { ok: false, error: 'Por favor envia una respuesta valida (no puede estar vacia).' };
}

function placa(text) {
  const value = (text || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!PLACA_RE.test(value)) {
    return { ok: false, error: 'Esa placa no parece valida. Escribela como en tu tarjeta de propiedad, por ejemplo ABC-123.' };
  }
  return { ok: true, value };
}

function ruc(text) {
  const value = (text || '').trim().replace(/\D/g, '');
  if (!RUC_RE.test(value)) {
    return { ok: false, error: 'Ese RUC no parece valido. Debe tener 11 digitos y empezar con 10, 15, 17 o 20. Intenta de nuevo.' };
  }
  return { ok: true, value };
}

function year(text) {
  const value = (text || '').trim();
  const current = new Date().getFullYear();
  if (!YEAR_RE.test(value) || Number(value) > current + 1) {
    return { ok: false, error: `Ese año no parece valido. Escribe solo el año, por ejemplo ${current - 5}.` };
  }
  return { ok: true, value };
}

function brevete(text) {
  const value = (text || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!BREVETE_RE.test(value)) {
    return { ok: false, error: 'Ese numero de brevete no parece valido. Escribelo tal como aparece en tu licencia de conducir.' };
  }
  return { ok: true, value };
}

module.exports = { notEmpty, placa, ruc, year, brevete };

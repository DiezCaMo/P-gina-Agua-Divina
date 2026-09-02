const claude = require('../providers/claude');

const NO_DISPONIBLE_MSG =
  'Recibi tu contrato en foto, pero en este momento no cuento con la herramienta para leer imagenes. ' +
  'Para no dejarte sin respuesta, tienes dos opciones: te devuelvo tu pago completo, o me envias el ' +
  'texto completo del contrato (copiado y pegado) y hago la revision sin costo adicional. ¿Cual prefieres, ' +
  '"reembolso" o "enviar texto"?';

const CHECKLIST = [
  { key: 'dni', label: 'Identificacion de las partes (DNI/RUC)', re: /\bDNI\b|\bRUC\b/i },
  { key: 'direccion', label: 'Direccion exacta del inmueble', re: /direcci[oó]n|ubicad[oa] en|inmueble (?:ubicado|situado)/i },
  { key: 'monto', label: 'Monto de la renta', re: /S\/\.?\s?\d|soles|renta mensual|merced conductiva/i },
  { key: 'plazo', label: 'Plazo del contrato', re: /plazo|vigencia|fecha de inicio|meses de duraci[oó]n/i },
  { key: 'garantia', label: 'Garantia o deposito', re: /garant[ií]a|dep[oó]sito/i },
  { key: 'mora', label: 'Penalidad por mora', re: /mora|penalidad|inter[eé]s moratorio/i },
  { key: 'resolucion', label: 'Clausula de resolucion o desalojo', re: /resoluci[oó]n del contrato|desalojo|allanamiento/i },
  { key: 'subarriendo', label: 'Permiso o prohibicion de subarrendar', re: /subarrend/i },
  { key: 'firma', label: 'Firma y fecha', re: /firma|suscrito en|conforme firman/i },
];

function fallbackTemplate(texto) {
  const encontrados = [];
  const faltantes = [];
  CHECKLIST.forEach((item) => {
    if (item.re.test(texto)) encontrados.push(item.label);
    else faltantes.push(item.label);
  });

  const lines = [];
  lines.push('RESUMEN:');
  lines.push(`Revise el contrato y encontre ${encontrados.length} de ${CHECKLIST.length} elementos clave que debe tener un contrato de alquiler en Peru.`);
  lines.push('');
  lines.push('RIESGOS ENCONTRADOS:');
  if (faltantes.length === 0) {
    lines.push('- No se detectaron ausencias evidentes en el texto revisado.');
  } else {
    faltantes.forEach((f) => lines.push(`- No se encontro con claridad: ${f}.`));
  }
  lines.push('');
  lines.push('RECOMENDACION FINAL:');
  lines.push(
    faltantes.length <= 1
      ? 'El contrato cubre la mayoria de puntos clave; es razonablemente seguro firmar, pero siempre conviene una lectura completa.'
      : 'Antes de firmar, pide que se aclaren o agreguen los puntos faltantes listados arriba. No es recomendable firmar tal como esta.'
  );
  lines.push('');
  lines.push('Nota: este es un analisis automatico basado en palabras clave, no reemplaza la revision de un abogado para montos muy altos o casos complejos.');
  return lines.join('\n');
}

async function run({ input }) {
  const contrato = input.contrato || {};

  if (claude.isEnabled()) {
    const message = await claude.analizarContrato({
      texto: contrato.texto || null,
      imagenBase64: contrato.imagenBase64 || null,
      imagenMediaType: contrato.imagenMediaType || null,
    });
    return { status: 'ok', message };
  }

  if (contrato.texto) {
    return { status: 'ok', message: fallbackTemplate(contrato.texto) };
  }

  return { status: 'no_disponible', message: NO_DISPONIBLE_MSG };
}

module.exports = { run };

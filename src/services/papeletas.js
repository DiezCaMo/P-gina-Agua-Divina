const papeletasProvider = require('../providers/papeletas');
const claude = require('../providers/claude');

const NO_DISPONIBLE_MSG =
  'No pude confirmar las papeletas de este brevete/placa con las fuentes disponibles en este momento. ' +
  'Para no dejarte sin respuesta, tienes dos opciones: te devuelvo tu pago completo, o hago una ' +
  'segunda revision sin costo apenas tenga acceso a la fuente. ¿Cual prefieres, "reembolso" o "revision gratis"?';

function fallbackTemplate({ input, data }) {
  const pendientes = Array.isArray(data.papeletas) ? data.papeletas : [];
  const lines = [];
  lines.push('RESUMEN:');
  lines.push(`Brevete ${input.brevete}, placa ${input.placa}: se encontraron ${pendientes.length} papeleta(s) pendiente(s) de pago.`);
  lines.push('');
  lines.push('RIESGOS ENCONTRADOS:');
  if (pendientes.length === 0) {
    lines.push('- No se encontraron papeletas pendientes.');
  } else {
    pendientes.slice(0, 8).forEach((p) => {
      lines.push(`- ${p.fecha || 'Fecha no especificada'}: ${p.motivo || 'Infraccion'} — S/ ${p.monto || '?'} (${p.entidad || 'entidad no especificada'})`);
    });
    if (pendientes.length > 8) lines.push(`- ...y ${pendientes.length - 8} mas.`);
  }
  lines.push('');
  lines.push('RECOMENDACION FINAL:');
  lines.push(
    pendientes.length === 0
      ? 'No se encontraron papeletas pendientes; es seguro proceder en cuanto a este punto.'
      : 'Hay papeletas pendientes de pago. Se recomienda regularizarlas antes de cualquier tramite (transferencia, SOAT, revision tecnica, etc.).'
  );
  return lines.join('\n');
}

async function run({ input }) {
  const result = await papeletasProvider.consultarPapeletas(input);

  if (!result.available) {
    return { status: 'no_disponible', message: NO_DISPONIBLE_MSG };
  }

  const data = result.data || {};

  let message;
  if (claude.isEnabled()) {
    message = await claude.redactarResumen({
      servicio: 'Verificacion de papeletas de transito',
      hallazgos: { consulta: input, datos_encontrados: data },
    });
  } else {
    message = fallbackTemplate({ input, data });
  }

  return { status: 'ok', message };
}

module.exports = { run };

const sunarp = require('../providers/sunarp');
const claude = require('../providers/claude');

const NO_DISPONIBLE_MSG =
  'No pude confirmar los datos de este vehiculo con las fuentes disponibles en este momento. ' +
  'Para no dejarte sin respuesta, tienes dos opciones: te devuelvo tu pago completo, o hago una ' +
  'segunda revision sin costo apenas tenga acceso a la fuente. ¿Cual prefieres, "reembolso" o "revision gratis"?';

function fallbackTemplate({ input, data }) {
  const lines = [];
  lines.push('RESUMEN:');
  lines.push(`Placa consultada: ${input.placa}. Dato declarado por el cliente: ${input.marca} ${input.modelo} (${input.anio}).`);
  if (data.marca && data.marca.toLowerCase() !== input.marca.toLowerCase()) {
    lines.push('');
    lines.push('RIESGOS ENCONTRADOS:');
    lines.push(`- La marca registrada (${data.marca}) no coincide con la marca que te dijeron (${input.marca}). Verifica antes de comprar.`);
  } else {
    lines.push('');
    lines.push('RIESGOS ENCONTRADOS:');
    lines.push('- No se encontraron inconsistencias evidentes entre lo declarado y lo registrado.');
  }
  if (data.soat_vigente === false) {
    lines.push('- El SOAT figura vencido o no vigente.');
  }
  if (Array.isArray(data.papeletas_pendientes) && data.papeletas_pendientes.length > 0) {
    lines.push(`- El vehiculo registra ${data.papeletas_pendientes.length} papeleta(s) pendiente(s).`);
  }
  lines.push('');
  lines.push('RECOMENDACION FINAL:');
  lines.push(
    data.marca && data.marca.toLowerCase() !== input.marca.toLowerCase()
      ? 'Procede con precaucion: confirma la ficha tecnica del vehiculo antes de continuar con la compra.'
      : 'Con la informacion disponible, es razonablemente seguro proceder, pero siempre revisa el vehiculo fisicamente antes de pagar.'
  );
  return lines.join('\n');
}

async function run({ input }) {
  const result = await sunarp.consultarPlaca(input.placa);

  if (!result.available) {
    return { status: 'no_disponible', message: NO_DISPONIBLE_MSG };
  }

  const data = result.data || {};

  let message;
  if (claude.isEnabled()) {
    message = await claude.redactarResumen({
      servicio: 'Verificacion de auto usado',
      hallazgos: { declarado_por_cliente: input, datos_encontrados: data },
    });
  } else {
    message = fallbackTemplate({ input, data });
  }

  return { status: 'ok', message };
}

module.exports = { run };

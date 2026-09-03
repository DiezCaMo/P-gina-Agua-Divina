const sunarp = require('../providers/sunarp');
const claude = require('../providers/claude');
const logger = require('../utils/logger');

const NO_DISPONIBLE_MSG =
  'No pude confirmar los datos de este vehiculo con las fuentes disponibles en este momento. ' +
  'No te preocupes, esto no queda asi: escribeme "revision gratis" y lo vuelvo a intentar sin costo ' +
  'apenas tenga acceso a la fuente.';

function fallbackTemplate({ input, data }) {
  const marcaCoincide = !data.marca || data.marca.toLowerCase().includes(input.marca.toLowerCase()) || input.marca.toLowerCase().includes(data.marca.toLowerCase());
  const modeloCoincide = !data.modelo || data.modelo.toLowerCase().includes(input.modelo.toLowerCase()) || input.modelo.toLowerCase().includes(data.modelo.toLowerCase());

  const lines = [];
  lines.push('RESUMEN:');
  lines.push(
    `Placa ${input.placa} — Registrado como ${data.marca || 'marca no disponible'} ${data.modelo || ''}, color ${data.color || 'no disponible'}. ` +
      `Dato declarado por el cliente: ${input.marca} ${input.modelo} (${input.anio}).`
  );
  lines.push('');
  lines.push('RIESGOS ENCONTRADOS:');
  if (!marcaCoincide) {
    lines.push(`- La marca registrada (${data.marca}) no coincide con la marca que te dijeron (${input.marca}). Verifica antes de comprar.`);
  }
  if (!modeloCoincide) {
    lines.push(`- El modelo registrado (${data.modelo}) no coincide con el modelo que te dijeron (${input.modelo}). Verifica antes de comprar.`);
  }
  if (marcaCoincide && modeloCoincide) {
    lines.push('- No se encontraron inconsistencias entre lo declarado y lo registrado en SUNARP.');
  }
  lines.push('');
  lines.push('RECOMENDACION FINAL:');
  lines.push(
    marcaCoincide && modeloCoincide
      ? 'Con la informacion disponible, es razonablemente seguro proceder, pero siempre revisa el vehiculo fisicamente, pide el SOAT vigente y las papeletas al dia antes de pagar.'
      : 'Procede con precaucion: confirma la ficha tecnica del vehiculo antes de continuar con la compra.'
  );
  lines.push('');
  lines.push(
    'Nota: esta verificacion revisa los datos de fabrica del vehiculo (marca, modelo, color). No incluye SOAT ' +
      'ni papeletas — te recomendamos pedirle esos documentos directamente al vendedor.'
  );
  return lines.join('\n');
}

async function run({ input }) {
  const result = await sunarp.consultarPlaca(input.placa);

  if (!result.available) {
    logger.warn('Consulta de placa no disponible:', result.reason, result.detail || '');
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

const sunarp = require('../providers/sunarp');
const claude = require('../providers/claude');
const logger = require('../utils/logger');

const NO_DISPONIBLE_MSG =
  'No pude confirmar los datos de este vehiculo con las fuentes disponibles en este momento. ' +
  'No te preocupes, esto no queda asi: escribeme "revision gratis" y lo vuelvo a intentar sin costo ' +
  'apenas tenga acceso a la fuente.';

function ultimaRevision(revisiones) {
  if (!Array.isArray(revisiones) || revisiones.length === 0) return null;
  return revisiones.find((r) => r.orden === 'ULTIMO') || revisiones[0];
}

function fallbackTemplate({ input, data, soat, revision }) {
  const marcaCoincide = !data.marca || data.marca.toLowerCase().includes(input.marca.toLowerCase()) || input.marca.toLowerCase().includes(data.marca.toLowerCase());
  const modeloCoincide = !data.modelo || data.modelo.toLowerCase().includes(input.modelo.toLowerCase()) || input.modelo.toLowerCase().includes(data.modelo.toLowerCase());
  const soatVigente = soat && soat.estado && soat.estado.toUpperCase() === 'VIGENTE';
  const revisionVigente = revision && revision.estado && revision.estado.toUpperCase() === 'VIGENTE';

  const lines = [];
  lines.push('RESUMEN:');
  lines.push(
    `Placa ${input.placa} — Registrado como ${data.marca || 'marca no disponible'} ${data.modelo || ''}, color ${data.color || 'no disponible'}. ` +
      `Dato declarado por el cliente: ${input.marca} ${input.modelo} (${input.anio}).`
  );
  if (soat) lines.push(`SOAT: ${soat.estado || 'desconocido'}${soat.fecha_fin ? ` (vence ${soat.fecha_fin})` : ''}, aseguradora ${soat.nombre_compania || 'no especificada'}.`);
  if (revision) lines.push(`Revision tecnica: ${revision.resultado_inspeccion || 'sin dato'}, estado ${revision.estado || 'desconocido'}${revision.vigente_hasta ? ` (vence ${revision.vigente_hasta})` : ''}.`);

  lines.push('');
  lines.push('RIESGOS ENCONTRADOS:');
  const riesgos = [];
  if (!marcaCoincide) riesgos.push(`La marca registrada (${data.marca}) no coincide con la marca que te dijeron (${input.marca}).`);
  if (!modeloCoincide) riesgos.push(`El modelo registrado (${data.modelo}) no coincide con el modelo que te dijeron (${input.modelo}).`);
  if (soat && !soatVigente) riesgos.push(`El SOAT figura ${soat.estado || 'no vigente'}.`);
  if (revision && !revisionVigente) riesgos.push(`La revision tecnica figura ${revision.estado || 'no vigente'} (resultado: ${revision.resultado_inspeccion || 'sin dato'}).`);
  if (riesgos.length === 0) {
    lines.push('- No se encontraron inconsistencias ni documentos vencidos en lo consultado.');
  } else {
    riesgos.forEach((r) => lines.push(`- ${r}`));
  }

  lines.push('');
  lines.push('RECOMENDACION FINAL:');
  lines.push(
    riesgos.length === 0
      ? 'Con la informacion disponible, es razonablemente seguro proceder, pero siempre revisa el vehiculo fisicamente antes de pagar.'
      : 'Procede con precaucion: hay puntos que conviene aclarar con el vendedor antes de continuar con la compra.'
  );
  lines.push('');
  lines.push(
    'Nota: no se incluyen papeletas de transito ni el nombre del propietario (esos datos no estan disponibles en esta fuente). ' +
      'Para el propietario, pide al vendedor su DNI y la tarjeta de propiedad, y compara que coincidan.'
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

  const [soatResult, revisionResult] = await Promise.all([
    sunarp.consultarSoat(input.placa),
    sunarp.consultarRevisionTecnica(input.placa),
  ]);

  if (!soatResult.available) logger.warn('Consulta de SOAT no disponible:', soatResult.reason, soatResult.detail || '');
  if (!revisionResult.available) logger.warn('Consulta de revision tecnica no disponible:', revisionResult.reason, revisionResult.detail || '');

  const soat = soatResult.available ? soatResult.data : null;
  const revision = revisionResult.available ? ultimaRevision(revisionResult.data) : null;

  let message;
  if (claude.isEnabled()) {
    message = await claude.redactarResumen({
      servicio: 'Verificacion de auto usado',
      hallazgos: { declarado_por_cliente: input, datos_encontrados: data, soat, revision_tecnica: revision },
    });
  } else {
    message = fallbackTemplate({ input, data, soat, revision });
  }

  return { status: 'ok', message };
}

module.exports = { run };

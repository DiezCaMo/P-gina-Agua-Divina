const sunat = require('../providers/sunat');
const claude = require('../providers/claude');

const NO_DISPONIBLE_MSG =
  'No pude confirmar el estado de este RUC en SUNAT con las fuentes disponibles en este momento. ' +
  'Para no dejarte sin respuesta, tienes dos opciones: te devuelvo tu pago completo, o hago una ' +
  'segunda revision sin costo apenas tenga acceso a la fuente. ¿Cual prefieres, "reembolso" o "revision gratis"?';

const AVISO_PRIVACIDAD =
  'Nota importante: esta verificacion solo revisa el estado publico de tu RUC en SUNAT ' +
  '(activo/baja, habido/no habido, actividad economica). No accedemos a tu clave SOL ni a tus ' +
  'declaraciones o deudas privadas, porque esa informacion solo la puedes consultar tu mismo.';

function riesgoPorEstado(data) {
  const estado = (data.estado || '').toUpperCase();
  const condicion = (data.condicion || '').toUpperCase();
  const riesgos = [];
  if (estado.includes('BAJA') || estado.includes('SUSPENSION')) {
    riesgos.push(`El RUC figura con estado "${data.estado}" en vez de ACTIVO.`);
  }
  if (condicion.includes('NO HABIDO') || condicion.includes('NO HALLADO')) {
    riesgos.push(`La condicion del RUC es "${data.condicion}", lo que es una señal de riesgo tributario.`);
  }
  return riesgos;
}

function fallbackTemplate({ input, data }) {
  const riesgosEstado = riesgoPorEstado(data);
  const lines = [];
  lines.push('RESUMEN:');
  lines.push(`RUC ${input.ruc} — Razon social: ${data.razon_social || 'no disponible'}. Estado: ${data.estado || 'no disponible'}, condicion: ${data.condicion || 'no disponible'}.`);
  lines.push('');
  lines.push('RIESGOS ENCONTRADOS:');
  if (riesgosEstado.length === 0) {
    lines.push('- No se encontraron señales de riesgo en el estado publico del RUC.');
  } else {
    riesgosEstado.forEach((r) => lines.push(`- ${r}`));
  }
  if (/s[ií]/i.test(input.pendientes || '')) {
    lines.push('- El propio contribuyente reporto boletas o facturas pendientes de declarar. Se recomienda regularizar cuanto antes para evitar multas.');
  }
  lines.push('');
  lines.push('RECOMENDACION FINAL:');
  lines.push(
    riesgosEstado.length === 0
      ? 'Con la informacion publica disponible, es razonablemente seguro proceder.'
      : 'Procede con precaucion: el estado del RUC muestra señales que conviene aclarar antes de una operacion importante.'
  );
  lines.push('');
  lines.push(AVISO_PRIVACIDAD);
  return lines.join('\n');
}

async function run({ input }) {
  const result = await sunat.consultarRuc(input.ruc);

  if (!result.available) {
    return { status: 'no_disponible', message: NO_DISPONIBLE_MSG };
  }

  const data = result.data || {};

  let message;
  if (claude.isEnabled()) {
    message = await claude.redactarResumen({
      servicio: 'Verificacion de riesgo tributario SUNAT',
      hallazgos: { declarado_por_cliente: input, datos_sunat: data },
    });
    message = `${message}\n\n${AVISO_PRIVACIDAD}`;
  } else {
    message = fallbackTemplate({ input, data });
  }

  return { status: 'ok', message };
}

module.exports = { run };

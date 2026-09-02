const { SERVICES } = require('../services');
const config = require('../config');

function welcome() {
  const menu = Object.values(SERVICES).map((s) => s.menuLabel).join('\n');
  return (
    `Hola, bienvenido a *Verifica Peru* 👋\n` +
    `Te ayudamos a verificar informacion importante antes de que tomes decisiones de dinero. ` +
    `Cada verificacion cuesta S/ ${config.payment.priceSoles}.\n\n` +
    `¿En que puedo ayudarte hoy? Responde con el numero de la opcion:\n\n${menu}\n\n` +
    `Escribe *ayuda* en cualquier momento si necesitas asistencia, o *menu* para volver a ver estas opciones.`
  );
}

function invalidChoice() {
  return 'No entendi esa opcion. Por favor responde solo con el numero (1, 2, 3 o 4) del servicio que necesitas.';
}

function help() {
  return (
    'Este es el bot automatico de *Verifica Peru*.\n' +
    'Ofrecemos 4 verificaciones (S/ 20 cada una): autos usados, contratos de alquiler, ' +
    'papeletas de transito y riesgo tributario SUNAT.\n\n' +
    'Comandos utiles:\n' +
    '- *menu*: ver las opciones de nuevo\n' +
    '- *cancelar*: cancelar el pedido actual\n' +
    '- *ayuda*: ver este mensaje'
  );
}

function cancelled() {
  return 'Tu pedido actual fue cancelado. Escribe *menu* cuando quieras empezar de nuevo.';
}

function readyForPaymentIntro() {
  return 'Listo, ya tengo todo lo que necesito para hacer tu verificacion.';
}

function waitingPayment() {
  return 'Quedo atento a tu confirmacion. Apenas hagas el pago, escribeme "ya pague" para continuar.';
}

function paymentReportedAutoMode() {
  return 'Gracias, dejame confirmar tu pago y genero tu verificacion. Dame un momento...';
}

function paymentReportedManualMode() {
  return (
    'Gracias por avisarme. Voy a confirmar tu pago y en cuanto este listo continuo automaticamente ' +
    'con tu verificacion. Esto puede tomar unos minutos.'
  );
}

function paymentRejected() {
  return (
    'No pude confirmar tu pago con el codigo que enviaste. Por favor revisa el monto y el codigo, ' +
    'y vuelve a escribirme "ya pague" cuando lo hayas verificado. Si crees que es un error, escribe *ayuda*.'
  );
}

function genericError() {
  return 'Ocurrio un problema de mi lado procesando tu mensaje. Por favor intenta de nuevo en un momento, o escribe *ayuda*.';
}

module.exports = {
  welcome,
  invalidChoice,
  help,
  cancelled,
  readyForPaymentIntro,
  waitingPayment,
  paymentReportedAutoMode,
  paymentReportedManualMode,
  paymentRejected,
  genericError,
};

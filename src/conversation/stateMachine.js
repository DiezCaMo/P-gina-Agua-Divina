const fs = require('fs');
const path = require('path');
const store = require('./store');
const messages = require('./messages');
const services = require('../services');
const payments = require('../payments');
const whatsapp = require('../whatsapp');
const config = require('../config');
const db = require('../db');

const MENU_RE = /^(menu|inicio)$/i;
const HELP_RE = /^(ayuda|help)$/i;
const CANCEL_RE = /^(cancelar|cancela|salir)$/i;
const PAYMENT_CONFIRM_RE = /ya\s*(pagu|deposit|transfer|yape|plin|envi)|listo,?\s*ya|pago\s*(hecho|realizado|listo)/i;
const REFUND_RE = /reembolso/i;
const FREE_RECHECK_RE = /revisi[oó]n\s*gratis/i;
const SEND_TEXT_RE = /enviar\s*texto/i;

function findPhoneByOrderId(orderId) {
  const row = db.prepare('SELECT phone FROM conversations WHERE order_id = ?').get(orderId);
  return row ? row.phone : null;
}

// Permite que un numero de administrador se pruebe a si mismo como si fuera
// cliente, sin tener que cambiar variables de entorno cada vez.
function isTestMode(phone) {
  const row = db.prepare('SELECT enabled FROM admin_test_mode WHERE phone = ?').get(phone);
  return Boolean(row && row.enabled);
}

function setTestMode(phone, enabled) {
  db.prepare(
    `INSERT INTO admin_test_mode (phone, enabled) VALUES (?, ?)
     ON CONFLICT(phone) DO UPDATE SET enabled = excluded.enabled`
  ).run(phone, enabled ? 1 : 0);
}

async function notifyAdmins(text) {
  for (const admin of config.adminNumbers) {
    try {
      await whatsapp.sendText(admin, text);
    } catch (err) {
      // seguimos con los demas admins aunque uno falle
    }
  }
}

async function notifyAdminsWithButtons(text, buttons, imageUrl) {
  for (const admin of config.adminNumbers) {
    try {
      await whatsapp.sendButtons(admin, text, buttons, imageUrl);
    } catch (err) {
      // seguimos con los demas admins aunque uno falle
    }
  }
}

// Descarga la captura de pago que mando el cliente y la deja accesible
// publicamente para poder mostrarsela al administrador. Se guarda en
// data/uploads (no se sube a GitHub) y se sobreescribe si el cliente
// manda varias capturas para el mismo pedido.
async function saveProofImage(orderId, mediaId) {
  if (!config.publicBaseUrl) return null;
  const media = await whatsapp.downloadMedia(mediaId);
  const ext = media.contentType.includes('png') ? 'png' : 'jpg';
  const dir = path.join(__dirname, '..', '..', 'data', 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${orderId}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), media.buffer);
  return `${config.publicBaseUrl}/uploads/${filename}`;
}

async function runVerificationAndDeliver(phone) {
  const conv = store.get(phone);
  const orderId = conv ? conv.order_id : null;
  if (!orderId) return;

  const order = payments.getOrder(orderId);
  if (!order) return;

  const service = services.byKey(order.service);
  let result;
  try {
    result = await service.run({ input: order.service_data });
  } catch (err) {
    result = {
      status: 'no_disponible',
      message:
        'Tuve un problema tecnico generando tu verificacion. No te preocupes, esto no queda asi: ' +
        'escribeme "revision gratis" y lo vuelvo a intentar sin costo.',
    };
  }

  payments.saveResult(orderId, result);

  if (result.status === 'ok') {
    await whatsapp.sendText(
      phone,
      `${result.message}\n\n¡Gracias por confiar en *Verifica Peru*! Escribe *menu* si deseas otra verificacion.`
    );
    store.reset(phone);
  } else {
    await whatsapp.sendText(phone, result.message);
    store.save(phone, { state: 'awaiting_refund_choice', service: order.service, orderId, data: conv.data });
  }
}

async function finalizeCollectionAndAskPayment(phone, service, data) {
  const orderId = payments.createOrder({ phone, service: service.key, serviceData: data });
  store.save(phone, { state: 'awaiting_payment', service: service.key, data, orderId });
  await whatsapp.sendText(phone, payments.paymentInstructions(orderId));

  const qrUrl = payments.qrImageUrl();
  if (qrUrl) {
    await whatsapp.sendImage(phone, qrUrl, 'Tambien puedes pagar escaneando este QR.');
  }
}

async function handleMenuChoice(phone, text) {
  const service = services.byChoice(text);
  if (!service) {
    await whatsapp.sendText(phone, messages.invalidChoice());
    return;
  }
  store.save(phone, { state: 'collecting', service: service.key, fieldIndex: 0, data: {} });
  await whatsapp.sendText(phone, `${service.confirmMsg}\n\n${service.fields[0].prompt}`);
}

async function handleCollecting(phone, conv, message) {
  const service = services.byKey(conv.service);
  const field = service.fields[conv.field_index];
  const data = { ...conv.data };

  if (field.acceptMedia) {
    if (message.type === 'image' || message.type === 'document') {
      try {
        const media = await whatsapp.downloadMedia(message.mediaId);
        data[field.key] = {
          texto: null,
          imagenBase64: media.buffer.toString('base64'),
          imagenMediaType: media.contentType,
        };
      } catch (err) {
        await whatsapp.sendText(
          phone,
          'No pude descargar la imagen que enviaste. ¿Puedes intentar enviarla de nuevo, o escribir el texto del contrato directamente?'
        );
        return;
      }
    } else if (message.type === 'text' && message.text && message.text.trim().length > 5) {
      data[field.key] = { texto: message.text.trim(), imagenBase64: null, imagenMediaType: null };
    } else {
      await whatsapp.sendText(phone, field.prompt);
      return;
    }
  } else {
    if (message.type !== 'text') {
      await whatsapp.sendText(phone, 'Por favor respondeme con un mensaje de texto para continuar. ' + field.prompt);
      return;
    }
    const validation = field.validate(message.text);
    if (!validation.ok) {
      await whatsapp.sendText(phone, validation.error);
      return;
    }
    data[field.key] = validation.value;
  }

  const nextIndex = conv.field_index + 1;
  if (nextIndex < service.fields.length) {
    store.save(phone, { state: 'collecting', service: service.key, fieldIndex: nextIndex, data });
    await whatsapp.sendText(phone, service.fields[nextIndex].prompt);
    return;
  }

  await finalizeCollectionAndAskPayment(phone, service, data);
}

async function handleAwaitingPayment(phone, conv, message) {
  const text = message.text || '';
  const looksLikePayment = message.type === 'image' || PAYMENT_CONFIRM_RE.test(text);

  if (!looksLikePayment) {
    await whatsapp.sendText(phone, messages.waitingPayment());
    return;
  }

  payments.reportPayment(conv.order_id);
  const order = payments.getOrder(conv.order_id);
  const service = services.byKey(order.service);

  if (config.requireManualPaymentConfirmation) {
    store.save(phone, { state: 'awaiting_admin', service: conv.service, data: conv.data, orderId: conv.order_id });
    await whatsapp.sendText(phone, messages.paymentReportedManualMode());

    let proofImageUrl = null;
    if (message.type === 'image') {
      try {
        proofImageUrl = await saveProofImage(order.id, message.mediaId);
      } catch (err) {
        // si falla la descarga, igual avisamos al admin sin la foto
      }
    }

    await notifyAdminsWithButtons(
      `Nuevo pago reportado.\nCodigo: ${order.id}\nCliente: ${phone}\nServicio: ${service.name}\nMonto: S/ ${order.price_soles}`,
      [
        { id: `confirm_${order.id}`, title: 'Confirmar pago' },
        { id: `reject_${order.id}`, title: 'No veo el pago' },
      ],
      proofImageUrl
    );
  } else {
    await whatsapp.sendText(phone, messages.paymentReportedAutoMode());
    payments.confirmPayment(conv.order_id);
    await runVerificationAndDeliver(phone);
  }
}

async function handleAwaitingAdmin(phone) {
  await whatsapp.sendText(
    phone,
    'Estoy confirmando tu pago, apenas este listo continuo automaticamente con tu verificacion. Gracias por tu paciencia.'
  );
}

async function handleAwaitingRefundChoice(phone, conv, message) {
  const text = message.text || '';

  if (REFUND_RE.test(text)) {
    await notifyAdmins(
      `Cliente pidio REEMBOLSO.\nCodigo: ${conv.order_id}\nCliente: ${phone}\nServicio: ${conv.service}\n` +
        `Por favor procesa la devolucion manualmente por el mismo medio de pago.`
    );
    await whatsapp.sendText(
      phone,
      'Entendido, he avisado para que te devuelvan tu pago. Puede tomar un poco de tiempo procesarlo. ' +
        'Gracias por tu paciencia y disculpa las molestias.'
    );
    store.reset(phone);
    return;
  }

  if (conv.service === 'alquiler' && SEND_TEXT_RE.test(text)) {
    store.save(phone, { state: 'collecting', service: 'alquiler', fieldIndex: 0, data: {} });
    await whatsapp.sendText(phone, 'Perfecto, envíame el texto completo del contrato (copiado y pegado).');
    return;
  }

  if (FREE_RECHECK_RE.test(text)) {
    await whatsapp.sendText(phone, 'Dale, intento la revision de nuevo. Dame un momento...');
    await runVerificationAndDeliver(phone);
    return;
  }

  const opcion = conv.service === 'alquiler' ? '"enviar texto"' : '"revision gratis"';
  await whatsapp.sendText(phone, `No entendi tu respuesta. Por favor escribe ${opcion}.`);
}

async function confirmOrder(adminPhone, orderId) {
  const order = payments.getOrder(orderId);
  if (!order) {
    await whatsapp.sendText(adminPhone, `No encontre el pedido ${orderId}.`);
    return;
  }
  payments.confirmPayment(orderId);
  const phone = findPhoneByOrderId(orderId);
  await whatsapp.sendText(adminPhone, `Pago confirmado para ${orderId}. Generando verificacion para el cliente...`);
  if (phone) await runVerificationAndDeliver(phone);
}

async function rejectOrder(adminPhone, orderId) {
  const order = payments.getOrder(orderId);
  if (!order) {
    await whatsapp.sendText(adminPhone, `No encontre el pedido ${orderId}.`);
    return;
  }
  payments.rejectPayment(orderId);
  const phone = findPhoneByOrderId(orderId);
  if (phone) {
    store.save(phone, { state: 'awaiting_payment', service: order.service, data: order.service_data, orderId });
    await whatsapp.sendText(phone, messages.paymentRejected());
  }
  await whatsapp.sendText(adminPhone, `Pago rechazado para ${orderId}. Se avisó al cliente.`);
}

// Cuando el admin toca uno de los botones "Confirmar pago" / "No veo el pago".
async function handleAdminButton(adminPhone, buttonId) {
  const confirmMatch = buttonId.match(/^confirm_(VP-[A-Z0-9]+)$/i);
  const rejectMatch = buttonId.match(/^reject_(VP-[A-Z0-9]+)$/i);

  if (confirmMatch) {
    await confirmOrder(adminPhone, confirmMatch[1].toUpperCase());
    return;
  }
  if (rejectMatch) {
    await rejectOrder(adminPhone, rejectMatch[1].toUpperCase());
    return;
  }
}

async function handleAdminCommand(adminPhone, text) {
  const confirmMatch = text.match(/^CONFIRMAR\s+(VP-[A-Z0-9]+)/i);
  const rejectMatch = text.match(/^RECHAZAR\s+(VP-[A-Z0-9]+)/i);
  const statusMatch = text.match(/^ESTADO\s+(VP-[A-Z0-9]+)/i);

  if (confirmMatch) {
    await confirmOrder(adminPhone, confirmMatch[1].toUpperCase());
    return;
  }

  if (rejectMatch) {
    await rejectOrder(adminPhone, rejectMatch[1].toUpperCase());
    return;
  }

  if (statusMatch) {
    const orderId = statusMatch[1].toUpperCase();
    const order = payments.getOrder(orderId);
    if (!order) {
      await whatsapp.sendText(adminPhone, `No encontre el pedido ${orderId}.`);
      return;
    }
    await whatsapp.sendText(
      adminPhone,
      `Pedido ${order.id}\nCliente: ${order.phone}\nServicio: ${order.service}\nPago: ${order.payment_status}\nResultado: ${order.result_status || 'pendiente'}`
    );
    return;
  }

  await whatsapp.sendText(
    adminPhone,
    'Comandos disponibles:\nCONFIRMAR <codigo>\nRECHAZAR <codigo>\nESTADO <codigo>\n\n' +
      'O simplemente toca los botones "Confirmar pago" / "No veo el pago" que te mando en cada aviso de pago.'
  );
}

async function handleIncoming(phone, message) {
  if (config.adminNumbers.includes(phone) && message.buttonId) {
    await handleAdminButton(phone, message.buttonId);
    return;
  }

  if (config.adminNumbers.includes(phone) && message.type === 'text') {
    const adminText = message.text.trim().toLowerCase();

    if (adminText === 'modo cliente') {
      setTestMode(phone, true);
      await whatsapp.sendText(
        phone,
        'Listo, ahora te voy a tratar como cliente para que puedas probar el bot. Escribe "modo admin" cuando quieras volver a los comandos de administrador.'
      );
      return;
    }
    if (adminText === 'modo admin') {
      setTestMode(phone, false);
      await whatsapp.sendText(phone, 'Listo, volviste a modo administrador.');
      return;
    }
    if (!isTestMode(phone)) {
      await handleAdminCommand(phone, message.text.trim());
      return;
    }
  }

  let conv = store.get(phone);
  if (!conv) {
    store.reset(phone);
    await whatsapp.sendText(phone, messages.welcome());
    return;
  }

  const text = message.type === 'text' ? message.text.trim() : '';

  if (MENU_RE.test(text)) {
    store.reset(phone);
    await whatsapp.sendText(phone, messages.welcome());
    return;
  }
  if (HELP_RE.test(text)) {
    await whatsapp.sendText(phone, messages.help());
    return;
  }
  if (CANCEL_RE.test(text)) {
    store.reset(phone);
    await whatsapp.sendText(phone, messages.cancelled());
    return;
  }

  switch (conv.state) {
    case 'menu':
      await handleMenuChoice(phone, text);
      break;
    case 'collecting':
      await handleCollecting(phone, conv, message);
      break;
    case 'awaiting_payment':
      await handleAwaitingPayment(phone, conv, message);
      break;
    case 'awaiting_admin':
      await handleAwaitingAdmin(phone);
      break;
    case 'awaiting_refund_choice':
      await handleAwaitingRefundChoice(phone, conv, message);
      break;
    default:
      store.reset(phone);
      await whatsapp.sendText(phone, messages.welcome());
  }
}

module.exports = { handleIncoming };

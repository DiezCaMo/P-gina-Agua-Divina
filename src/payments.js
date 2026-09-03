const { customAlphabet } = require('nanoid');
const db = require('./db');
const config = require('./config');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos (0/O, 1/I)
const genCode = customAlphabet(ALPHABET, 6);

function generateUniqueCode() {
  const exists = db.prepare('SELECT 1 FROM orders WHERE id = ?');
  let code;
  do {
    code = `VP-${genCode()}`;
  } while (exists.get(code));
  return code;
}

function qrImageUrl() {
  if (!config.payment.qrImageFile || !config.publicBaseUrl) return null;
  return `${config.publicBaseUrl}/public/${config.payment.qrImageFile}`;
}

function paymentInstructions(code) {
  const p = config.payment;
  const lines = [];
  lines.push(`Listo, ya tengo todo lo que necesito para hacer tu verificacion.`);
  lines.push('');
  lines.push(`El costo del servicio es S/ ${p.priceSoles}. Tu codigo de pedido es *${code}* (es solo para que ambos lo identifiquemos si necesitas escribirme despues).`);
  lines.push('');
  lines.push('Por favor realiza el pago por uno de estos medios:');
  if (p.yapeNumber) lines.push(`- Yape: ${p.yapeNumber}`);
  if (p.plinNumber) lines.push(`- Plin: ${p.plinNumber} (${p.accountHolder})`);
  if (p.bankName && p.bankAccount) lines.push(`- Transferencia ${p.bankName}: cuenta ${p.bankAccount}${p.bankCci ? ` (CCI: ${p.bankCci})` : ''}`);
  if (qrImageUrl()) lines.push(`- Tambien te mando el QR de BiPay para que pagues escaneandolo.`);
  lines.push('');
  lines.push('Apenas hagas el pago, mandame por aqui la captura/pantallazo del comprobante y confirmo enseguida.');
  return lines.join('\n');
}

function createOrder({ phone, service, serviceData }) {
  const id = generateUniqueCode();
  db.prepare(
    `INSERT INTO orders (id, phone, service, service_data, price_soles, payment_status)
     VALUES (?, ?, ?, ?, ?, 'pendiente')`
  ).run(id, phone, service, JSON.stringify(serviceData || {}), config.payment.priceSoles);
  return id;
}

function getOrder(id) {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, service_data: JSON.parse(row.service_data || '{}') };
}

function reportPayment(id) {
  db.prepare(
    `UPDATE orders SET payment_status = 'reportado', payment_reported_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(id);
}

function confirmPayment(id) {
  db.prepare(
    `UPDATE orders SET payment_status = 'confirmado', payment_confirmed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(id);
}

function rejectPayment(id) {
  db.prepare(
    `UPDATE orders SET payment_status = 'rechazado', updated_at = datetime('now') WHERE id = ?`
  ).run(id);
}

function saveResult(id, { status, message }) {
  db.prepare(
    `UPDATE orders SET result_status = ?, result = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, message, id);
}

function findLatestOpenOrderForPhone(phone) {
  return db
    .prepare(
      `SELECT * FROM orders WHERE phone = ? AND payment_status IN ('pendiente','reportado')
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(phone);
}

module.exports = {
  paymentInstructions,
  qrImageUrl,
  createOrder,
  getOrder,
  reportPayment,
  confirmPayment,
  rejectPayment,
  saveResult,
  findLatestOpenOrderForPhone,
};

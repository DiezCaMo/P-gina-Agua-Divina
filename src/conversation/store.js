const db = require('../db');

function get(phone) {
  const row = db.prepare('SELECT * FROM conversations WHERE phone = ?').get(phone);
  if (!row) return null;
  return { ...row, data: JSON.parse(row.data || '{}') };
}

function save(phone, { state, service = null, fieldIndex = 0, data = {}, orderId = null }) {
  db.prepare(
    `INSERT INTO conversations (phone, state, service, field_index, data, order_id, updated_at)
     VALUES (@phone, @state, @service, @fieldIndex, @data, @orderId, datetime('now'))
     ON CONFLICT(phone) DO UPDATE SET
       state = excluded.state,
       service = excluded.service,
       field_index = excluded.field_index,
       data = excluded.data,
       order_id = excluded.order_id,
       updated_at = datetime('now')`
  ).run({
    phone,
    state,
    service,
    fieldIndex,
    data: JSON.stringify(data || {}),
    orderId,
  });
}

function reset(phone) {
  save(phone, { state: 'menu', service: null, fieldIndex: 0, data: {}, orderId: null });
}

module.exports = { get, save, reset };

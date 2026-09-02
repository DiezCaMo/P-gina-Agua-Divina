const crypto = require('crypto');

// Valida que el webhook realmente venga de Meta, comparando la firma
// X-Hub-Signature-256 contra un HMAC-SHA256 del cuerpo crudo usando el
// App Secret. Si no hay App Secret configurado, se omite la validacion
// (util para pruebas locales, pero se recomienda configurarlo en produccion).
function isValidSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return true;
  if (!signatureHeader) return false;

  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const received = signatureHeader.replace('sha256=', '');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(received, 'hex');
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

module.exports = { isValidSignature };

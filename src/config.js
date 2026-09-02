require('dotenv').config();

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

function list(value) {
  if (!value) return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

const config = {
  port: Number(process.env.PORT || 3000),

  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'verifica-peru-webhook',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  },

  adminNumbers: list(process.env.ADMIN_WHATSAPP_NUMBERS),
  requireManualPaymentConfirmation: bool(process.env.REQUIRE_MANUAL_PAYMENT_CONFIRMATION, true),

  // URL publica donde corre este servidor (ej. https://tu-app.onrender.com).
  // Se usa para armar enlaces a archivos publicos, como el QR de pago.
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),

  payment: {
    priceSoles: Number(process.env.PAYMENT_PRICE_SOLES || 20),
    yapeNumber: process.env.PAYMENT_YAPE_NUMBER || '',
    plinNumber: process.env.PAYMENT_PLIN_NUMBER || '',
    bankName: process.env.PAYMENT_BANK_NAME || '',
    bankAccount: process.env.PAYMENT_BANK_ACCOUNT || '',
    bankCci: process.env.PAYMENT_BANK_CCI || '',
    accountHolder: process.env.PAYMENT_ACCOUNT_HOLDER || 'Verifica Peru',
    // Nombre del archivo del QR (billetera BiPay, etc.) dentro de la carpeta /public.
    // Se manda como foto junto con las instrucciones de pago, si esta configurado.
    qrImageFile: process.env.PAYMENT_QR_IMAGE_FILE || '',
  },

  dbPath: process.env.DB_PATH || './data/verifica_peru.db',

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  },

  providers: {
    vehiculo: {
      url: process.env.VEHICULO_API_URL || '',
      key: process.env.VEHICULO_API_KEY || '',
    },
    ruc: {
      url: process.env.RUC_API_URL || '',
      key: process.env.RUC_API_KEY || '',
    },
    papeletas: {
      url: process.env.PAPELETAS_API_URL || '',
      key: process.env.PAPELETAS_API_KEY || '',
    },
  },
};

module.exports = config;

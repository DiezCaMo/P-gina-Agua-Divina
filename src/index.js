const path = require('path');
const express = require('express');
const config = require('./config');
const db = require('./db'); // asegura que las tablas existan al arrancar
const logger = require('./utils/logger');
const { isValidSignature } = require('./utils/signature');
const { handleIncoming } = require('./conversation/stateMachine');

const app = express();

// Guardamos el cuerpo crudo (necesario para validar la firma de Meta).
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Archivos publicos (ej. el QR de pago) que WhatsApp necesita poder descargar.
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => res.send('Verifica Peru bot esta funcionando.'));

// Verificacion del webhook (Meta la llama una vez al configurar el webhook).
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('Webhook verificado correctamente por Meta.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

function parseIncomingMessage(waMessage) {
  const base = { id: waMessage.id, from: waMessage.from };
  switch (waMessage.type) {
    case 'text':
      return { ...base, type: 'text', text: waMessage.text.body };
    case 'image':
      return { ...base, type: 'image', mediaId: waMessage.image.id, mimeType: waMessage.image.mime_type };
    case 'document':
      return { ...base, type: 'document', mediaId: waMessage.document.id, mimeType: waMessage.document.mime_type };
    case 'button':
      return { ...base, type: 'text', text: waMessage.button.text };
    case 'interactive':
      if (waMessage.interactive.button_reply) {
        return { ...base, type: 'text', text: waMessage.interactive.button_reply.title };
      }
      if (waMessage.interactive.list_reply) {
        return { ...base, type: 'text', text: waMessage.interactive.list_reply.title };
      }
      return { ...base, type: 'unsupported' };
    default:
      return { ...base, type: 'unsupported' };
  }
}

function alreadyProcessed(messageId) {
  const row = db.prepare('SELECT 1 FROM processed_messages WHERE id = ?').get(messageId);
  if (row) return true;
  db.prepare('INSERT OR IGNORE INTO processed_messages (id) VALUES (?)').run(messageId);
  return false;
}

app.post('/webhook', async (req, res) => {
  const signature = req.get('X-Hub-Signature-256');
  if (!isValidSignature(req.rawBody, signature, config.whatsapp.appSecret)) {
    logger.warn('Firma de webhook invalida, se descarta el request.');
    return res.sendStatus(403);
  }

  // Respondemos 200 de inmediato para que Meta no reintente; el trabajo
  // real se procesa despues.
  res.sendStatus(200);

  try {
    const entries = req.body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const waMessages = value.messages || [];

        for (const waMessage of waMessages) {
          if (alreadyProcessed(waMessage.id)) continue;

          const parsed = parseIncomingMessage(waMessage);

          if (parsed.type === 'unsupported') {
            const whatsapp = require('./whatsapp');
            await whatsapp.sendText(
              parsed.from,
              'Por el momento solo puedo leer mensajes de texto y fotos. ¿Puedes intentar de esa forma?'
            );
            continue;
          }

          try {
            await handleIncoming(parsed.from, parsed);
          } catch (err) {
            logger.error('Error procesando mensaje de', parsed.from, err);
            try {
              const whatsapp = require('./whatsapp');
              const messages = require('./conversation/messages');
              await whatsapp.sendText(parsed.from, messages.genericError());
            } catch (sendErr) {
              logger.error('No se pudo enviar mensaje de error al cliente', sendErr);
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error('Error procesando webhook', err);
  }
});

app.listen(config.port, () => {
  logger.info(`Verifica Peru bot escuchando en el puerto ${config.port}`);
  if (!config.whatsapp.token || !config.whatsapp.phoneNumberId) {
    logger.warn('Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en el archivo .env');
  }
});

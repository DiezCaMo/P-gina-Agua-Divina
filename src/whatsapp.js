const axios = require('axios');
const config = require('./config');

const graph = axios.create({
  baseURL: `https://graph.facebook.com/${config.whatsapp.apiVersion}`,
  headers: {
    Authorization: `Bearer ${config.whatsapp.token}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

async function sendText(to, body) {
  return graph.post(`/${config.whatsapp.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body, preview_url: false },
  });
}

async function sendImage(to, imageUrl, caption) {
  return graph.post(`/${config.whatsapp.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
  });
}

// Manda un mensaje con hasta 3 botones de respuesta rapida (el cliente/admin
// solo toca uno, no necesita escribir nada). Si headerImageUrl esta presente,
// se muestra una foto arriba del texto (ej. la captura del pago).
async function sendButtons(to, bodyText, buttons, headerImageUrl) {
  const interactive = {
    type: 'button',
    body: { text: bodyText },
    action: {
      buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
    },
  };
  if (headerImageUrl) {
    interactive.header = { type: 'image', image: { link: headerImageUrl } };
  }
  return graph.post(`/${config.whatsapp.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive,
  });
}

async function markAsRead(messageId) {
  try {
    await graph.post(`/${config.whatsapp.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  } catch (err) {
    // No es critico si esto falla.
  }
}

async function getMediaUrl(mediaId) {
  const res = await graph.get(`/${mediaId}`);
  return res.data.url;
}

async function downloadMedia(mediaId) {
  const url = await getMediaUrl(mediaId);
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${config.whatsapp.token}` },
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  return {
    buffer: Buffer.from(res.data),
    contentType: res.headers['content-type'] || 'application/octet-stream',
  };
}

module.exports = { sendText, sendImage, sendButtons, markAsRead, downloadMedia };

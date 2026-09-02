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

module.exports = { sendText, sendImage, markAsRead, downloadMedia };

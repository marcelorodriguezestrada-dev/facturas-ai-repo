/**
 * Meta WhatsApp Cloud API — gratis hasta 1000 conversaciones/mes.
 * Setup: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
 * (te dan un número de prueba gratis, no hace falta verificar tu propio número al principio)
 */

const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

async function callWhatsAppAPI(body: object) {
  const res = await fetch(WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[whatsapp] error:", await res.text());
  }
  return res.json();
}

export async function sendMessage(phone: string, text: string) {
  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: text },
  });
}

export async function sendMedia(phone: string, url: string, caption?: string) {
  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    to: phone,
    type: "document",
    document: { link: url, caption: caption || "" },
  });
}

// Descarga la imagen que mandó el usuario (Meta la sirve detrás de su propia URL temporal)
export async function getMediaUrl(mediaId: string): Promise<string> {
  const res = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
  });
  const data = await res.json();
  return data.url;
}

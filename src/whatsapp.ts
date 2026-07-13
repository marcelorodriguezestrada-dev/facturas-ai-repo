/**
 * Meta WhatsApp Cloud API — gratis hasta 1000 conversaciones/mes.
 * Setup: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
 * (te dan un número de prueba gratis, no hace falta verificar tu propio número al principio)
 */

const WHATSAPP_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

/**
 * Los números argentinos llegan en el webhook entrante CON el "9" extra
 * (ej: 5491167076678), que es el formato que usa WhatsApp internamente
 * para celulares. Pero la "lista de permitidos" del modo de prueba de Meta
 * a veces guarda el número SIN ese 9 (5411167076678 -> 541167076678).
 * Si no se remueve antes de responder, Meta tira error 131030
 * "Recipient phone number not in allowed list" aunque el número sea correcto.
 */
function normalizeArgentinePhone(phone: string): string {
  if (phone.startsWith("549")) {
    return "54" + phone.slice(3);
  }
  return phone;
}

async function callWhatsAppAPI(body: object) {
  const res = await fetch(WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  // Leemos el body UNA sola vez (como texto) y de ahí intentamos parsear JSON.
  // Antes se leía dos veces (text() y json()), lo cual tira
  // "Body is unusable: Body has already been read" en el segundo intento.
  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }
  if (!res.ok) {
    console.error("[whatsapp] error:", data);
  }
  return data;
}

export async function sendMessage(phone: string, text: string) {
  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    to: normalizeArgentinePhone(phone),
    type: "text",
    text: { body: text },
  });
}

export async function sendMedia(phone: string, url: string, caption?: string) {
  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    to: normalizeArgentinePhone(phone),
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

/**
 * Descarga los BYTES reales de la imagen (no solo la URL).
 * IMPORTANTE: la URL que da Meta requiere el header de Authorization para
 * poder descargarse — si se le pasa esa URL directo a Tesseract (u otra
 * librería) sin ese header, Meta devuelve un error en vez de la imagen,
 * y la librería de OCR revienta al intentar leerlo como si fuera una foto.
 */
export async function getMediaBuffer(mediaId: string): Promise<Buffer> {
  const mediaUrl = await getMediaUrl(mediaId);
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`No se pudo descargar la imagen (status ${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

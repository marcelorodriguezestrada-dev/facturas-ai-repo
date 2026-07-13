import "dotenv/config";
import express from "express";
import { getOrCreateSession, updateSession, guardarFactura, getFacturasDelMes, UserSession } from "./firebase";
import { sendMessage, sendMedia, getMediaUrl } from "./whatsapp";
import { runOCR, validarCAE } from "./ocr";
import { callLLM, buildCategorizationPrompt, buildResumenMensualPrompt } from "./prompts";
import { generarPDFResumen } from "./pdf";
import { validarFormatoCUIT } from "./cuit";
import { MENSAJES } from "./messages";

const app = express();
app.use(express.json());

// ── Verificación del webhook (Meta la pide una sola vez al configurar) ──
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ── Mensajes entrantes ──
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // responder rápido, procesar después

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message) return;

    const phone = message.from;
    console.log("DEBUG - número recibido en webhook:", JSON.stringify(phone));
    const session = await getOrCreateSession(phone);

    if (message.type === "text") {
      await handleText(session, message.text.body);
    } else if (message.type === "image") {
      const mediaUrl = await getMediaUrl(message.image.id);
      await handleImage(session, mediaUrl);
    } else {
      await sendMessage(phone, MENSAJES.no_es_imagen);
    }
  } catch (err) {
    console.error("[webhook] error:", err);
  }
});

async function handleText(session: UserSession, texto: string) {
  const cmd = texto.trim().toUpperCase();
  const phone = session.phone;

  if (cmd === "RESUMEN") return enviarResumenMensual(session);
  if (cmd === "AYUDA") return sendMessage(phone, MENSAJES.ayuda);

  // ── Onboarding ──
  if (session.state === "nuevo") {
    await updateSession(phone, { state: "pidiendo_cuit" });
    await sendMessage(phone, MENSAJES.bienvenida());
    return sendMessage(phone, MENSAJES.pedir_cuit);
  }

  if (session.state === "pidiendo_cuit") {
    if (!validarFormatoCUIT(texto)) return sendMessage(phone, MENSAJES.cuit_invalido);
    await updateSession(phone, { cuit: texto, state: "pidiendo_contador" });
    return sendMessage(phone, MENSAJES.cuit_ok(texto));
  }

  if (session.state === "pidiendo_contador") {
    if (cmd === "LISTO") {
      await updateSession(phone, { state: "esperando_foto" });
      return sendMessage(phone, MENSAJES.onboarding_completo);
    }
    await updateSession(phone, { state: "esperando_foto", contadorPhone: texto });
    return sendMessage(phone, MENSAJES.contador_vinculado);
  }

  return sendMessage(phone, MENSAJES.no_es_imagen);
}

async function handleImage(session: UserSession, imageUrl: string) {
  const phone = session.phone;

  if (session.plan === "gratis" && session.facturasEsteMes >= session.limiteGratis) {
    return sendMessage(phone, MENSAJES.limite_gratis);
  }

  await sendMessage(phone, MENSAJES.procesando);

  const ocrText = await runOCR(imageUrl);
  const { valido: caeValido } = await validarCAE(ocrText);
  const categorizacion = await callLLM(buildCategorizationPrompt(ocrText));

  await guardarFactura(phone, {
    ...categorizacion,
    caeValido,
    fecha: categorizacion.fecha || new Date().toISOString().slice(0, 10),
  });
  await updateSession(phone, { facturasEsteMes: (session.facturasEsteMes || 0) + 1 });

  if (categorizacion.needsReview || !caeValido) {
    return sendMessage(phone, MENSAJES.factura_revisar(categorizacion.proveedor || "este proveedor"));
  }
  return sendMessage(
    phone,
    MENSAJES.factura_ok(categorizacion.proveedor, categorizacion.monto, categorizacion.categoria, (session.facturasEsteMes || 0) + 1)
  );
}

async function enviarResumenMensual(session: UserSession) {
  const phone = session.phone;
  const facturas = await getFacturasDelMes(phone);
  if (facturas.length === 0) return sendMessage(phone, MENSAJES.sin_facturas);

  const mes = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const resumen = await callLLM(buildResumenMensualPrompt(facturas, mes, session.cuit || ""));
  const pdfUrl = await generarPDFResumen(resumen, facturas, session.cuit || "", mes);

  await sendMessage(phone, `📊 Resumen de ${mes} listo — te lo mando en PDF 👇`);
  await sendMedia(phone, pdfUrl);

  if (session.contadorPhone) {
    await sendMedia(session.contadorPhone, pdfUrl, `Resumen de ${session.cuit} — ${mes}`);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Facturas.AI corriendo en puerto ${PORT}`));
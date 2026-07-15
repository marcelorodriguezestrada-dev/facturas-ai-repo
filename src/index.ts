import "dotenv/config";
import express from "express";
import { getOrCreateSession, updateSession, guardarFactura, getFacturasDelMes, UserSession } from "./firebase";
import { sendMessage, sendMedia, getMediaBuffer } from "./whatsapp";
import { runOCR, validarCAE } from "./ocr";
import { callLLM, buildCategorizationPrompt, buildResumenMensualPrompt } from "./prompts";
import { generarPDFResumen } from "./pdf";
import { validarFormatoCUIT } from "./cuit";
import { MENSAJES } from "./messages";

// ── Red de seguridad ──────────────────────────────────────────────────────
// Algunas librerías (como Tesseract, que corre en workers internos) pueden
// tirar errores que se escapan del try/catch normal y tumban todo el proceso
// de Node. Esto loguea el error pero mantiene el servidor vivo, para que un
// problema con LA FOTO DE UN USUARIO no tire abajo el bot para todos los demás.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] Error no capturado, el servidor sigue corriendo:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] Promesa rechazada sin capturar:", reason);
});

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
    const session = await getOrCreateSession(phone);

    if (message.type === "text") {
      await handleText(session, message.text.body);
    } else if (message.type === "image") {
      try {
        const mediaBuffer = await getMediaBuffer(message.image.id);
        await handleImage(session, mediaBuffer);
      } catch (mediaErr) {
        // Si falla la descarga de la imagen (token vencido, media ID expirado, etc.)
        // avisamos al usuario en vez de dejarlo esperando en silencio.
        console.error("[webhook] error descargando la imagen:", mediaErr);
        await sendMessage(phone, "No pude descargar esa imagen 😕 Probá mandarla de nuevo en unos segundos.");
      }
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

async function handleImage(session: UserSession, imageBuffer: Buffer) {
  const phone = session.phone;

  if (session.plan === "gratis" && session.facturasEsteMes >= session.limiteGratis) {
    return sendMessage(phone, MENSAJES.limite_gratis);
  }

  await sendMessage(phone, MENSAJES.procesando);

  try {
    const ocrText = await runOCR(imageBuffer);
    console.log("DEBUG - texto OCR extraído:", ocrText);
    const { valido: caeValido } = await validarCAE(ocrText);
    const categorizacion = await callLLM(buildCategorizationPrompt(ocrText));

    await guardarFactura(phone, {
      ...categorizacion,
      caeValido,
      fecha: categorizacion.fecha || new Date().toISOString().slice(0, 10),
    });
    await updateSession(phone, { facturasEsteMes: (session.facturasEsteMes || 0) + 1 });

    if (categorizacion.needsReview) {
      return sendMessage(phone, MENSAJES.factura_revisar(categorizacion.proveedor || "este proveedor"));
    }
    if (!caeValido) {
      return sendMessage(
        phone,
        MENSAJES.factura_ok_sin_cae(categorizacion.proveedor, categorizacion.monto, categorizacion.categoria, (session.facturasEsteMes || 0) + 1)
      );
    }
    return sendMessage(
      phone,
      MENSAJES.factura_ok(categorizacion.proveedor, categorizacion.monto, categorizacion.categoria, (session.facturasEsteMes || 0) + 1)
    );
  } catch (err) {
    // Si falla el OCR o la categorización (foto ilegible, formato raro, etc.)
    // avisamos al usuario en vez de dejarlo esperando una respuesta que nunca llega.
    console.error("[handleImage] error procesando factura:", err);
    return sendMessage(phone, "No pude leer bien esa imagen 😕 Probá con una foto más nítida, bien iluminada y derecha.");
  }
}

async function enviarResumenMensual(session: UserSession) {
  const phone = session.phone;

  try {
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
  } catch (err) {
    // Causa más común en este MVP: Firebase Storage todavía no está activado
    // (necesita el plan Blaze), así que subirPDFAStorage() falla acá.
    // También puede fallar acá la lectura de Firestore si hay algún problema
    // de permisos o de índice.
    console.error("[enviarResumenMensual] error:", err);
    return sendMessage(
      phone,
      "No pude generar el resumen 😕 (esto suele pasar si todavía no está activado el storage de archivos, o hay un problema leyendo tus facturas — avisale al admin del bot)."
    );
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Facturas.AI corriendo en puerto ${PORT}`));
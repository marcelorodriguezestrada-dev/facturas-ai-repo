import { createWorker } from "tesseract.js";

/**
 * OCR gratuito con Tesseract.js — corre localmente, sin costo por request.
 * Es más lento y menos preciso que un servicio pago (Google Vision, AWS Textract),
 * pero para la prueba gratis alcanza. Si más adelante necesitás más precisión,
 * se puede swapear esta función sin tocar el resto del código.
 */
export async function runOCR(imageBuffer: Buffer): Promise<string> {
  const worker = await createWorker("spa"); // español
  try {
    const {
      data: { text },
    } = await worker.recognize(imageBuffer);
    return text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Validación de CAE — versión MVP gratuita.
 *
 * IMPORTANTE: la validación REAL contra ARCA/AFIP requiere inscribirte como
 * consumidor de su webservice (WSAA + WSFE), que es gratis pero necesita:
 * 1. Un certificado digital (se saca gratis en la web de AFIP con tu CUIT)
 * 2. Autorizar el webservice "wsfe" desde tu clave fiscal
 * Guía oficial: https://www.afip.gob.ar/ws/
 *
 * Para el MVP, esta función solo valida el FORMATO del CAE (14 dígitos numéricos)
 * — no confirma que sea válido ante AFIP. Es suficiente para probar el flujo
 * completo del bot; el chequeo real se agrega en la v2 cuando ya tengas
 * el certificado armado.
 */
export async function validarCAE(ocrText: string): Promise<{ valido: boolean; cae: string | null }> {
  const match = ocrText.match(/CAE[:\s]*N?°?\s*(\d{14})/i) || ocrText.match(/\b(\d{14})\b/);
  const cae = match ? match[1] : null;
  return { valido: !!cae, cae };
}

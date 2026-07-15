import { createWorker } from "tesseract.js";
import sharp from "sharp";

/**
 * Preprocesa la imagen antes del OCR — mejora sustancialmente la precisión
 * de Tesseract en fotos de tickets/facturas sacadas con celular:
 * - Escala de grises + normalización de contraste (ayuda con sombras/reflejos)
 * - Agranda la imagen si es chica (Tesseract lee mejor texto más grande)
 * Esto es lo que suele resolver casos como "se comió el nombre del proveedor"
 * cuando la imagen tiene inclinación, sombras o poco contraste.
 */
async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const targetWidth = Math.max(metadata.width || 1000, 1600);
  return sharp(imageBuffer)
    .resize({ width: targetWidth })
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();
}

/**
 * OCR gratuito con Tesseract.js — corre localmente, sin costo por request.
 * Es más lento y menos preciso que un servicio pago (Google Vision, AWS Textract),
 * pero para la prueba gratis alcanza. Si más adelante necesitás más precisión,
 * se puede swapear esta función sin tocar el resto del código.
 */
export async function runOCR(imageBuffer: Buffer): Promise<string> {
  const processed = await preprocessImage(imageBuffer);
  const worker = await createWorker("spa"); // español
  try {
    // PSM 6 = "bloque uniforme de texto", suele andar mejor que el modo
    // automático por default para tickets/facturas (columna única de texto).
    await worker.setParameters({ tessedit_pageseg_mode: "6" as any });
    const {
      data: { text },
    } = await worker.recognize(processed);
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
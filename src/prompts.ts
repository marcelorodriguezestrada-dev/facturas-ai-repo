import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Modelo gratis de Groq, rápido y suficiente para esta tarea
const MODEL = "llama-3.3-70b-versatile";

export async function callLLM(prompt: string): Promise<any> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });
  let text = completion.choices[0]?.message?.content || "{}";
  text = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("[callLLM] no se pudo parsear JSON:", text);
    return {};
  }
}

export const buildCategorizationPrompt = (ocrText: string, rubroDeclarado?: string) => `
Sos el motor de categorización de Facturas.AI. Tu única tarea es clasificar un comprobante
fiscal argentino en UNA categoría de gasto para monotributistas, a partir del texto extraído por OCR.

TEXTO OCR DEL COMPROBANTE:
"""
${ocrText}
"""

${rubroDeclarado ? `RUBRO DECLARADO POR EL MONOTRIBUTISTA: ${rubroDeclarado}` : ""}

CATEGORÍAS VÁLIDAS (elegí exactamente una):
- Insumos y materiales
- Servicios profesionales contratados
- Alquiler y expensas
- Servicios (luz, gas, internet, telefonía)
- Transporte y combustible
- Viáticos y comidas de trabajo
- Marketing y publicidad
- Software y herramientas digitales
- Equipamiento (bienes de uso)
- Otro / no identificado

REGLAS:
1. Si el texto OCR no tiene información suficiente para decidir con confianza, respondé categoría "Otro / no identificado" y marcá needsReview: true.
2. Extraé también: nombre del proveedor, CUIT del emisor, monto total, y fecha si aparecen.
3. NUNCA inventes datos que no estén explícitamente en el texto — si no aparece, el campo va null.

RESPONDÉ ÚNICAMENTE CON JSON VÁLIDO, SIN MARKDOWN:
{
  "proveedor": "string",
  "cuit_emisor": "string o null",
  "monto": "number",
  "fecha": "YYYY-MM-DD o null",
  "categoria": "una de las categorías de arriba",
  "needsReview": boolean,
  "confianza": "alta" | "media" | "baja"
}
`;

export const buildResumenMensualPrompt = (facturas: any[], mes: string, cuit: string) => `
Sos el generador de resúmenes contables de Facturas.AI. Armá un resumen mensual claro
para un monotributista argentino, a partir de esta lista de facturas ya procesadas.

MES: ${mes}
CUIT: ${cuit}
FACTURAS (JSON):
${JSON.stringify(facturas, null, 2)}

Generá:
1. Total facturado del mes, desglosado por categoría (suma y % del total)
2. Lista de facturas con CAE inválido o needsReview:true en una sección separada "Requiere atención"
3. Una alerta si el total se acerca al límite de facturación de monotributo (opcional, solo si aplica)

RESPONDÉ ÚNICAMENTE CON JSON VÁLIDO, SIN MARKDOWN:
{
  "total_mes": "number",
  "por_categoria": [{"categoria": "string", "monto": "number", "porcentaje": "number"}],
  "requiere_atencion": [{"proveedor": "string", "monto": "number", "motivo": "string"}],
  "alerta_recategorizacion": "string o null"
}
`;

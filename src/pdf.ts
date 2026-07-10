// @ts-ignore — pdfmake no trae tipos perfectos para esta forma de uso
import PdfPrinter from "pdfmake";
import { subirPDFAStorage } from "./firebase";

const FONTS = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

export async function generarPDFResumen(
  resumen: {
    total_mes: number;
    por_categoria: { categoria: string; monto: number; porcentaje: number }[];
    requiere_atencion: { proveedor: string; monto: number; motivo: string }[];
    alerta_recategorizacion: string | null;
  },
  facturas: any[],
  cuit: string,
  mes: string
): Promise<string> {
  const printer = new PdfPrinter(FONTS);

  const docDefinition = {
    pageMargins: [40, 60, 40, 60] as [number, number, number, number],
    content: [
      { text: "Facturas.AI", style: "brand" },
      { text: `Resumen de ${mes}`, style: "title" },
      { text: `CUIT: ${cuit}`, style: "subtitle", margin: [0, 0, 0, 20] as [number, number, number, number] },
      {
        columns: [
          { text: "Total facturado", style: "label" },
          { text: `$${resumen.total_mes.toLocaleString("es-AR")}`, style: "totalValue", alignment: "right" },
        ],
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      { text: "Desglose por categoría", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "auto", "auto"],
          body: [
            [{ text: "Categoría", style: "tableHeader" }, { text: "Monto", style: "tableHeader" }, { text: "%", style: "tableHeader" }],
            ...resumen.por_categoria.map((c) => [c.categoria, `$${c.monto.toLocaleString("es-AR")}`, `${c.porcentaje.toFixed(1)}%`]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      ...(resumen.requiere_atencion.length > 0
        ? [
            { text: "Requiere atención", style: "sectionHeaderAlert" },
            {
              table: {
                widths: ["*", "auto", "*"],
                body: [
                  [{ text: "Proveedor", style: "tableHeader" }, { text: "Monto", style: "tableHeader" }, { text: "Motivo", style: "tableHeader" }],
                  ...resumen.requiere_atencion.map((r) => [r.proveedor, `$${r.monto.toLocaleString("es-AR")}`, r.motivo]),
                ],
              },
              layout: "lightHorizontalLines",
              margin: [0, 0, 0, 20] as [number, number, number, number],
            },
          ]
        : []),
      ...(resumen.alerta_recategorizacion ? [{ text: resumen.alerta_recategorizacion, style: "alertBox" }] : []),
      { text: "Detalle de facturas", style: "sectionHeader", pageBreak: "before" as const },
      {
        table: {
          widths: ["auto", "*", "auto", "auto", "auto"],
          body: [
            [
              { text: "Fecha", style: "tableHeader" },
              { text: "Proveedor", style: "tableHeader" },
              { text: "Categoría", style: "tableHeader" },
              { text: "Monto", style: "tableHeader" },
              { text: "CAE", style: "tableHeader" },
            ],
            ...facturas.map((f) => [
              f.fecha || "-",
              f.proveedor || "-",
              f.categoria || "-",
              `$${(f.monto || 0).toLocaleString("es-AR")}`,
              f.caeValido ? "OK" : "!",
            ]),
          ],
        },
        layout: "lightHorizontalLines",
      },
    ],
    styles: {
      brand: { fontSize: 10, color: "#F5A623", bold: true, margin: [0, 0, 0, 4] as [number, number, number, number] },
      title: { fontSize: 20, bold: true, margin: [0, 0, 0, 2] as [number, number, number, number] },
      subtitle: { fontSize: 10, color: "#666666" },
      label: { fontSize: 12, color: "#666666" },
      totalValue: { fontSize: 18, bold: true },
      sectionHeader: { fontSize: 13, bold: true, margin: [0, 10, 0, 8] as [number, number, number, number] },
      sectionHeaderAlert: { fontSize: 13, bold: true, color: "#E24B4A", margin: [0, 10, 0, 8] as [number, number, number, number] },
      tableHeader: { fontSize: 10, bold: true, color: "#333333" },
      alertBox: { fontSize: 10, color: "#8A6D00", italics: true, margin: [0, 0, 0, 20] as [number, number, number, number] },
    },
    defaultStyle: { font: "Helvetica", fontSize: 10 },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", async () => {
      const buffer = Buffer.concat(chunks);
      const url = await subirPDFAStorage(buffer, `resumenes/${cuit}/${mes}.pdf`);
      resolve(url);
    });
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

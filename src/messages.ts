export const MENSAJES = {
  bienvenida: () => `¡Hola! 👋 Soy el asistente de Facturas.AI.

A partir de ahora, cada vez que generes o recibas una factura, mandame la foto acá mismo. Yo me encargo de:
✓ Leer el comprobante automáticamente
✓ Categorizar el gasto
✓ Armarte un resumen mensual listo para tu contador

¿Empezamos?`,

  pedir_cuit: `Antes de arrancar, necesito tu CUIT.

Mandámelo así: 20-12345678-9`,

  cuit_invalido: `Ese CUIT no me cierra el dígito verificador 🤔 ¿Lo podés revisar y mandar de nuevo? Formato: 20-12345678-9`,

  cuit_ok: (cuit: string) =>
    `Perfecto, quedaste registrado con CUIT ${cuit} ✓

¿Tenés contador/a? Si me pasás su WhatsApp, le mando el resumen mensual directo a él/ella también. Si no, escribí *LISTO*.`,

  contador_vinculado: `Listo, tu contador/a va a recibir una copia del resumen todos los meses 📎

Ya podés mandarme fotos de tus facturas cuando quieras 📸`,

  onboarding_completo: `Todo listo ✓ Mandame tu primera factura cuando quieras 📸`,

  procesando: `Recibido, dame unos segundos... 🔍`,

  factura_ok: (proveedor: string, monto: number, categoria: string, count: number) =>
    `✅ Factura procesada
Proveedor: ${proveedor}
Monto: $${monto.toLocaleString("es-AR")}
Categoría: ${categoria}

Van ${count} facturas este mes.`,

  factura_revisar: (proveedor: string) =>
    `⚠️ La factura de ${proveedor} necesita revisión manual (no pude leerla con confianza). La guardé igual, marcada como "pendiente".`,

  limite_gratis: `Llegaste a las 15 facturas gratis de este mes 🎉

Por ahora este es un MVP de prueba, así que no hay plan pago todavía — pero avisame si necesitás seguir cargando y vemos cómo lo resolvemos.`,

  no_es_imagen: `Mandame una *foto* de la factura o ticket (por ahora no proceso texto ni PDF).`,

  sin_facturas: `No tenés facturas cargadas este mes todavía 🤔`,

  ayuda: `Comandos disponibles:
📸 Mandá una foto → la proceso automáticamente
*RESUMEN* → te mando el resumen del mes actual
*AYUDA* → este mensaje`,
};

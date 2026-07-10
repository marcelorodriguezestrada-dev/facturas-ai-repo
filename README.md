# Facturas.AI — MVP gratuito

Bot de WhatsApp que lee facturas por foto, las categoriza con IA y arma un resumen
mensual en PDF para monotributistas. Este repo está armado para correr **100% gratis**
mientras estás probando.

## Stack usado (todo con capa gratuita)

| Pieza | Servicio | Costo |
|---|---|---|
| WhatsApp | Meta WhatsApp Cloud API | Gratis hasta 1000 conversaciones/mes |
| Hosting del bot | Render (free web service) | Gratis (se duerme sin uso, tarda ~30s en despertar) |
| Base de datos | Firebase Firestore (plan Spark) | Gratis |
| Storage de PDFs | Firebase Storage (plan Spark) | Gratis hasta 5GB |
| LLM (categorización) | Groq API | Gratis, con rate limit |
| OCR | Tesseract.js | Gratis, corre local, sin API |

**Importante sobre el CAE:** la validación real contra ARCA/AFIP requiere que te
inscribas como consumidor de su webservice (gratis, pero necesita certificado digital
con tu CUIT — guía en https://www.afip.gob.ar/ws/). En este MVP, `validarCAE()` solo
chequea el *formato* del número (14 dígitos) para poder probar el flujo completo del
bot sin trabarte en ese setup. Lo dejé comentado en `src/ocr.ts` para que sepas dónde
enchufar la validación real después.

## Setup — paso a paso

### 1. Clonar y instalar
```bash
git clone <tu-repo>
cd facturas-ai
npm install
cp .env.example .env
```

### 2. WhatsApp (Meta Cloud API) — gratis
1. Andá a https://developers.facebook.com/apps y creá una app tipo "Business"
2. Agregale el producto "WhatsApp"
3. En "API Setup" te dan un número de prueba gratis y un token temporal (dura 24hs — para producción hay que generar uno permanente, pero para probar alcanza)
4. Copiá `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` a tu `.env`
5. Inventate cualquier palabra para `WHATSAPP_VERIFY_TOKEN` (la vas a necesitar en el paso 5)

### 3. Groq (LLM gratis)
1. Andá a https://console.groq.com/keys
2. Creá una API key gratis
3. Copiala a `GROQ_API_KEY`

### 4. Firebase (gratis, plan Spark)
1. Andá a https://console.firebase.google.com y creá un proyecto
2. Activá **Firestore Database** y **Storage** (modo de prueba está bien para arrancar)
3. Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada (descarga un JSON)
4. De ese JSON copiá `project_id`, `client_email` y `private_key` a tu `.env`
   (el `private_key` viene con saltos de línea `\n` — dejalo tal cual, el código ya lo maneja)

### 5. Deploy en Render (gratis)
1. Subí este repo a GitHub (ver comandos abajo)
2. Andá a https://render.com → New → Web Service → conectá tu repo
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Agregá todas las variables de tu `.env` en la sección "Environment" de Render
6. Deploy. Te va a dar una URL tipo `https://facturas-ai.onrender.com`

### 6. Conectar el webhook de WhatsApp
1. Volvé a Meta for Developers → WhatsApp → Configuration
2. Callback URL: `https://TU-URL-DE-RENDER.onrender.com/webhook`
3. Verify token: el mismo que pusiste en `WHATSAPP_VERIFY_TOKEN`
4. Suscribite al campo `messages`

Listo — mandale un WhatsApp al número de prueba y el bot te va a responder.

## Subir esto a tu GitHub

Este proyecto ya tiene `git init` corrido. Solo te falta crear el repo vacío en
GitHub y pushear:

```bash
git add .
git commit -m "Facturas.AI - MVP inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/facturas-ai.git
git push -u origin main
```

(Creá el repo vacío primero en https://github.com/new — sin README ni .gitignore,
para que no choque con lo que ya está acá)

## Estructura del proyecto

```
src/
  index.ts       → servidor Express + webhook de WhatsApp (el punto de entrada)
  firebase.ts     → sesiones de usuario, guardar facturas, subir PDFs
  whatsapp.ts     → mandar mensajes y descargar imágenes de Meta
  ocr.ts          → lectura de texto de la factura + validación de CAE (formato)
  prompts.ts       → prompts del LLM (categorización + resumen mensual) + llamada a Groq
  pdf.ts          → generación del PDF de resumen mensual
  messages.ts      → todos los textos que manda el bot
  cuit.ts         → validación de CUIT con dígito verificador real
```

## Límites de este MVP (a tener en cuenta)

- El plan Render free "duerme" el servicio después de un rato sin uso — el primer
  mensaje después de la inactividad puede tardar ~30 segundos en responder.
- Tesseract.js (OCR gratis) es más lento y menos preciso que un servicio pago —
  para fotos borrosas puede fallar. Si en la prueba con usuarios reales esto es un
  problema, ahí vale la pena evaluar un OCR pago.
- La validación de CAE es de formato, no contra AFIP real (ver nota arriba).
- El token de WhatsApp del setup rápido dura 24hs — para dejarlo corriendo más
  tiempo sin tocar nada, hay que generar un token de sistema permanente (gratis,
  pero requiere verificar tu Business Manager).

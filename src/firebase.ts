import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // El private key viene con \n literales en el .env, hay que reemplazarlos
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
    storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
  });
}

export const db = admin.firestore();
export const bucket = admin.storage().bucket();

export interface UserSession {
  phone: string;
  state: "nuevo" | "pidiendo_cuit" | "pidiendo_contador" | "esperando_foto" | "procesando";
  cuit?: string;
  plan: "gratis" | "pago" | "contador";
  facturasEsteMes: number;
  limiteGratis: number;
  contadorPhone?: string;
}

export async function getOrCreateSession(phone: string): Promise<UserSession> {
  const ref = db.collection("sessions").doc(phone);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as UserSession;

  const nueva: UserSession = {
    phone,
    state: "nuevo",
    plan: "gratis",
    facturasEsteMes: 0,
    limiteGratis: 15,
  };
  await ref.set(nueva);
  return nueva;
}

export async function updateSession(phone: string, patch: Partial<UserSession>) {
  await db.collection("sessions").doc(phone).set(patch, { merge: true });
}

export async function guardarFactura(phone: string, data: any) {
  const mesActual = new Date().toISOString().slice(0, 7); // "2026-07"
  await db
    .collection("sessions")
    .doc(phone)
    .collection("facturas")
    .doc(mesActual)
    .collection("items")
    .add({ ...data, creadoEn: admin.firestore.FieldValue.serverTimestamp() });
}

export async function getFacturasDelMes(phone: string, mes?: string) {
  const mesActual = mes || new Date().toISOString().slice(0, 7);
  const snap = await db
    .collection("sessions")
    .doc(phone)
    .collection("facturas")
    .doc(mesActual)
    .collection("items")
    .get();
  return snap.docs.map((d) => d.data());
}

export async function subirPDFAStorage(buffer: Buffer, path: string): Promise<string> {
  const file = bucket.file(path);
  await file.save(buffer, { contentType: "application/pdf" });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}

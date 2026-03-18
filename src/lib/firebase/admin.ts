import * as admin from "firebase-admin";

function getApp() {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

export function getFirestoreAdmin() {
  return admin.firestore(getApp());
}

export function getAuthAdmin() {
  return admin.auth(getApp());
}

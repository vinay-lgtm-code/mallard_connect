import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Sequence supports running entirely without Firebase config — the demo path
// uses local mock data, so dev environments without a `.env.local` should boot
// cleanly. Real auth/db calls only happen when the user is signed in via
// Firebase, and useAuth/use-realtime guard those paths via isFirebaseConfigured.
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  _auth = getAuth(_app);
  _db = getFirestore(_app);
  _storage = getStorage(_app);
}

// Cast to non-null so existing callers don't need guards everywhere — but
// real callers must check isFirebaseConfigured (or be inside demo mode) before
// using these. Touching them when unconfigured throws.
export const app = _app as FirebaseApp;
export const auth = _auth as Auth;
export const db = _db as Firestore;
export const storage = _storage as FirebaseStorage;

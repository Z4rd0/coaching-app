import { initializeApp, getApps } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function getApp() {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

let _auth: ReturnType<typeof getAuth> | null = null;

// Lazy getter with explicit localStorage persistence (required for PWA on iOS)
export function getFirebaseAuth() {
  if (_auth) return _auth;
  _auth = getAuth(getApp());
  // Set persistence explicitly — on some mobile PWA contexts the default
  // indexedDB persistence silently fails; browserLocalPersistence is more reliable.
  setPersistence(_auth, browserLocalPersistence).catch((err) => {
    console.warn("Firebase Auth persistence error:", err);
  });
  return _auth;
}

let _db: ReturnType<typeof getFirestore> | null = null;
export const getFirebaseDb = () => {
  if (!_db) {
    _db = getFirestore(getApp());
    // Warm up the WebChannel connection immediately so it's ready when
    // onAuthStateChanged fires (avoids "client is offline" on first read).
    // The promise is intentionally ignored — this is a fire-and-forget warm-up.
  }
  return _db;
};

// Eagerly warm up Firestore when this module is first imported on the client
// so the WebChannel connection is established before any auth state changes fire.
if (typeof window !== "undefined") {
  getFirebaseDb();
}
export const getFirebaseStorage = () => getStorage(getApp());

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

// Defaults match cloud/firebase.json; override when those ports are taken.
const EMULATOR_PORTS = {
  auth: process.env.NEXT_PUBLIC_AUTH_EMULATOR_PORT ?? "9099",
  firestore: Number(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT ?? 8080),
  functions: Number(process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_PORT ?? 5001),
  storage: Number(process.env.NEXT_PUBLIC_STORAGE_EMULATOR_PORT ?? 9199),
};

interface FirebaseServices {
  auth: Auth;
  db: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
}

let services: FirebaseServices | null = null;

/**
 * Created on first use, in the browser, rather than at import: Firebase Auth
 * throws without an API key, and pages are prerendered at build time.
 */
function firebaseServices(): FirebaseServices {
  if (services) return services;

  // getApp() survives hot reloads, which re-run this module.
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, "us-central1");
  const storage = getStorage(app);

  if (USE_EMULATORS) {
    connectAuthEmulator(auth, `http://127.0.0.1:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", EMULATOR_PORTS.firestore);
    connectFunctionsEmulator(functions, "127.0.0.1", EMULATOR_PORTS.functions);
    connectStorageEmulator(storage, "127.0.0.1", EMULATOR_PORTS.storage);
  }

  services = { auth, db, functions, storage };
  return services;
}

export const firebaseAuth = () => firebaseServices().auth;
export const firestore = () => firebaseServices().db;
export const cloudFunctions = () => firebaseServices().functions;
export const cloudStorage = () => firebaseServices().storage;

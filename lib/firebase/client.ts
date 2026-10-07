"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

export const usingEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

interface Clients {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

// Survives Fast Refresh: Firestore can only be initialized once per app.
const globalForFirebase = globalThis as unknown as { __ilhamFirebase?: Clients };

/** Lazily creates the browser SDK clients. Call from effects and event handlers only. */
export function firebase(): Clients {
  if (globalForFirebase.__ilhamFirebase) return globalForFirebase.__ilhamFirebase;

  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    localCache: usingEmulators
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const storage = getStorage(app);

  if (usingEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }

  globalForFirebase.__ilhamFirebase = { app, auth, db, storage };
  return globalForFirebase.__ilhamFirebase;
}

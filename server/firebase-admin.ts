import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { initializeFirestore, type Firestore } from "firebase-admin/firestore";

const usingEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

interface Admin {
  app: App;
  auth: Auth;
  db: Firestore;
}

// Survives dev reloads: Firestore settings can only be applied once per app.
const globalForAdmin = globalThis as unknown as { __ilhamAdmin?: Admin };

/**
 * Admin SDK for route handlers. Works on the free Spark plan: Firestore and Auth token checks
 * need no billing. Credentials come from FIREBASE_SERVICE_ACCOUNT (the service account JSON,
 * raw or base64), or from the local emulators when NEXT_PUBLIC_USE_EMULATORS=true.
 */
export function admin(): Admin {
  if (globalForAdmin.__ilhamAdmin) return globalForAdmin.__ilhamAdmin;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  let app = getApps()[0];
  if (!app && usingEmulators) {
    process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
    app = initializeApp({ projectId });
  } else if (!app) {
    app = initializeApp({ credential: cert(serviceAccount()), projectId });
  }

  // REST instead of gRPC: much faster cold starts on serverless, and the server never listens.
  // (The emulator path needs gRPC: over REST the client still goes looking for Google credentials.)
  const db = initializeFirestore(app, { preferRest: !usingEmulators });
  db.settings({ ignoreUndefinedProperties: true });

  globalForAdmin.__ilhamAdmin = { app, auth: getAuth(app), db };
  return globalForAdmin.__ilhamAdmin;
}

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
  return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
}

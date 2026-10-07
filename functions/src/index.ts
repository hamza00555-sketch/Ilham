import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
getFirestore().settings({ ignoreUndefinedProperties: true });

// us-central1 keeps Storage inside the no-cost tier; see docs/PLAN.md §2.
setGlobalOptions({ region: "us-central1", maxInstances: 5 });

export { ingestItem } from "./ingest/trigger";
export { syncProjectStats } from "./stats";

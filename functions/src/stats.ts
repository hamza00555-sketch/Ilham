import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import type { CoverTile, Item } from "../../shared/types";

/** Keeps each project's counts and 4-image cover in sync with its items. */
export const syncProjectStats = onDocumentWritten("users/{uid}/items/{itemId}", async (event) => {
  const before = event.data?.before?.data() as Item | undefined;
  const after = event.data?.after?.data() as Item | undefined;

  const relevant =
    !before ||
    !after ||
    before.status !== after.status ||
    before.projectId !== after.projectId ||
    (before.ingest === "ready") !== (after.ingest === "ready") ||
    before.preview?.w640 !== after.preview?.w640;
  if (!relevant) return;

  const projectIds = new Set([before?.projectId, after?.projectId].filter(Boolean) as string[]);
  await Promise.all([...projectIds].map((pid) => recompute(event.params.uid, pid)));
});

async function recompute(uid: string, projectId: string) {
  const db = getFirestore();
  const items = db.collection(`users/${uid}/items`).where("projectId", "==", projectId);

  const [kept, inbox, recent] = await Promise.all([
    items.where("status", "==", "kept").count().get(),
    items.where("status", "==", "inbox").count().get(),
    items.where("status", "==", "kept").orderBy("addedAt", "desc").limit(12).get(),
  ]);

  const cover: CoverTile[] = recent.docs
    .map((d) => d.data() as Item)
    .filter((i) => i.ingest === "ready" && i.preview)
    .slice(0, 4)
    .map((i) => ({
      url: i.preview!.w640,
      lqip: i.preview!.lqip,
      color: i.preview!.dominantColor,
      tall: i.preview!.height / i.preview!.width > 0.8,
    }));

  try {
    await db.doc(`users/${uid}/projects/${projectId}`).update({
      counts: { kept: kept.data().count, inbox: inbox.data().count },
      cover,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Project was deleted while its items were being cleaned up.
    if ((err as { code?: number }).code === 5) return;
    throw err;
  }
}

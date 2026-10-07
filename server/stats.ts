import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { CoverTile, Item } from "@/shared/types";
import { admin } from "./firebase-admin";

/** Recomputes counts and the 4-image cover of each project, after anything that changes them. */
export async function syncProjects(uid: string, projectIds: Iterable<string>) {
  await Promise.all([...new Set(projectIds)].map((pid) => recompute(uid, pid)));
}

async function recompute(uid: string, projectId: string) {
  const { db } = admin();
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
    // The project was deleted while its items were being cleaned up.
    if ((err as { code?: number }).code === 5) return;
    throw err;
  }
}

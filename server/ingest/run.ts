import "server-only";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { mergeTools } from "@/shared/credits";
import { searchTokens } from "@/shared/normalize";
import type { IngestState, Item, Preview } from "@/shared/types";
import { putPublic } from "../blob";
import { admin } from "../firebase-admin";
import { syncProjects } from "../stats";
import { processImage } from "./image";
import { resolveLink, type IngestErrorCode } from "./pipeline";

/** A "processing" item older than this was abandoned (the request died), so it can be claimed again. */
const STALE_MS = 3 * 60_000;

type IngestUpdate = Partial<Item> & Pick<Item, "ingest" | "ingestError">;

/**
 * Turns an item's link into title/author + WebP previews, then refreshes its project's cover.
 * Runs when the item is "queued" (new, retry, new preview URL), or right away for an uploaded
 * image. Two calls for the same item can't both run: the claim is a transaction.
 */
export async function runIngest(
  uid: string,
  itemId: string,
  upload: Buffer | null = null,
): Promise<{ state: IngestState | "skipped" }> {
  const { db } = admin();
  const ref = db.doc(`users/${uid}/items/${itemId}`);

  const item = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const data = snap.data() as Item;
    const touched = (data.updatedAt as Timestamp | undefined)?.toMillis?.() ?? 0;
    const claimable =
      upload !== null ||
      data.ingest === "queued" ||
      (data.ingest === "processing" && Date.now() - touched > STALE_MS);
    if (!claimable) return null;
    tx.update(ref, { ingest: "processing", ingestError: null, updatedAt: FieldValue.serverTimestamp() });
    return data;
  });
  if (!item) return { state: "skipped" };

  let update: IngestUpdate;
  try {
    update = (upload ? null : await reuseExisting(uid, item, itemId)) ?? (await ingestFresh(uid, item, upload));
    console.info("ingested", { itemId, state: update.ingest, error: update.ingestError });
  } catch (err) {
    console.error("ingest failed", { itemId, err });
    update = { ingest: "failed", ingestError: "internal" };
  }
  await ref.update({ ...update, updatedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
  await syncProjects(uid, [item.projectId]).catch((err) => console.error("sync failed", err));
  return { state: update.ingest };
}

/** Same link already processed in another project → copy its result, no network calls. */
async function reuseExisting(uid: string, item: Item, selfId: string): Promise<IngestUpdate | null> {
  if (item.hints?.imageUrl || item.hints?.videoUrl) return null;
  const snap = await admin()
    .db.collection(`users/${uid}/items`)
    .where("urlHash", "==", item.urlHash)
    .where("ingest", "==", "ready")
    .limit(2)
    .get();
  const source = snap.docs.find((d) => d.id !== selfId)?.data() as Item | undefined;
  if (!source?.preview) return null;
  return {
    title: source.title,
    authorName: source.authorName ?? item.authorName,
    authorUrl: source.authorUrl ?? item.authorUrl,
    description: source.description ?? item.description ?? null,
    publishedAt: source.publishedAt ?? item.publishedAt ?? null,
    tools: mergeTools(source.tools, item.tools),
    process: item.process ?? source.process ?? null,
    mediaType: source.mediaType,
    preview: source.preview,
    colorBuckets: source.colorBuckets,
    searchTokens: source.searchTokens,
    ingest: "ready",
    ingestError: null,
  };
}

async function ingestFresh(uid: string, item: Item, upload: Buffer | null): Promise<IngestUpdate> {
  const resolved = await resolveLink(item.sourceUrl, item.platform, item.hints, {
    upload,
    useMicrolink: process.env.MICROLINK_DISABLED !== "true",
    useReader: process.env.READER_DISABLED !== "true",
  });

  // The page's own credits win; what an agent already told us fills the gaps.
  const authorName = resolved.authorName ?? item.authorName;
  const tools = mergeTools(resolved.tools, item.tools);
  const base: IngestUpdate = {
    title: resolved.title,
    authorName,
    authorUrl: resolved.authorUrl ?? item.authorUrl,
    description: resolved.description ?? item.description ?? null,
    publishedAt: resolved.publishedAt ?? item.publishedAt ?? null,
    tools,
    mediaType: resolved.mediaType,
    searchTokens: searchTokens(resolved.title, authorName, ...tools, ...(item.tags ?? [])),
    ingest: "failed",
    ingestError: resolved.error,
  };
  if (!resolved.image) return base;

  let processed;
  try {
    processed = await processImage(resolved.image);
  } catch {
    return { ...base, ingestError: "invalid-image" satisfies IngestErrorCode };
  }

  const folder = `users/${uid}/previews/${item.urlHash}`;
  const [w640, w1280, video] = await Promise.all([
    putPublic(`${folder}/640.webp`, processed.w640, "image/webp"),
    putPublic(`${folder}/1280.webp`, processed.w1280, "image/webp"),
    resolved.video
      ? putPublic(
          `${folder}/loop.${resolved.video.contentType === "video/webm" ? "webm" : "mp4"}`,
          resolved.video.data,
          resolved.video.contentType,
        )
      : Promise.resolve(null),
  ]);

  const preview: Preview = {
    w640,
    w1280,
    width: processed.width,
    height: processed.height,
    lqip: processed.lqip,
    dominantColor: processed.dominantColor,
    palette: processed.palette,
    video,
  };
  return {
    ...base,
    preview,
    colorBuckets: processed.colorBuckets,
    hints: null,
    ingest: "ready",
    ingestError: null,
  };
}

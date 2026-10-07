import { randomUUID } from "node:crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { searchTokens } from "../../../shared/normalize";
import type { Item, Preview } from "../../../shared/types";
import { processImage } from "./image";
import { resolveLink, type IngestErrorCode } from "./pipeline";

/**
 * Runs whenever an item's `ingest` becomes "queued": on create, and when the UI asks for a retry
 * or a new preview. Turns the link into title/author + WebP previews in Cloud Storage.
 */
export const ingestItem = onDocumentWritten(
  { document: "users/{uid}/items/{itemId}", memory: "1GiB", timeoutSeconds: 120, concurrency: 4 },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const item = after.data() as Item;
    const before = event.data?.before?.data() as Item | undefined;
    if (item.ingest !== "queued" || before?.ingest === "queued") return;

    const db = getFirestore();
    const ref = after.ref;
    const { uid } = event.params;

    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.get("ingest") !== "queued") return false;
      tx.update(ref, { ingest: "processing", updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) return;

    try {
      const update = (await reuseExisting(uid, item, ref.id)) ?? (await ingestFresh(uid, item));
      await ref.update({ ...update, updatedAt: FieldValue.serverTimestamp() });
      logger.info("ingested", { itemId: ref.id, state: update.ingest, error: update.ingestError });
    } catch (err) {
      logger.error("ingest failed", { itemId: ref.id, err });
      await ref
        .update({ ingest: "failed", ingestError: "internal", updatedAt: FieldValue.serverTimestamp() })
        .catch(() => undefined);
    }
  },
);

type IngestUpdate = Partial<Item> & Pick<Item, "ingest" | "ingestError">;

/** Same link already processed in another project → copy its result, no network calls. */
async function reuseExisting(uid: string, item: Item, selfId: string): Promise<IngestUpdate | null> {
  if (item.hints?.imageUrl || item.hints?.imagePath || item.hints?.videoUrl) return null;
  const snap = await getFirestore()
    .collection(`users/${uid}/items`)
    .where("urlHash", "==", item.urlHash)
    .where("ingest", "==", "ready")
    .limit(2)
    .get();
  const source = snap.docs.find((d) => d.id !== selfId)?.data() as Item | undefined;
  if (!source?.preview) return null;
  return {
    title: source.title,
    authorName: source.authorName,
    authorUrl: source.authorUrl,
    mediaType: source.mediaType,
    preview: source.preview,
    colorBuckets: source.colorBuckets,
    searchTokens: source.searchTokens,
    ingest: "ready",
    ingestError: null,
  };
}

async function ingestFresh(uid: string, item: Item): Promise<IngestUpdate> {
  const bucket = getStorage().bucket();
  const resolved = await resolveLink(item.sourceUrl, item.platform, item.hints, {
    readUpload: async (path) => {
      if (!path.startsWith(`users/${uid}/uploads/`)) throw new Error("Upload outside user folder");
      const [buf] = await bucket.file(path).download();
      return buf;
    },
    useMicrolink: process.env.MICROLINK_DISABLED !== "true",
  });

  const base: IngestUpdate = {
    title: resolved.title,
    authorName: resolved.authorName,
    authorUrl: resolved.authorUrl,
    mediaType: resolved.mediaType,
    searchTokens: searchTokens(resolved.title, resolved.authorName, ...(item.tags ?? [])),
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

  // Versioned folder: re-processing never invalidates URLs other projects already use.
  const folder = `users/${uid}/previews/${item.urlHash}/${randomUUID().slice(0, 8)}`;
  const upload = async (name: string, data: Buffer, contentType = "image/webp") => {
    const path = `${folder}/${name}`;
    const token = randomUUID();
    await bucket.file(path).save(data, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    return downloadUrl(bucket.name, path, token);
  };
  const [w640, w1280, video] = await Promise.all([
    upload("640.webp", processed.w640),
    upload("1280.webp", processed.w1280),
    resolved.video
      ? upload(resolved.video.contentType === "video/webm" ? "loop.webm" : "loop.mp4", resolved.video.data, resolved.video.contentType)
      : Promise.resolve(null),
  ]);

  if (item.hints?.imagePath) {
    await bucket.file(item.hints.imagePath).delete().catch(() => undefined);
  }

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

/**
 * Token download URL, built locally instead of via getDownloadURL() (saves a metadata round-trip,
 * and works the same against the Storage emulator). Token URLs are served regardless of rules.
 */
function downloadUrl(bucket: string, path: string, token: string) {
  const emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const origin = emulator ? `http://${emulator.replace(/^https?:\/\//, "")}` : "https://firebasestorage.googleapis.com";
  return `${origin}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

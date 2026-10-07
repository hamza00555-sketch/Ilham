import { errorResponse, HttpError, requireUser } from "@/server/auth";
import { runIngest } from "@/server/ingest/run";

// Page fetch, an occasional Microlink fallback and image processing: usually a few seconds.
export const maxDuration = 60;

const ITEM_ID = /^[\w-]{1,64}__[a-f0-9]{64}$/;
// Vercel caps request bodies at 4.5 MB; the browser shrinks bigger screenshots before sending.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Ingests one item. JSON `{ itemId }` for a queued item, or multipart `itemId` + `file` to use an
 * uploaded image as its preview.
 */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);

    let itemId: unknown;
    let upload: Buffer | null = null;
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const form = await request.formData();
      itemId = form.get("itemId");
      const file = form.get("file");
      if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_UPLOAD_BYTES) {
        throw new HttpError(400, "invalid-upload");
      }
      upload = Buffer.from(await file.arrayBuffer());
    } else {
      ({ itemId } = (await request.json().catch(() => ({}))) as { itemId?: unknown });
    }
    if (typeof itemId !== "string" || !ITEM_ID.test(itemId)) throw new HttpError(400, "invalid-item");

    return Response.json(await runIngest(uid, itemId, upload));
  } catch (err) {
    return errorResponse(err);
  }
}

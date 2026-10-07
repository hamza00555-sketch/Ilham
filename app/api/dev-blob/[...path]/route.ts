import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEV_BLOB_DIR } from "@/server/blob";

const TYPES: Record<string, string> = { ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm" };

/** Serves previews stored on disk during local development (no Blob store). Off everywhere else. */
export async function GET(_request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (process.env.NEXT_PUBLIC_USE_EMULATORS !== "true") return new Response(null, { status: 404 });

  const { path: parts } = await ctx.params;
  const file = path.join(DEV_BLOB_DIR, ...parts);
  if (!file.startsWith(DEV_BLOB_DIR + path.sep)) return new Response(null, { status: 404 });

  const data = await readFile(file).catch(() => null);
  if (!data) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

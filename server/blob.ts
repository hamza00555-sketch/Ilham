import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

/** Where local development keeps files when there is no Blob store (served by /api/dev-blob). */
export const DEV_BLOB_DIR = path.join(process.cwd(), ".blobs");

/**
 * Stores a public, immutable file and returns its URL. Vercel Blob in production (free on Hobby:
 * 1 GB); a local folder in development. Every call gets a fresh random name, so a URL that
 * another item already points at never changes underneath it.
 */
export async function putPublic(pathname: string, data: Buffer, contentType: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(pathname, data, {
      access: "public",
      contentType,
      addRandomSuffix: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return blob.url;
  }

  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_USE_EMULATORS !== "true") {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set: connect a Blob store to the Vercel project");
  }
  const ext = path.extname(pathname);
  const name = `${pathname.slice(0, pathname.length - ext.length)}-${randomUUID().slice(0, 8)}${ext}`;
  const file = path.join(DEV_BLOB_DIR, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return `/api/dev-blob/${name}`;
}

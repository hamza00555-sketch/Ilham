import type { IngestHints, MediaType, Platform } from "../../../shared/types";
import { titleFromUrl } from "../../../shared/normalize";
import { cleanTitle, extractViaApi } from "./extractors";
import { parseHtml } from "./metadata";
import { microlink } from "./microlink";
import { looksBlocked, safeFetch } from "./safeFetch";

export type IngestErrorCode = "blocked" | "no-image" | "fetch-failed" | "invalid-image";

/** Videos above this are left as stills; loops should stay light enough to start on hover. */
export const MAX_VIDEO_BYTES = 12 * 1024 * 1024;

export interface ResolvedVideo {
  data: Buffer;
  contentType: "video/mp4" | "video/webm";
}

export interface Resolved {
  title: string;
  authorName: string | null;
  authorUrl: string | null;
  mediaType: MediaType;
  image: Buffer | null;
  /** A short muted loop to play on hover, when the source offers a real video file. */
  video: ResolvedVideo | null;
  /** Why there is no image, when there isn't one. */
  error: IngestErrorCode | null;
}

interface Deps {
  readUpload?: (path: string) => Promise<Buffer>;
  useMicrolink?: boolean;
}

/**
 * Works out title/author/media type and downloads the best preview image for a link.
 * Order: uploaded image hint → platform API (YouTube, Vimeo) → page metadata → image hint → Microlink.
 */
export async function resolveLink(
  url: string,
  platform: Platform,
  hints: IngestHints | null,
  deps: Deps = {},
): Promise<Resolved> {
  const useMicrolink = deps.useMicrolink ?? true;
  let title: string | undefined;
  let authorName: string | undefined;
  let authorUrl: string | undefined;
  let mediaType: MediaType = "image";
  const imageCandidates: string[] = [];
  const videoCandidates: string[] = [];
  let blocked = false;
  let directImage: Buffer | null = null;
  let directVideo: ResolvedVideo | null = null;

  const api = await extractViaApi(url, platform);
  if (api) {
    ({ title, authorName, authorUrl } = api);
    if (api.mediaType) mediaType = api.mediaType;
    if (api.imageUrl) imageCandidates.push(api.imageUrl);
  } else {
    try {
      const page = await safeFetch(url);
      if (looksBlocked(page)) {
        blocked = true;
      } else if (page.contentType.startsWith("image/")) {
        directImage = page.body;
        if (page.contentType.includes("gif")) mediaType = "gif";
      } else if (page.contentType.startsWith("video/")) {
        directVideo = asVideo(page.body);
        if (directVideo) mediaType = "video";
      } else if (page.status < 400 && page.contentType.includes("html")) {
        const meta = parseHtml(page.body.toString("utf8"), page.url);
        const cleaned = cleanTitle(meta.title, platform, meta.siteName);
        if (usefulTitle(cleaned.title, platform)) title = cleaned.title;
        authorName = cleaned.author ?? meta.author;
        if (meta.video || platform === "vimeo" || platform === "youtube") mediaType = "video";
        else if (!meta.image) mediaType = "website";
        if (meta.image) imageCandidates.push(meta.image);
        if (meta.video) videoCandidates.push(meta.video);
      } else if (page.status >= 400) {
        blocked = page.status !== 404 && page.status !== 410;
      }
    } catch {
      blocked = true;
    }
  }

  if (hints?.imageUrl) imageCandidates.unshift(hints.imageUrl);
  if (hints?.videoUrl) videoCandidates.unshift(hints.videoUrl);
  if (!title && hints?.title) title = hints.title;

  // Pages we couldn't read, or that have no og:image: ask a real browser.
  if (useMicrolink && !directImage && imageCandidates.length === 0 && !hints?.imagePath) {
    const ml = await microlink(url, { screenshot: !blocked });
    if (ml) {
      const cleaned = cleanTitle(ml.title, platform);
      if (usefulTitle(cleaned.title, platform)) title ??= cleaned.title;
      authorName ??= cleaned.author ?? ml.author;
      if (ml.imageUrl) imageCandidates.push(ml.imageUrl);
      if (ml.screenshotUrl) {
        imageCandidates.push(ml.screenshotUrl);
        if (!ml.imageUrl) mediaType = "website";
      }
    }
  }

  let image: Buffer | null = null;
  let error: IngestErrorCode | null = null;

  if (hints?.imagePath && deps.readUpload) {
    image = await deps.readUpload(hints.imagePath).catch(() => null);
  }
  if (!image && directImage) image = directImage;
  for (const candidate of imageCandidates) {
    if (image) break;
    image = await downloadImage(candidate, url);
  }

  if (!image) error = blocked ? "blocked" : imageCandidates.length ? "invalid-image" : "no-image";

  let video: ResolvedVideo | null = directVideo;
  for (const candidate of videoCandidates) {
    if (video || !image) break;
    video = await downloadVideo(candidate, url);
  }
  if (video) mediaType = "video";

  return {
    title: title || titleFromUrl(url),
    authorName: authorName ?? null,
    authorUrl: authorUrl ?? null,
    mediaType,
    image,
    video,
    error,
  };
}

/** Rejects titles that are just a hostname or the platform's own name (bot walls, error pages). */
function usefulTitle(title: string | undefined, platform: Platform): title is string {
  if (!title) return false;
  const t = title.trim().toLowerCase();
  if (/^(www\.)?[\w-]+(\.[\w-]+)+$/.test(t)) return false;
  return t !== platform && !["access denied", "just a moment...", "attention required!"].includes(t);
}

async function downloadImage(src: string, referer: string): Promise<Buffer | null> {
  try {
    const res = await safeFetch(src, { headers: { accept: "image/avif,image/webp,image/*,*/*;q=0.8", referer } });
    if (res.status !== 200 || res.body.length < 256) return null;
    if (!res.contentType.startsWith("image/") && !looksLikeImage(res.body)) return null;
    return res.body;
  } catch {
    return null;
  }
}

async function downloadVideo(src: string, referer: string): Promise<ResolvedVideo | null> {
  try {
    const res = await safeFetch(src, {
      maxBytes: MAX_VIDEO_BYTES,
      timeoutMs: 20_000,
      headers: { accept: "video/mp4,video/webm,video/*;q=0.8", referer },
    });
    if (res.status !== 200) return null;
    return asVideo(res.body);
  } catch {
    return null;
  }
}

/** Accepts MP4 and WebM only (by magic bytes, since CDNs often mislabel), within the size cap. */
export function asVideo(buf: Buffer): ResolvedVideo | null {
  if (buf.length < 1024 || buf.length > MAX_VIDEO_BYTES) return null;
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") return { data: buf, contentType: "video/mp4" };
  if (buf.subarray(0, 4).toString("hex") === "1a45dfa3") return { data: buf, contentType: "video/webm" };
  return null;
}

/** Some CDNs send images as application/octet-stream. Check the magic bytes. */
function looksLikeImage(buf: Buffer): boolean {
  const hex = buf.subarray(0, 12).toString("hex");
  return (
    hex.startsWith("ffd8ff") || // jpeg
    hex.startsWith("89504e47") || // png
    hex.startsWith("47494638") || // gif
    (hex.startsWith("52494646") && buf.subarray(8, 12).toString() === "WEBP") ||
    buf.subarray(4, 12).toString().startsWith("ftypavif")
  );
}

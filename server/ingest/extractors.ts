import type { MediaType, Platform } from "@/shared/types";
import { youtubeId } from "@/shared/video";
import { safeFetch } from "./safeFetch";

export interface ExtractedMeta {
  title?: string;
  authorName?: string;
  authorUrl?: string;
  imageUrl?: string;
  mediaType?: MediaType;
  description?: string;
  publishedAt?: string;
}

/** Platforms with a reliable oEmbed API skip page scraping entirely. */
export async function extractViaApi(url: string, platform: Platform): Promise<ExtractedMeta | null> {
  if (platform === "youtube") return youtube(url);
  if (platform === "vimeo") return vimeo(url);
  return null;
}

async function youtube(url: string): Promise<ExtractedMeta | null> {
  const id = youtubeId(url);
  if (!id) return null;
  const oembed = await fetchJson(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
  );
  const maxres = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  const [hasMaxres, about] = await Promise.all([
    safeFetch(maxres, { maxBytes: 4 * 1024 * 1024 })
      .then((r) => r.status === 200)
      .catch(() => false),
    youtubeAbout(id),
  ]);
  return {
    title: str(oembed?.title),
    authorName: str(oembed?.author_name),
    authorUrl: str(oembed?.author_url),
    imageUrl: hasMaxres ? maxres : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    mediaType: "video",
    ...about,
  };
}

/**
 * The full description and publish date, which oEmbed leaves out, from the watch page.
 * Best effort: YouTube sometimes answers servers with a consent or rate-limit page instead.
 */
async function youtubeAbout(id: string): Promise<Pick<ExtractedMeta, "description" | "publishedAt">> {
  try {
    const res = await safeFetch(`https://www.youtube.com/watch?v=${id}&hl=en`, { maxBytes: 4 * 1024 * 1024, timeoutMs: 8_000 });
    if (res.status !== 200) return {};
    return parseYoutubeWatch(res.body.toString("utf8"));
  } catch {
    return {};
  }
}

export function parseYoutubeWatch(html: string): Pick<ExtractedMeta, "description" | "publishedAt"> {
  const raw = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1];
  let description: string | undefined;
  try {
    description = raw ? (JSON.parse(`"${raw}"`) as string).trim() || undefined : undefined;
  } catch {
    description = undefined;
  }
  const publishedAt =
    html.match(/<meta itemprop="(?:datePublished|uploadDate)" content="([^"]+)"/)?.[1] ??
    html.match(/"(?:publishDate|uploadDate)":"([^"]+)"/)?.[1];
  return { description, publishedAt };
}

async function vimeo(url: string): Promise<ExtractedMeta | null> {
  const oembed = await fetchJson(`https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(url)}`);
  if (!oembed) return null;
  return {
    title: str(oembed.title),
    authorName: str(oembed.author_name),
    authorUrl: str(oembed.author_url),
    imageUrl: str(oembed.thumbnail_url),
    mediaType: "video",
    description: str(oembed.description),
    publishedAt: str(oembed.upload_date),
  };
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await safeFetch(url, { maxBytes: 512 * 1024, headers: { accept: "application/json" } });
    if (res.status !== 200) return null;
    return JSON.parse(res.body.toString("utf8"));
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/**
 * Turns page titles into "work title" + "author".
 * "Spatial Onboarding by Jane Doe for Studio on Dribbble" → { title: "Spatial Onboarding", author: "Jane Doe" }
 */
export function cleanTitle(
  raw: string | undefined,
  platform: Platform,
  siteName?: string,
): { title?: string; author?: string } {
  if (!raw) return {};
  let title = raw.replace(/\s+/g, " ").trim();
  let author: string | undefined;

  if (platform === "dribbble") {
    title = title.replace(/\s+on Dribbble$/i, "");
    const m = title.match(/^(.*?)\s+by\s+(.+?)(?:\s+for\s+.+)?$/i);
    if (m) {
      title = m[1];
      author = m[2];
    }
  } else if (platform === "behance") {
    title = title.replace(/\s*(::|\|)\s*Behance$/i, "").replace(/\s+on Behance$/i, "");
    // Rendered pages title projects "Project - Owner".
    const m = title.match(/^(.+?)\s+[-–]\s+([^-–]{2,60})$/);
    if (m) {
      title = m[1];
      author = m[2];
    }
  } else if (platform === "artstation") {
    const m = title.match(/^ArtStation\s*-\s*(.*)$/i);
    if (m) title = m[1];
  } else if (platform === "pinterest") {
    title = title.replace(/^Pin on\s+/i, "").replace(/\s*\|\s*Pinterest$/i, "");
  }

  // Generic "Work — Site" / "Work | Site" suffixes.
  const suffixes = [siteName, platform !== "web" ? platform : undefined].filter(Boolean) as string[];
  for (const suffix of suffixes) {
    const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(`\\s*[|\\-–—:·]+\\s*${escaped}\\s*$`, "i"), "");
  }
  return { title: title.trim() || undefined, author };
}

import type { Platform } from "./types";

const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^igshid$/i,
  /^igsh$/i,
  /^mc_(cid|eid)$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^si$/i,
  /^_branch_match_id$/i,
];

/** On YouTube only the params that identify the video survive. */
const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com"]);
const YOUTUBE_KEEP = new Set(["v", "list", "t"]);

export class InvalidUrlError extends Error {
  constructor(input: string) {
    super(`Not a valid web link: ${input}`);
    this.name = "InvalidUrlError";
  }
}

/** Pulls the first http(s) URL out of free text (share sheets often send "Title https://…"). */
export function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (match) return match[0].replace(/[),.;!?]+$/, "");
  const bare = text.trim();
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(bare)) return `https://${bare}`;
  return null;
}

/**
 * Canonical form used for dedupe: https, lowercase host, tracking params removed,
 * sorted query, no hash, no trailing slash.
 */
export function canonicalizeUrl(input: string): string {
  const raw = extractUrl(input);
  if (!raw) throw new InvalidUrlError(input);

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InvalidUrlError(input);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new InvalidUrlError(input);

  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  url.username = "";
  url.password = "";
  if (url.port === "443" || url.port === "80") url.port = "";

  // youtu.be/ID → youtube.com/watch?v=ID so both forms dedupe together.
  if (url.hostname === "youtu.be") {
    const id = url.pathname.slice(1);
    url = new URL(`https://www.youtube.com/watch?v=${id}`);
  }

  const host = url.hostname;
  const params = [...url.searchParams.keys()];
  for (const key of params) {
    if (YOUTUBE_HOSTS.has(host)) {
      if (!YOUTUBE_KEEP.has(key)) url.searchParams.delete(key);
    } else if (TRACKING_PARAMS.some((re) => re.test(key))) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");

  const out = url.toString();
  // URL always serializes the root path as "/"; drop it when nothing follows.
  return url.pathname === "/" && !url.search ? out.replace(/\/$/, "") : out;
}

export async function hashUrl(canonical: string): Promise<string> {
  const bytes = new TextEncoder().encode(canonical);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PLATFORM_HOSTS: [RegExp, Platform][] = [
  [/(^|\.)dribbble\.com$/, "dribbble"],
  [/(^|\.)behance\.net$/, "behance"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)vimeo\.com$/, "vimeo"],
  [/(^|\.)awwwards\.com$/, "awwwards"],
  [/(^|\.)artstation\.com$/, "artstation"],
  [/(^|\.)pinterest\.[a-z.]+$|(^|\.)pin\.it$/, "pinterest"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)mobbin\.com$/, "mobbin"],
];

export function detectPlatform(url: string): Platform {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "web";
  }
  for (const [re, platform] of PLATFORM_HOSTS) if (re.test(host)) return platform;
  return "web";
}

export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * A readable title from the URL itself, used until (or instead of) real metadata.
 * "dribbble.com/shots/2348-Spatial-Onboarding-UI" → "Spatial Onboarding UI".
 */
export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    // Only the last two segments carry a name; earlier ones are sections ("shots", "gallery").
    for (let i = segments.length - 1; i >= Math.max(0, segments.length - 2); i--) {
      const cleaned = decodeURIComponent(segments[i])
        .replace(/\.[a-z0-9]{2,4}$/i, "")
        .replace(/^\d+[-_]?/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      if (cleaned.length >= 3 && !/^\d+$/.test(cleaned) && !looksRandom(cleaned)) {
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
    }
    return displayHost(url);
  } catch {
    return url;
  }
}

/** Hashes and IDs ("d53b014d86a6b67…", "AbC9xQ2") make poor titles. */
function looksRandom(segment: string): boolean {
  if (/\s/.test(segment)) return false;
  if (/^[a-f0-9]{12,}$/i.test(segment)) return true;
  const digits = (segment.match(/\d/g) ?? []).length;
  return segment.length >= 8 && digits / segment.length > 0.3;
}

/** Lowercase word tokens for simple prefix-free search (array-contains). */
export function searchTokens(...parts: (string | null | undefined)[]): string[] {
  const words = parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 && w.length <= 32);
  return [...new Set(words)].slice(0, 40);
}

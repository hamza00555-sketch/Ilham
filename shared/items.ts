// Building a new item record, shared by the browser (you) and the agent API, so both normalize,
// dedupe and default exactly the same way.
import { canonicalizeUrl, detectPlatform, extractUrl, hashUrl, titleFromUrl } from "./normalize";
import { itemId, type AddedBy, type IngestHints, type Item } from "./types";

export type NewItem = Omit<Item, "addedAt" | "updatedAt">;

export interface BuildItemOptions {
  hints?: IngestHints | null;
  addedBy?: AddedBy;
  tags?: string[];
  /** Why an agent picked it, shown in the Inbox. */
  reason?: string | null;
  agentRunId?: string | null;
}

/** The doc ID (`{projectId}__{urlHash}`) and the fields of a new, queued item. */
export async function buildItem(
  projectId: string,
  input: string,
  opts: BuildItemOptions = {},
): Promise<{ id: string; item: NewItem }> {
  const sourceUrl = extractUrl(input) ?? input;
  const canonicalUrl = canonicalizeUrl(input);
  const urlHash = await hashUrl(canonicalUrl);
  const addedBy = opts.addedBy ?? "user";
  const hints = cleanHints(opts.hints);

  const item: NewItem = {
    projectId,
    urlHash,
    sourceUrl,
    canonicalUrl,
    platform: detectPlatform(canonicalUrl),
    mediaType: "image",
    title: hints?.title ?? titleFromUrl(canonicalUrl),
    authorName: null,
    authorUrl: null,
    preview: null,
    colorBuckets: [],
    searchTokens: [],
    tags: cleanTags(opts.tags),
    // Agent picks wait in the Inbox until you keep them.
    status: addedBy === "agent" ? "inbox" : "kept",
    ingest: "queued",
    ingestError: null,
    hints,
    addedBy,
    agentRunId: opts.agentRunId ?? null,
    reason: opts.reason?.trim().slice(0, 400) || null,
    note: null,
  };
  return { id: itemId(projectId, urlHash), item };
}

export function cleanHints(hints?: IngestHints | null): IngestHints | null {
  if (!hints) return null;
  const out: IngestHints = {};
  if (hints.imageUrl && /^https?:\/\//i.test(hints.imageUrl)) out.imageUrl = hints.imageUrl;
  if (hints.videoUrl && /^https?:\/\//i.test(hints.videoUrl)) out.videoUrl = hints.videoUrl;
  if (hints.title?.trim()) out.title = hints.title.trim().slice(0, 200);
  return Object.keys(out).length ? out : null;
}

/** Lowercase, trimmed, deduped, at most 12 tags of 40 characters ("type:ui", "mood:dark"…). */
export function cleanTags(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) return [];
  const out = new Set<string>();
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const tag = t.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
    if (tag) out.add(tag);
    if (out.size === 12) break;
  }
  return [...out];
}

/** Only real web pages can become references. */
export function isWebUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

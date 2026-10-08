// Building a new item record, shared by the browser (you) and the agent API, so both normalize,
// dedupe and default exactly the same way.
import { cleanHttpUrl, cleanLine, cleanTools, normalizeDate } from "./credits";
import { canonicalizeUrl, detectPlatform, extractUrl, hashUrl, titleFromUrl } from "./normalize";
import { itemId, type AddedBy, type IngestHints, type Item, type ItemNote } from "./types";

export type NewItem = Omit<Item, "addedAt" | "updatedAt">;

export interface BuildItemOptions {
  hints?: IngestHints | null;
  addedBy?: AddedBy;
  tags?: string[];
  /** Why an agent picked it, shown in the Inbox. */
  reason?: string | null;
  agentRunId?: string | null;
  /** What the adder already knows about who made it. The page's own credits win where it has them. */
  credits?: CreditsInput;
  /** A first note for the user about this reference (agents). */
  note?: string | null;
  /** The agent's key name, shown on its notes. */
  agentName?: string | null;
  /** Agent picks only: false adds them straight to the project instead of the Inbox. */
  review?: boolean;
}

export interface CreditsInput {
  creator?: string | null;
  creatorUrl?: string | null;
  publishedAt?: string | number | null;
  tools?: string[] | null;
  process?: string | null;
}

export const MAX_NOTES = 100;
export const MAX_NOTE_LENGTH = 2000;

export function makeNote(by: ItemNote["by"], text: string, name: string | null = null): ItemNote | null {
  const clean = cleanLine(text, MAX_NOTE_LENGTH);
  if (!clean) return null;
  return { id: randomId(), by, name: by === "agent" ? cleanLine(name, 40) : null, text: clean, at: new Date().toISOString() };
}

const randomId = () => globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16);

/** Credits as item fields; only what's present, so an update never blanks what's already known. */
export function creditFields(credits?: CreditsInput | null): Partial<Item> {
  if (!credits) return {};
  const out: Partial<Item> = {};
  if (credits.creator !== undefined) out.authorName = cleanLine(credits.creator, 120);
  if (credits.creatorUrl !== undefined) out.authorUrl = cleanHttpUrl(credits.creatorUrl);
  if (credits.publishedAt !== undefined) out.publishedAt = normalizeDate(credits.publishedAt);
  if (credits.tools !== undefined) out.tools = cleanTools(credits.tools);
  if (credits.process !== undefined) out.process = cleanLine(credits.process, 1500);
  return out;
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
  const credits = creditFields(opts.credits);
  const note = opts.note ? makeNote(addedBy === "agent" ? "agent" : "user", opts.note, opts.agentName ?? null) : null;

  const item: NewItem = {
    projectId,
    urlHash,
    sourceUrl,
    canonicalUrl,
    platform: detectPlatform(canonicalUrl),
    mediaType: "image",
    title: hints?.title ?? titleFromUrl(canonicalUrl),
    authorName: credits.authorName ?? null,
    authorUrl: credits.authorUrl ?? null,
    preview: null,
    colorBuckets: [],
    searchTokens: [],
    tags: cleanTags(opts.tags),
    // Agent picks wait in the Inbox until you keep them, unless review is off for the project.
    status: addedBy === "agent" && opts.review !== false ? "inbox" : "kept",
    ingest: "queued",
    ingestError: null,
    hints,
    addedBy,
    agentRunId: opts.agentRunId ?? null,
    reason: opts.reason?.trim().slice(0, 400) || null,
    description: null,
    publishedAt: credits.publishedAt ?? null,
    tools: credits.tools ?? [],
    process: credits.process ?? null,
    notes: note ? [note] : [],
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

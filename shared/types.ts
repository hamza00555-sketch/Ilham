// Types shared by the browser and the ingest server (app/api).
// Firestore layout: users/{uid}/projects/{projectId} · users/{uid}/items/{projectId}__{urlHash}

export type Platform =
  | "dribbble"
  | "behance"
  | "youtube"
  | "vimeo"
  | "awwwards"
  | "artstation"
  | "pinterest"
  | "instagram"
  | "mobbin"
  | "web";

export type MediaType = "image" | "video" | "gif" | "website";

export type ItemStatus = "inbox" | "kept" | "discarded";

/** queued → processing → ready | failed. Setting it back to "queued" re-runs ingestion. */
export type IngestState = "queued" | "processing" | "ready" | "failed";

export type AddedBy = "user" | "agent";

export interface Preview {
  w640: string;
  w1280: string;
  width: number;
  height: number;
  /** Tiny WebP data URL shown while the real preview loads. */
  lqip: string;
  dominantColor: string;
  palette: string[];
  /** Short muted mp4/webm we store ourselves (when the source offers a video file). */
  video?: string | null;
}

/** Optional hints from the user or an agent. The server always re-fetches metadata itself. */
export interface IngestHints {
  imageUrl?: string;
  /** Direct video file (e.g. the <video> on a Dribbble shot, read by the bookmarklet). */
  videoUrl?: string;
  title?: string;
}

/** One message on a reference: an agent telling you something about it, or your own note (agents read both). */
export interface ItemNote {
  id: string;
  by: "user" | "agent";
  /** The agent's key name ("Codex", "Claude"…), for agent notes. */
  name: string | null;
  text: string;
  /** ISO time. Notes live in an array, where server timestamps aren't allowed. */
  at: string;
}

export interface Item {
  projectId: string;
  urlHash: string;
  sourceUrl: string;
  canonicalUrl: string;
  platform: Platform;
  mediaType: MediaType;
  title: string | null;
  /** Who made it, and their portfolio or profile page. */
  authorName: string | null;
  authorUrl: string | null;
  preview: Preview | null;
  colorBuckets: string[];
  searchTokens: string[];
  tags: string[];
  status: ItemStatus;
  ingest: IngestState;
  ingestError: string | null;
  hints: IngestHints | null;
  addedBy: AddedBy;
  agentRunId: string | null;
  reason: string | null;
  // Credits. Optional: references saved before credits existed don't have them.
  /** The creator's own words about the work, from its page. */
  description?: string | null;
  /** "YYYY-MM-DD", "YYYY-MM" or "YYYY". */
  publishedAt?: string | null;
  /** Software used ("Blender", "After Effects"…), found on the page or added by an agent. */
  tools?: string[];
  /** How it was made: process, techniques, making-of. Usually an agent's research. */
  process?: string | null;
  notes?: ItemNote[];
  // Timestamps are Firestore Timestamps at runtime; typed loosely so both SDKs fit.
  addedAt: unknown;
  updatedAt: unknown;
}

export interface CoverTile {
  url: string;
  lqip: string;
  color: string;
  /** Portrait/tall image: crop from the top instead of the center. */
  tall?: boolean;
}

export interface Project {
  slug: string;
  name: string;
  description: string | null;
  brief: Record<string, unknown>;
  autoCurate: boolean;
  webhookUrl: string | null;
  visibility: "private" | "unlisted" | "public";
  shareToken: string | null;
  cover: CoverTile[];
  counts: { kept: number; inbox: number };
  createdAt: unknown;
  updatedAt: unknown;
}

export const itemId = (projectId: string, urlHash: string) => `${projectId}__${urlHash}`;

// Types shared by the Next.js app and Cloud Functions.
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
  /** Short muted mp4/webm stored in our bucket (when the source offers a video file). */
  video?: string | null;
}

/** Optional hints from the user or an agent. The server always re-fetches metadata itself. */
export interface IngestHints {
  imageUrl?: string;
  /** Storage path of an image the user uploaded as the preview. */
  imagePath?: string;
  /** Direct video file (e.g. the <video> on a Dribbble shot, read by the bookmarklet). */
  videoUrl?: string;
  title?: string;
}

export interface Item {
  projectId: string;
  urlHash: string;
  sourceUrl: string;
  canonicalUrl: string;
  platform: Platform;
  mediaType: MediaType;
  title: string | null;
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
  note: string | null;
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

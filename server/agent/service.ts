import "server-only";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { after } from "next/server";
import { buildItem, cleanTags, creditFields, isWebUrl, makeNote, MAX_NOTES, type CreditsInput } from "@/shared/items";
import { searchTokens } from "@/shared/normalize";
import { slugify } from "@/shared/slug";
import { parseThreadLink } from "@/shared/threads";
import { reviewsAgentPicks, type AgentSettings, type Item, type ItemNote, type ItemStatus, type Project } from "@/shared/types";
import { HttpError } from "../auth";
import { admin } from "../firebase-admin";
import { runIngest } from "../ingest/run";
import { syncProjects } from "../stats";

/**
 * What agents can do, shared by REST v1 and the MCP server. Everything is scoped to the key's
 * owner. Agent picks land in the project's Inbox for you to keep or discard, unless you turned
 * review off (for the account, or for that project); then they join the project directly.
 */

export const MAX_BATCH = 50;
const INGEST_CONCURRENCY = 4;

const iso = (t: unknown) => (t as Timestamp | undefined)?.toDate?.().toISOString() ?? null;
const col = (uid: string, name: "projects" | "items" | "agentRuns") => admin().db.collection(`users/${uid}/${name}`);

async function agentSettings(uid: string): Promise<Partial<AgentSettings> | null> {
  const snap = await admin().db.doc(`users/${uid}/settings/agent`).get();
  return snap.exists ? (snap.data() as Partial<AgentSettings>) : null;
}

export interface ProjectSummary {
  slug: string;
  name: string;
  description: string | null;
  brief: Record<string, unknown>;
  counts: { kept: number; inbox: number };
  /** true: your picks wait in the Inbox for the user. false: they join the project directly. */
  review: boolean;
  url: string;
}

function summarize(p: Project, origin: string, settings: Partial<AgentSettings> | null): ProjectSummary {
  return {
    slug: p.slug,
    name: p.name,
    description: p.description,
    brief: p.brief ?? {},
    counts: p.counts ?? { kept: 0, inbox: 0 },
    review: reviewsAgentPicks(p, settings),
    url: `${origin}/p/${p.slug}`,
  };
}

async function projectBySlug(uid: string, slug: string) {
  const snap = await col(uid, "projects").where("slug", "==", slug).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) throw new HttpError(404, "project-not-found");
  return { id: doc.id, project: doc.data() as Project };
}

export async function listProjects(uid: string, origin: string): Promise<ProjectSummary[]> {
  const [snap, settings] = await Promise.all([col(uid, "projects").orderBy("updatedAt", "desc").get(), agentSettings(uid)]);
  return snap.docs.map((d) => summarize(d.data() as Project, origin, settings));
}

export async function createProject(
  uid: string,
  origin: string,
  input: { name: string; description?: string | null; brief?: Record<string, unknown> },
): Promise<ProjectSummary> {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new HttpError(400, "name-required");
  const base = slugify(name);
  let slug = base;
  for (let n = 2; !(await col(uid, "projects").where("slug", "==", slug).limit(1).get()).empty; n++) {
    slug = n < 50 ? `${base}-${n}` : `${base}-${Date.now().toString(36)}`;
  }
  const project: Omit<Project, "createdAt" | "updatedAt"> = {
    slug,
    name,
    description: input.description?.trim().slice(0, 280) || null,
    brief: input.brief ?? {},
    autoCurate: false,
    webhookUrl: null,
    visibility: "private",
    shareToken: null,
    cover: [],
    counts: { kept: 0, inbox: 0 },
  };
  await col(uid, "projects").add({ ...project, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return summarize(project as Project, origin, await agentSettings(uid));
}

type ItemSummary = {
  id: string;
  url: string;
  title: string | null;
  platform: string;
  status: ItemStatus;
  addedBy: string;
  tags: string[];
  reason: string | null;
  creator: string | null;
  ingest: string;
  addedAt: string | null;
  notes: number;
  /** "user" when the latest note on it is the user's: they wrote something you may want to answer. */
  lastNoteBy: ItemNote["by"] | null;
};

const itemSummary = (id: string, i: Item): ItemSummary => ({
  id,
  url: i.sourceUrl,
  title: i.title,
  platform: i.platform,
  status: i.status,
  addedBy: i.addedBy,
  tags: i.tags ?? [],
  reason: i.reason ?? null,
  creator: i.authorName ?? null,
  ingest: i.ingest,
  addedAt: iso(i.addedAt),
  notes: i.notes?.length ?? 0,
  lastNoteBy: i.notes?.at(-1)?.by ?? null,
});

async function itemsWithStatus(uid: string, projectId: string, status: ItemStatus, limit: number) {
  const snap = await col(uid, "items")
    .where("projectId", "==", projectId)
    .where("status", "==", status)
    .orderBy("addedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => itemSummary(d.id, d.data() as Item));
}

/** The project, its brief, and what's already in it (so an agent doesn't suggest it again). */
export async function getProject(uid: string, origin: string, slug: string) {
  const { id, project } = await projectBySlug(uid, slug);
  const [kept, inbox, discarded, settings] = await Promise.all([
    itemsWithStatus(uid, id, "kept", 40),
    itemsWithStatus(uid, id, "inbox", 40),
    itemsWithStatus(uid, id, "discarded", 40),
    agentSettings(uid),
  ]);
  return {
    ...summarize(project, origin, settings),
    recent: kept.slice(0, 20),
    knownUrls: [...kept, ...inbox, ...discarded].map((i) => i.url),
  };
}

export async function listItems(uid: string, slug: string, status: ItemStatus, limit: number) {
  const { id } = await projectBySlug(uid, slug);
  return itemsWithStatus(uid, id, status, Math.min(Math.max(limit, 1), 100));
}

/** What you kept vs. discarded lately, with their tags: the taste signal for the next run. */
export async function getTaste(uid: string, slug: string) {
  const { id, project } = await projectBySlug(uid, slug);
  const [kept, discarded] = await Promise.all([itemsWithStatus(uid, id, "kept", 30), itemsWithStatus(uid, id, "discarded", 30)]);
  const tally = (list: ItemSummary[]) => {
    const m = new Map<string, number>();
    list.forEach((i) => i.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([tag, count]) => ({ tag, count }));
  };
  const pick = ({ url, title, platform, tags }: ItemSummary) => ({ url, title, platform, tags });
  return {
    brief: project.brief ?? {},
    kept: kept.map(pick),
    discarded: discarded.map(pick),
    keptTags: tally(kept),
    discardedTags: tally(discarded),
  };
}

export interface AgentItemInput extends CreditsInput {
  url: string;
  imageUrl?: string;
  videoUrl?: string;
  title?: string;
  tags?: string[];
  reason?: string;
  note?: string;
}

export type AddOutcome = { url: string; id?: string; status: "queued" | "duplicate" | "invalid" };

export interface AddResult {
  project: string;
  /** Where new picks went: "inbox" (the user reviews them) or "kept" (review is off here). */
  landedIn: "inbox" | "kept";
  results: AddOutcome[];
}

/**
 * Adds up to 50 picks to the project's Inbox. Agent-supplied fields are only hints: the server
 * fetches the page itself, so previews are right even when the agent is wrong. Processing runs
 * after the response, a few at a time.
 */
export async function addItems(
  uid: string,
  slug: string,
  items: AgentItemInput[],
  runId?: string | null,
  agentName: string | null = null,
): Promise<AddResult> {
  if (!items.length) throw new HttpError(400, "no-items");
  if (items.length > MAX_BATCH) throw new HttpError(400, "too-many-items");
  const [{ id: projectId, project }, settings] = await Promise.all([projectBySlug(uid, slug), agentSettings(uid)]);
  const review = reviewsAgentPicks(project, settings);
  const { db } = admin();

  const results: AddOutcome[] = [];
  const queued: string[] = [];
  for (const input of items) {
    const url = typeof input.url === "string" ? input.url.trim() : "";
    if (!isWebUrl(url)) {
      results.push({ url, status: "invalid" });
      continue;
    }
    const { id, item } = await buildItem(projectId, url, {
      addedBy: "agent",
      hints: { imageUrl: input.imageUrl, videoUrl: input.videoUrl, title: input.title },
      tags: input.tags,
      reason: input.reason,
      agentRunId: runId ?? null,
      credits: input,
      note: input.note,
      agentName,
      review,
    });
    try {
      await db.doc(`users/${uid}/items/${id}`).create({
        ...item,
        addedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      results.push({ url, id, status: "queued" });
      queued.push(id);
    } catch (err) {
      // ALREADY_EXISTS: kept, waiting in the Inbox, or discarded before. Never resurrect it.
      if ((err as { code?: number }).code === 6) results.push({ url, id, status: "duplicate" });
      else throw err;
    }
  }

  if (queued.length) {
    await syncProjects(uid, [projectId]);
    if (runId) {
      await col(uid, "agentRuns")
        .doc(runId)
        .update({ itemsAdded: FieldValue.increment(queued.length) })
        .catch(() => undefined);
    }
    after(() => ingestAll(uid, queued));
  }
  return { project: slug, landedIn: review ? "inbox" : "kept", results };
}

async function ingestAll(uid: string, ids: string[]) {
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      await runIngest(uid, id).catch((err) => console.error("agent ingest failed", { id, err }));
    }
  };
  await Promise.all(Array.from({ length: Math.min(INGEST_CONCURRENCY, ids.length) }, worker));
}

async function itemInProject(uid: string, slug: string, id: string) {
  const { id: projectId } = await projectBySlug(uid, slug);
  const ref = admin().db.doc(`users/${uid}/items/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get("projectId") !== projectId) throw new HttpError(404, "item-not-found");
  return { projectId, ref, item: snap.data() as Item };
}

/** Keep, discard, retag, or correct the credits of one item. */
export async function updateItem(
  uid: string,
  slug: string,
  id: string,
  patch: { status?: ItemStatus; tags?: string[] } & CreditsInput,
) {
  const { projectId, ref, item } = await itemInProject(uid, slug, id);
  const update: Partial<Item> = creditFields(patch);
  if (patch.status) update.status = patch.status;
  if (patch.tags) update.tags = cleanTags(patch.tags);
  const next = { ...item, ...update };
  if (update.tags || update.tools || update.authorName !== undefined) {
    update.searchTokens = searchTokens(next.title, next.authorName, ...(next.tools ?? []), ...(next.tags ?? []));
  }
  await ref.update({ ...update, updatedAt: FieldValue.serverTimestamp() });
  if (patch.status) await syncProjects(uid, [projectId]);
  return itemSummary(id, next);
}

/** Everything about one reference: its credits, the creator's own description, and the notes on it. */
export async function getItem(uid: string, origin: string, slug: string, id: string) {
  const { item } = await itemInProject(uid, slug, id);
  return {
    ...itemSummary(id, item),
    mediaType: item.mediaType,
    image: item.preview?.w1280 ?? null,
    creatorUrl: item.authorUrl ?? null,
    publishedAt: item.publishedAt ?? null,
    description: item.description ?? null,
    tools: item.tools ?? [],
    process: item.process ?? null,
    notes: (item.notes ?? []).map(({ by, name, text, at }) => ({ by, name, text, at })),
    appUrl: `${origin}/p/${encodeURIComponent(slug)}?ref=${id}`,
  };
}

/** Leaves a note for the user on one reference. Only the latest 100 notes are kept. */
export async function addNote(uid: string, slug: string, id: string, text: string, agentName: string | null) {
  const { ref } = await itemInProject(uid, slug, id);
  const note = makeNote("agent", text, agentName);
  if (!note) throw new HttpError(400, "empty-note");
  await admin().db.runTransaction(async (tx) => {
    const notes = ((await tx.get(ref)).get("notes") as ItemNote[] | undefined) ?? [];
    tx.update(ref, {
      notes: [...notes, note].slice(-MAX_NOTES),
      awaitingReply: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { id, note: { by: note.by, name: note.name, text: note.text, at: note.at } };
}

/** A run groups one search session: what the agent was asked, how many it added, its summary. */
export async function startRun(uid: string, slug: string, query: string) {
  const { id: projectId } = await projectBySlug(uid, slug);
  const ref = await col(uid, "agentRuns").add({
    projectId,
    slug,
    query: query.trim().slice(0, 1000),
    status: "running",
    itemsAdded: 0,
    summary: null,
    startedAt: FieldValue.serverTimestamp(),
    finishedAt: null,
  });
  return { runId: ref.id };
}

export async function finishRun(uid: string, runId: string, input: { summary?: string; status?: "done" | "failed" }) {
  const ref = col(uid, "agentRuns").doc(runId);
  if (!(await ref.get()).exists) throw new HttpError(404, "run-not-found");
  await ref.update({
    status: input.status ?? "done",
    summary: input.summary?.trim().slice(0, 2000) || null,
    finishedAt: FieldValue.serverTimestamp(),
  });
  return { runId, status: input.status ?? "done" };
}

/** A thread from its sheet link (what the user copies with "ادعُ وكيل"). */
export async function openThread(uid: string, origin: string, link: string) {
  const target = parseThreadLink(link);
  if (!target) throw new HttpError(400, "not-a-reference-link");
  return { project: target.project, ...(await getItem(uid, origin, target.project, target.id)) };
}

const WAIT_STEP_MS = 3_000;
export const MAX_WAIT_SECONDS = 240;

/**
 * Waits for the user's next note on a thread, so an agent can stay in the conversation. Returns
 * the user's notes written after `afterNoteId` (default: the thread's latest note), or "timeout"
 * so the agent calls again. Keep timeouts under your client's tool timeout (60 s in Codex by default).
 */
export async function waitForReply(uid: string, slug: string, id: string, afterNoteId?: string, timeoutSeconds = 50) {
  const { ref, item } = await itemInProject(uid, slug, id);
  const notes = item.notes ?? [];
  const after = (afterNoteId && notes.find((n) => n.id === afterNoteId)?.at) ?? notes.at(-1)?.at ?? new Date().toISOString();
  const deadline = Date.now() + Math.min(Math.max(timeoutSeconds, 5), MAX_WAIT_SECONDS) * 1000;

  for (;;) {
    const current = ((await ref.get()).get("notes") as ItemNote[] | undefined) ?? [];
    const fresh = current.filter((n) => n.by === "user" && n.at > after);
    if (fresh.length) {
      return {
        status: "reply" as const,
        notes: fresh.map(({ id: noteId, text, at }) => ({ id: noteId, text, at })),
        lastNoteId: current.at(-1)?.id ?? null,
      };
    }
    if (Date.now() + WAIT_STEP_MS > deadline) {
      return { status: "timeout" as const, hint: "No new note yet. Call wait_for_reply again to keep listening." };
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
  }
}

/** Threads where the user's latest note has no answer yet, newest first, across all projects. */
export async function listWaitingThreads(uid: string, origin: string) {
  const [items, projects] = await Promise.all([
    col(uid, "items").where("awaitingReply", "==", true).limit(50).get(),
    col(uid, "projects").get(),
  ]);
  const slugs = new Map(projects.docs.map((d) => [d.id, (d.data() as Project).slug]));
  return items.docs
    .map((d) => {
      const item = d.data() as Item;
      const slug = slugs.get(item.projectId);
      const last = item.notes?.at(-1);
      if (!slug || last?.by !== "user") return null;
      return {
        project: slug,
        id: d.id,
        title: item.title,
        url: item.sourceUrl,
        lastNote: { text: last.text, at: last.at },
        link: `${origin}/p/${encodeURIComponent(slug)}?ref=${d.id}`,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .sort((a, b) => b.lastNote.at.localeCompare(a.lastNote.at));
}

import "server-only";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { after } from "next/server";
import { buildItem, cleanTags, isWebUrl } from "@/shared/items";
import { slugify } from "@/shared/slug";
import type { Item, ItemStatus, Project } from "@/shared/types";
import { HttpError } from "../auth";
import { admin } from "../firebase-admin";
import { runIngest } from "../ingest/run";
import { syncProjects } from "../stats";

/**
 * What agents can do, shared by REST v1 and the MCP server. Everything is scoped to the key's
 * owner, and agent picks always land in the project's Inbox for you to keep or discard.
 */

export const MAX_BATCH = 50;
const INGEST_CONCURRENCY = 4;

const iso = (t: unknown) => (t as Timestamp | undefined)?.toDate?.().toISOString() ?? null;
const col = (uid: string, name: "projects" | "items" | "agentRuns") => admin().db.collection(`users/${uid}/${name}`);

export interface ProjectSummary {
  slug: string;
  name: string;
  description: string | null;
  brief: Record<string, unknown>;
  counts: { kept: number; inbox: number };
  url: string;
}

function summarize(p: Project, origin: string): ProjectSummary {
  return {
    slug: p.slug,
    name: p.name,
    description: p.description,
    brief: p.brief ?? {},
    counts: p.counts ?? { kept: 0, inbox: 0 },
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
  const snap = await col(uid, "projects").orderBy("updatedAt", "desc").get();
  return snap.docs.map((d) => summarize(d.data() as Project, origin));
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
  return summarize(project as Project, origin);
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
  ingest: string;
  addedAt: string | null;
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
  ingest: i.ingest,
  addedAt: iso(i.addedAt),
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
  const [kept, inbox, discarded] = await Promise.all(
    (["kept", "inbox", "discarded"] as const).map((s) => itemsWithStatus(uid, id, s, 40)),
  );
  return {
    ...summarize(project, origin),
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

export interface AgentItemInput {
  url: string;
  imageUrl?: string;
  videoUrl?: string;
  title?: string;
  tags?: string[];
  reason?: string;
}

export type AddOutcome = { url: string; id?: string; status: "queued" | "duplicate" | "invalid" };

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
): Promise<{ project: string; results: AddOutcome[] }> {
  if (!items.length) throw new HttpError(400, "no-items");
  if (items.length > MAX_BATCH) throw new HttpError(400, "too-many-items");
  const { id: projectId } = await projectBySlug(uid, slug);
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
  return { project: slug, results };
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

/** Keep, discard or annotate one item. */
export async function updateItem(
  uid: string,
  slug: string,
  id: string,
  patch: { status?: ItemStatus; tags?: string[]; note?: string | null },
) {
  const { id: projectId } = await projectBySlug(uid, slug);
  const ref = admin().db.doc(`users/${uid}/items/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get("projectId") !== projectId) throw new HttpError(404, "item-not-found");
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (patch.status) update.status = patch.status;
  if (patch.tags) update.tags = cleanTags(patch.tags);
  if (patch.note !== undefined) update.note = patch.note?.trim().slice(0, 1000) || null;
  await ref.update(update);
  if (patch.status) await syncProjects(uid, [projectId]);
  return itemSummary(id, { ...(snap.data() as Item), ...(update as Partial<Item>) });
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

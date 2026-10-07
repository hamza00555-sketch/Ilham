"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { canonicalizeUrl, detectPlatform, extractUrl, hashUrl, titleFromUrl } from "@/shared/normalize";
import { itemId, type AddedBy, type IngestHints, type Item, type ItemStatus } from "@/shared/types";
import { callApi } from "../api";
import { firebase } from "../firebase/client";

export type ItemDoc = Item & { id: string };

/** A failed live query. `fixUrl` is Firestore's one-click "create this index" link, when it sends one. */
export type QueryError = { code: string; fixUrl?: string };

const PAGE = 30;
const itemsCol = (uid: string) => collection(firebase().db, "users", uid, "items");

/**
 * Live items of a project, newest first. Grows by a page at a time so the whole visible grid
 * stays realtime (new agent picks and finished previews appear without a refresh).
 */
export function useItems(uid: string, projectId: string, status: ItemStatus = "kept") {
  const [pageCount, setPageCount] = useState(1);
  const [state, setState] = useState<{ key: string; items?: ItemDoc[]; error?: QueryError }>();
  const key = `${uid}/${projectId}/${status}/${pageCount}`;

  useEffect(() => {
    const q = query(
      itemsCol(uid),
      where("projectId", "==", projectId),
      where("status", "==", status),
      orderBy("addedAt", "desc"),
      limit(pageCount * PAGE),
    );
    return onSnapshot(
      q,
      (snap) => setState({ key, items: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Item) })) }),
      // Usually a missing or still-building index ("failed-precondition"); the console has its link.
      (err) => {
        console.error("items query failed", err);
        const fixUrl = err.message.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
        setState({ key, error: { code: err.code, fixUrl } });
      },
    );
  }, [uid, projectId, status, pageCount, key]);

  // Keep showing the previous page while the bigger one loads.
  const items = state?.items;
  return {
    items,
    error: state?.error,
    hasMore: (items?.length ?? 0) >= pageCount * PAGE,
    loadingMore: state !== undefined && state.key !== key,
    loadMore: () => setPageCount((n) => n + 1),
  };
}

export type AddResult = { status: "added" | "duplicate"; id: string };

/** Projects that already hold this link (same canonical URL). */
export async function findProjectsWithUrl(uid: string, input: string): Promise<Set<string>> {
  const urlHash = await hashUrl(canonicalizeUrl(input));
  const snap = await getDocs(query(itemsCol(uid), where("urlHash", "==", urlHash), limit(50)));
  return new Set(snap.docs.map((d) => (d.data() as Item).projectId));
}

export async function addItem(
  uid: string,
  projectId: string,
  input: string,
  opts: { hints?: IngestHints; addedBy?: AddedBy } = {},
): Promise<AddResult> {
  const sourceUrl = extractUrl(input) ?? input;
  const canonicalUrl = canonicalizeUrl(input);
  const urlHash = await hashUrl(canonicalUrl);
  const id = itemId(projectId, urlHash);
  const ref = doc(itemsCol(uid), id);
  const addedBy = opts.addedBy ?? "user";
  const hints = cleanHints(opts.hints);

  const item: Omit<Item, "addedAt" | "updatedAt"> = {
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
    tags: [],
    status: addedBy === "agent" ? "inbox" : "kept",
    ingest: "queued",
    ingestError: null,
    hints,
    addedBy,
    agentRunId: null,
    reason: null,
    note: null,
  };

  const status = await runTransaction(firebase().db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) return "duplicate" as const;
    tx.set(ref, { ...item, addedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return "added" as const;
  });
  if (status === "added") kickIngest(uid, id);
  return { status, id };
}

function cleanHints(hints?: IngestHints): IngestHints | null {
  if (!hints) return null;
  const out: IngestHints = {};
  if (hints.imageUrl && /^https?:\/\//i.test(hints.imageUrl)) out.imageUrl = hints.imageUrl;
  if (hints.videoUrl && /^https?:\/\//i.test(hints.videoUrl)) out.videoUrl = hints.videoUrl;
  if (hints.title?.trim()) out.title = hints.title.trim().slice(0, 200);
  return Object.keys(out).length ? out : null;
}

const touch = { updatedAt: serverTimestamp() };
const projectOf = (id: string) => id.split("__")[0];

/**
 * Asks the server to ingest a queued item. Fire-and-forget: the card follows along live from
 * Firestore. A refused request marks the item failed so it can be retried from its menu; a
 * dropped connection leaves it queued for useResumeIngest to pick up.
 */
export function kickIngest(uid: string, id: string) {
  void callApi("/api/ingest", { itemId: id }).catch(async (err) => {
    const code = (err as { code?: string }).code ?? "internal";
    if (code === "network-request-failed") return;
    await updateDoc(doc(itemsCol(uid), id), { ingest: "failed", ingestError: code, ...touch }).catch(() => undefined);
  });
}

const resumed = new Set<string>();

/**
 * Restarts ingestion the browser asked for but never saw start (tab closed mid-add, offline),
 * and ingestion a server request abandoned. Each item is nudged at most once per session.
 */
export function useResumeIngest(uid: string, items: ItemDoc[] | undefined) {
  useEffect(() => {
    const now = Date.now();
    for (const item of items ?? []) {
      // Pending server timestamps read as null: the write is seconds old.
      const touched = (item.updatedAt as { toMillis?: () => number } | null)?.toMillis?.();
      if (touched === undefined || resumed.has(item.id)) continue;
      const age = now - touched;
      const stuck = (item.ingest === "queued" && age > 20_000) || (item.ingest === "processing" && age > 3 * 60_000);
      if (!stuck) continue;
      resumed.add(item.id);
      kickIngest(uid, item.id);
    }
  }, [uid, items]);
}

/** Counts and covers are kept by the server; tell it which projects just changed. */
function syncProjects(projectIds: string[]) {
  void callApi("/api/sync", { projectIds: [...new Set(projectIds)] }).catch(() => undefined);
}

export async function retryIngest(uid: string, id: string) {
  await updateDoc(doc(itemsCol(uid), id), { ingest: "queued", ingestError: null, ...touch });
  kickIngest(uid, id);
}

export async function setPreviewFromUrl(uid: string, id: string, imageUrl: string) {
  await updateDoc(doc(itemsCol(uid), id), { hints: { imageUrl }, ingest: "queued", ingestError: null, ...touch });
  kickIngest(uid, id);
}

/** Sends a screenshot or image to become the preview. Big files are shrunk first (4 MB request cap). */
export async function setPreviewFromFile(id: string, file: File) {
  const form = new FormData();
  form.append("itemId", id);
  form.append("file", await shrinkForUpload(file), file.name || "preview");
  await callApi("/api/ingest", form);
}

async function shrinkForUpload(file: File): Promise<Blob> {
  if (file.size <= 3.5 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  // Previews top out at 1280px wide and 1:2 tall, so this keeps every pixel that gets used.
  const scale = Math.min(1, 1920 / bitmap.width, 3840 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.9),
  );
}

export async function deleteItem(uid: string, id: string) {
  await deleteDoc(doc(itemsCol(uid), id));
  syncProjects([projectOf(id)]);
}

/** Puts a deleted item back exactly as it was (used by the undo toast). */
export async function restoreItem(uid: string, item: ItemDoc) {
  const { id, ...data } = item;
  await setDoc(doc(itemsCol(uid), id), data as DocumentData);
  syncProjects([item.projectId]);
}

export async function moveItem(uid: string, item: ItemDoc, toProjectId: string): Promise<"moved" | "merged"> {
  const { db } = firebase();
  const { id, ...data } = item;
  const target = doc(itemsCol(uid), itemId(toProjectId, item.urlHash));
  const result = await runTransaction(db, async (tx) => {
    const exists = (await tx.get(target)).exists();
    if (!exists) tx.set(target, { ...data, projectId: toProjectId, updatedAt: serverTimestamp() });
    tx.delete(doc(itemsCol(uid), id));
    return exists ? ("merged" as const) : ("moved" as const);
  });
  syncProjects([item.projectId, toProjectId]);
  return result;
}

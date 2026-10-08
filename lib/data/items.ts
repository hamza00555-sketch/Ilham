"use client";

import {
  arrayRemove,
  arrayUnion,
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
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { canonicalizeUrl, hashUrl } from "@/shared/normalize";
import { buildItem, makeNote, MAX_NOTES } from "@/shared/items";
import { itemId, type AddedBy, type IngestHints, type Item, type ItemNote, type ItemStatus } from "@/shared/types";
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

/** One item, live: the detail sheet follows new notes and finished previews. `null` once it's gone. */
export function useItem(uid: string, id: string): ItemDoc | null | undefined {
  const [state, setState] = useState<{ id: string; item: ItemDoc | null }>();
  useEffect(
    () =>
      onSnapshot(
        doc(itemsCol(uid), id),
        (snap) => setState({ id, item: snap.exists() ? { id: snap.id, ...(snap.data() as Item) } : null }),
        () => setState({ id, item: null }),
      ),
    [uid, id],
  );
  return state?.id === id ? state.item : undefined;
}

/** Your note on a reference. Agents read notes with get_item and answer with add_note. */
export async function addUserNote(uid: string, item: ItemDoc, text: string) {
  const note = makeNote("user", text);
  if (!note) return;
  if ((item.notes?.length ?? 0) >= MAX_NOTES) throw Object.assign(new Error("too-many-notes"), { code: "too-many-notes" });
  await updateDoc(doc(itemsCol(uid), item.id), { notes: arrayUnion(note), awaitingReply: true, ...touch });
}

/** Asks the built-in agent (Claude) to answer the latest note on a reference. */
export function askAgent(id: string) {
  return callApi("/api/notes/reply", { itemId: id });
}

let chatConfigured: Promise<boolean> | undefined;

/** Whether this deployment can answer notes (ANTHROPIC_API_KEY set). Asked once per session. */
export function useAgentChatConfigured(): boolean | undefined {
  const [configured, setConfigured] = useState<boolean>();
  useEffect(() => {
    chatConfigured ??= callApi<{ configured: boolean }>("/api/notes/reply")
      .then((r) => r.configured)
      .catch(() => false);
    let live = true;
    void chatConfigured.then((value) => live && setConfigured(value));
    return () => {
      live = false;
    };
  }, []);
  return configured;
}

export async function removeNote(uid: string, item: ItemDoc, note: ItemNote) {
  const rest = (item.notes ?? []).filter((n) => n.id !== note.id);
  await updateDoc(doc(itemsCol(uid), item.id), {
    notes: arrayRemove(note),
    awaitingReply: rest.at(-1)?.by === "user",
    ...touch,
  });
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
  const { id, item } = await buildItem(projectId, input, opts);
  const ref = doc(itemsCol(uid), id);

  const status = await runTransaction(firebase().db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) return "duplicate" as const;
    tx.set(ref, { ...item, addedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return "added" as const;
  });
  if (status === "added") kickIngest(uid, id);
  return { status, id };
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
 * ingestion a server request abandoned, ingestion our own server failed ("internal", e.g. a bad
 * deploy), and pages that blocked us. Each item is nudged at most once per session.
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
      // Our own failures, and pages that blocked us (the reader fallback may get through now).
      const serverFailed = item.ingest === "failed" && (item.ingestError === "internal" || item.ingestError === "blocked");
      if (!stuck && !serverFailed) continue;
      resumed.add(item.id);
      if (serverFailed) void retryIngest(uid, item.id).catch(() => undefined);
      else kickIngest(uid, item.id);
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

/** Inbox decisions: keep moves an agent pick into the project, discard hides it (and teaches taste). */
export async function setItemStatus(uid: string, item: ItemDoc, status: ItemStatus) {
  await updateDoc(doc(itemsCol(uid), item.id), { status, ...touch });
  syncProjects([item.projectId]);
}

export async function keepAll(uid: string, items: ItemDoc[]) {
  const batch = writeBatch(firebase().db);
  for (const item of items) batch.update(doc(itemsCol(uid), item.id), { status: "kept", ...touch });
  await batch.commit();
  syncProjects(items.map((i) => i.projectId));
}

/** Keeps everything waiting in a project's Inbox (when review is turned off for it). Returns how many. */
export async function keepInbox(uid: string, projectId: string): Promise<number> {
  const snap = await getDocs(
    query(itemsCol(uid), where("projectId", "==", projectId), where("status", "==", "inbox"), limit(400)),
  );
  if (snap.empty) return 0;
  const batch = writeBatch(firebase().db);
  snap.docs.forEach((d) => batch.update(d.ref, { status: "kept", ...touch }));
  await batch.commit();
  syncProjects([projectId]);
  return snap.size;
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

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
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { useEffect, useState } from "react";
import { canonicalizeUrl, detectPlatform, extractUrl, hashUrl, titleFromUrl } from "@/shared/normalize";
import { itemId, type AddedBy, type IngestHints, type Item, type ItemStatus } from "@/shared/types";
import { firebase } from "../firebase/client";

export type ItemDoc = Item & { id: string };

const PAGE = 30;
const itemsCol = (uid: string) => collection(firebase().db, "users", uid, "items");

/**
 * Live items of a project, newest first. Grows by a page at a time so the whole visible grid
 * stays realtime (new agent picks and finished previews appear without a refresh).
 */
export function useItems(uid: string, projectId: string, status: ItemStatus = "kept") {
  const [pageCount, setPageCount] = useState(1);
  const [state, setState] = useState<{ key: string; items: ItemDoc[] }>();
  const key = `${uid}/${projectId}/${status}/${pageCount}`;

  useEffect(() => {
    const q = query(
      itemsCol(uid),
      where("projectId", "==", projectId),
      where("status", "==", status),
      orderBy("addedAt", "desc"),
      limit(pageCount * PAGE),
    );
    return onSnapshot(q, (snap) =>
      setState({ key, items: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Item) })) }),
    );
  }, [uid, projectId, status, pageCount, key]);

  // Keep showing the previous page while the bigger one loads.
  const items = state?.items;
  return {
    items,
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
  return { status, id };
}

function cleanHints(hints?: IngestHints): IngestHints | null {
  if (!hints) return null;
  const out: IngestHints = {};
  if (hints.imageUrl && /^https?:\/\//i.test(hints.imageUrl)) out.imageUrl = hints.imageUrl;
  if (hints.videoUrl && /^https?:\/\//i.test(hints.videoUrl)) out.videoUrl = hints.videoUrl;
  if (hints.title?.trim()) out.title = hints.title.trim().slice(0, 200);
  if (hints.imagePath) out.imagePath = hints.imagePath;
  return Object.keys(out).length ? out : null;
}

const touch = { updatedAt: serverTimestamp() };

export function retryIngest(uid: string, id: string) {
  return updateDoc(doc(itemsCol(uid), id), { ingest: "queued", ingestError: null, ...touch });
}

export function setPreviewFromUrl(uid: string, id: string, imageUrl: string) {
  return updateDoc(doc(itemsCol(uid), id), { hints: { imageUrl }, ingest: "queued", ingestError: null, ...touch });
}

export async function setPreviewFromFile(uid: string, id: string, file: File) {
  const ext = (file.type.split("/")[1] ?? "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
  const path = `users/${uid}/uploads/${id}-${Date.now()}.${ext}`;
  await uploadBytes(storageRef(firebase().storage, path), file, { contentType: file.type || "image/png" });
  return updateDoc(doc(itemsCol(uid), id), { hints: { imagePath: path }, ingest: "queued", ingestError: null, ...touch });
}

export function deleteItem(uid: string, id: string) {
  return deleteDoc(doc(itemsCol(uid), id));
}

/** Puts a deleted item back exactly as it was (used by the undo toast). */
export function restoreItem(uid: string, item: ItemDoc) {
  const { id, ...data } = item;
  return setDoc(doc(itemsCol(uid), id), data as DocumentData);
}

export async function moveItem(uid: string, item: ItemDoc, toProjectId: string): Promise<"moved" | "merged"> {
  const { db } = firebase();
  const { id, ...data } = item;
  const target = doc(itemsCol(uid), itemId(toProjectId, item.urlHash));
  return runTransaction(db, async (tx) => {
    const exists = (await tx.get(target)).exists();
    if (!exists) tx.set(target, { ...data, projectId: toProjectId, updatedAt: serverTimestamp() });
    tx.delete(doc(itemsCol(uid), id));
    return exists ? "merged" : "moved";
  });
}

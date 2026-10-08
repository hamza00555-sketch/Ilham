"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { slugify } from "@/shared/slug";
import type { Project } from "@/shared/types";
import { firebase } from "../firebase/client";

export type ProjectDoc = Project & { id: string };

const projectsCol = (uid: string) => collection(firebase().db, "users", uid, "projects");

/** All projects, most recently active first. `undefined` while loading. */
export function useProjects(uid: string): ProjectDoc[] | undefined {
  const [projects, setProjects] = useState<ProjectDoc[]>();
  useEffect(
    () =>
      onSnapshot(query(projectsCol(uid), orderBy("updatedAt", "desc")), (snap) =>
        setProjects(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Project) }))),
      ),
    [uid],
  );
  return projects;
}

/** `undefined` while loading, `null` when no project has this slug. */
export function useProjectBySlug(uid: string, slug: string): ProjectDoc | null | undefined {
  const [result, setResult] = useState<{ slug: string; project: ProjectDoc | null }>();
  useEffect(
    () =>
      onSnapshot(query(projectsCol(uid), where("slug", "==", slug), limit(1)), (snap) => {
        const d = snap.docs[0];
        setResult({ slug, project: d ? { id: d.id, ...(d.data() as Project) } : null });
      }),
    [uid, slug],
  );
  return result?.slug === slug ? result.project : undefined;
}

async function uniqueSlug(uid: string, name: string): Promise<string> {
  const base = slugify(name);
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const taken = await getDocs(query(projectsCol(uid), where("slug", "==", candidate), limit(1)));
    if (taken.empty) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createProject(uid: string, name: string): Promise<{ id: string; slug: string }> {
  const slug = await uniqueSlug(uid, name);
  const project: Omit<Project, "createdAt" | "updatedAt"> = {
    slug,
    name: name.trim(),
    description: null,
    brief: {},
    autoCurate: false,
    webhookUrl: null,
    visibility: "private",
    shareToken: null,
    cover: [],
    counts: { kept: 0, inbox: 0 },
  };
  const ref = await addDoc(projectsCol(uid), {
    ...project,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, slug };
}

/** Agent picks for this project: "on" waits in the Inbox, "off" joins directly, null follows the account. */
export function setProjectAgentReview(uid: string, projectId: string, mode: "on" | "off" | null) {
  // No updatedAt: a preference shouldn't move the project to the top of the list.
  return updateDoc(doc(projectsCol(uid), projectId), { agentReview: mode });
}

export function renameProject(uid: string, projectId: string, name: string) {
  return updateDoc(doc(projectsCol(uid), projectId), { name: name.trim(), updatedAt: serverTimestamp() });
}

/** Deletes the project and every item in it. Previews stay in Storage (other projects may share them). */
export async function deleteProject(uid: string, projectId: string) {
  const { db } = firebase();
  const items = collection(db, "users", uid, "items");
  for (;;) {
    const page = await getDocs(query(items, where("projectId", "==", projectId), limit(400)));
    if (page.empty) break;
    const batch = writeBatch(db);
    page.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(projectsCol(uid), projectId));
}

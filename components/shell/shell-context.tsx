"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { addItem } from "@/lib/data/items";
import { useProjects, type ProjectDoc } from "@/lib/data/projects";
import { friendlyError } from "@/lib/errors";
import { extractUrl, InvalidUrlError, titleFromUrl } from "@/shared/normalize";
import type { IngestHints } from "@/shared/types";
import { AddDialog, type AddPrefill } from "./add-dialog";
import { DropOverlay } from "./drop-overlay";

interface Shell {
  uid: string;
  projects: ProjectDoc[] | undefined;
  /** The project the user is looking at; paste/drop goes straight into it. */
  currentProject: ProjectDoc | null;
  setCurrentProjectId: (id: string | null) => void;
  openAdd: (prefill?: AddPrefill) => void;
  /** Adds a link; reports the outcome with a toast unless `quiet` (the caller shows it inline). */
  addTo: (project: ProjectRef, url: string, hints?: IngestHints, opts?: { quiet?: boolean }) => Promise<AddOutcome>;
}

export type ProjectRef = Pick<ProjectDoc, "id" | "name" | "slug">;
export type AddOutcome = "added" | "duplicate" | "error";

const ShellContext = createContext<Shell | null>(null);

export function useShell(): Shell {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell() outside <ShellProvider>");
  return ctx;
}

export function ShellProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const router = useRouter();
  const projects = useProjects(uid);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; prefill?: AddPrefill }>({ open: false });

  const currentProject = useMemo(
    () => projects?.find((p) => p.id === currentProjectId) ?? null,
    [projects, currentProjectId],
  );

  const addTo = useCallback(
    async (project: ProjectRef, url: string, hints?: IngestHints, opts?: { quiet?: boolean }): Promise<AddOutcome> => {
      try {
        const result = await addItem(uid, project.id, url, { hints });
        if (result.status === "duplicate") {
          if (!opts?.quiet) toast("موجود من قبل", { description: `هذا الرابط محفوظ في «${project.name}»` });
          return "duplicate";
        }
        if (!opts?.quiet) {
          toast.success("انضاف", {
            description: hints?.title ?? titleFromUrl(extractUrl(url) ?? url),
            action:
              currentProjectId === project.id
                ? undefined
                : { label: "افتح", onClick: () => router.push(`/p/${project.slug}`) },
          });
        }
        return "added";
      } catch (err) {
        if (opts?.quiet) return "error";
        if (err instanceof InvalidUrlError) toast.error("هذا مو رابط صالح", { description: "الرابط لازم يبدأ بـ https:// أو يكون دومين مثل dribbble.com/…" });
        else toast.error("ما قدرنا نضيفه", { description: friendlyError(err) });
        return "error";
      }
    },
    [uid, currentProjectId, router],
  );

  const openAdd = useCallback((prefill?: AddPrefill) => setDialog({ open: true, prefill }), []);

  // Paste or drop a link anywhere: straight into the open project, otherwise ask where.
  const quickAdd = useCallback(
    (text: string) => {
      const url = extractUrl(text);
      if (!url) return false;
      if (currentProject) void addTo(currentProject, url);
      else openAdd({ url });
      return true;
    },
    [currentProject, addTo, openAdd],
  );
  const quickAddRef = useRef(quickAdd);
  useEffect(() => {
    quickAddRef.current = quickAdd;
  }, [quickAdd]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      if (document.querySelector("[role=dialog]")) return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (quickAddRef.current(text)) e.preventDefault();
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const value = useMemo<Shell>(
    () => ({ uid, projects, currentProject, setCurrentProjectId, openAdd, addTo }),
    [uid, projects, currentProject, openAdd, addTo],
  );

  return (
    <ShellContext.Provider value={value}>
      {children}
      <AddDialog
        open={dialog.open}
        prefill={dialog.prefill}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <DropOverlay onDropText={(text) => quickAddRef.current(text)} target={currentProject?.name ?? null} />
    </ShellContext.Provider>
  );
}

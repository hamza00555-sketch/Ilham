"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { projectCountLabel } from "@/lib/ui";
import { NewProjectDialog } from "../shell/new-project-dialog";
import { useShell } from "../shell/shell-context";
import { Wordmark } from "../ui/brand";
import { Button } from "../ui/button";
import { ProjectCard } from "./project-card";

export function ProjectsHome() {
  const { projects, setCurrentProjectId } = useShell();
  const [creating, setCreating] = useState(false);

  useEffect(() => setCurrentProjectId(null), [setCurrentProjectId]);

  return (
    <div className="px-4 pt-5 md:px-10 md:pt-10">
      <Wordmark className="text-[17px] md:hidden" />

      <header className="mt-8 flex items-end justify-between gap-4 md:mt-0">
        <div>
          <h1 className="font-arabic text-3xl font-semibold tracking-tight md:text-[40px]">المشاريع</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {projects === undefined ? "…" : projectCountLabel(projects.length)}
          </p>
        </div>
        <Button variant="secondary" className="max-md:h-11" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          مشروع جديد
        </Button>
      </header>

      {projects === undefined ? (
        <Grid>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <div className="shimmer-surface aspect-[4/3] rounded-card bg-raised" />
              <div className="mt-3 h-4 w-2/3 rounded bg-raised" />
            </div>
          ))}
        </Grid>
      ) : projects.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <Grid>
          {projects.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </Grid>
      )}

      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 md:mt-10 md:grid-cols-3 md:gap-y-9 xl:grid-cols-4">
      {children}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-10 grid place-items-center rounded-3xl border border-dashed border-line-strong px-6 py-20 text-center md:py-28">
      <div className="grid grid-cols-3 gap-1.5 opacity-70" aria-hidden>
        {["#1d3b53", "#5a2a17", "#2e2457", "#14453d", "#4b1f3a", "#22324f"].map((c) => (
          <span key={c} className="h-8 w-11 rounded-md" style={{ background: c }} />
        ))}
      </div>
      <h2 className="mt-8 font-arabic text-xl font-semibold">أول لوحة إلهام</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-ink-muted">
        سوّ مشروع لكل فكرة، وابدأ تلصق روابط من Dribbble و Behance و YouTube أو أي موقع.
      </p>
      <Button variant="primary" size="lg" className="mt-8" onClick={onCreate}>
        <Plus className="size-4" />
        مشروع جديد
      </Button>
    </div>
  );
}

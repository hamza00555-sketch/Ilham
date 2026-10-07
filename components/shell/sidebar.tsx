"use client";

import { ChevronUp, LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { usePasteShortcut } from "@/lib/keys";
import type { ProjectDoc } from "@/lib/data/projects";
import { cn } from "@/lib/ui";
import { Avatar, Wordmark } from "../ui/brand";
import { Button } from "../ui/button";
import { NewProjectDialog } from "./new-project-dialog";
import { useShell } from "./shell-context";
import { UserMenu } from "./user-menu";

function ProjectThumb({ project }: { project: ProjectDoc }) {
  const tile = project.cover?.[0];
  return (
    <span
      className="size-7 shrink-0 overflow-hidden rounded-md bg-hover bg-cover bg-center ring-1 ring-line ring-inset"
      style={tile ? { backgroundImage: `url(${tile.url}), url(${tile.lqip})`, backgroundColor: tile.color } : undefined}
    />
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { projects, openAdd } = useShell();
  const [creating, setCreating] = useState(false);
  const paste = usePasteShortcut();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-line bg-canvas px-3 py-5 md:flex">
      <Link href="/" className="px-2.5 text-[17px]">
        <Wordmark />
      </Link>

      <Button variant="primary" className="mx-1 mt-6" onClick={() => openAdd()}>
        <Plus className="size-4" />
        أضف مرجع
      </Button>
      <p className="mx-2 mt-2.5 text-xs text-ink-faint">
        أو الصق رابط في أي مكان{" "}
        <kbd className="rounded border border-line-strong px-1 font-mono text-[11px]" dir="ltr">
          {paste}
        </kbd>
      </p>

      <nav className="mt-6 space-y-0.5">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition",
            pathname === "/" ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised hover:text-ink",
          )}
        >
          <LayoutGrid className="size-4" />
          المشاريع
        </Link>
      </nav>

      <div className="mt-6 flex items-center justify-between px-2.5">
        <span className="text-xs font-medium text-ink-faint">مشاريعك</span>
        <button
          onClick={() => setCreating(true)}
          className="-me-1.5 grid size-8 place-items-center rounded-lg text-ink-muted transition hover:bg-raised hover:text-ink"
          aria-label="مشروع جديد"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="scrollbar-none mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {projects?.map((p) => {
          const active = pathname === `/p/${p.slug}`;
          return (
            <Link
              key={p.id}
              href={`/p/${p.slug}`}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition",
                active ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised hover:text-ink",
              )}
            >
              <ProjectThumb project={p} />
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {p.name}
              </span>
              <span className="text-xs tabular-nums text-ink-faint">{p.counts?.kept || ""}</span>
            </Link>
          );
        })}
        {projects?.length === 0 ? <p className="px-2.5 py-2 text-xs text-ink-faint">لسا ما فيه مشاريع.</p> : null}
      </div>

      {user ? (
        <UserMenu>
          <button className="mt-3 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition hover:bg-raised">
            <Avatar name={user.displayName ?? user.email ?? "?"} src={user.photoURL} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{user.displayName ?? "حسابك"}</span>
              <span className="block truncate text-xs text-ink-faint" dir="ltr">
                {user.email}
              </span>
            </span>
            <ChevronUp className="size-4 text-ink-faint" />
          </button>
        </UserMenu>
      ) : null}

      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </aside>
  );
}

"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createProject } from "@/lib/data/projects";
import { cn, countLabel } from "@/lib/ui";
import { displayHost, extractUrl, titleFromUrl } from "@/shared/normalize";
import { useShell, type ProjectRef } from "./shell/shell-context";
import { Button } from "./ui/button";
import { inputClass } from "./ui/dialog";

/** /add?url=…&title=…&image=… — opened by the bookmarklet and the Android share sheet. */
export function AddFromLink() {
  const params = useSearchParams();
  const { uid, projects, addTo } = useShell();
  const url = extractUrl(params.get("url") ?? "") ?? extractUrl(params.get("text") ?? "");
  const title = params.get("title")?.trim() || (url ? titleFromUrl(url) : "");
  const image = params.get("image")?.trim() || undefined;
  const [done, setDone] = useState<ProjectRef | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [imageOk, setImageOk] = useState(true);

  if (!url) {
    return (
      <Centered>
        <p className="font-arabic text-lg font-semibold">ما فيه رابط نضيفه</p>
        <Link href="/" className="mt-3 inline-block text-sm text-ink-muted hover:text-ink">
          رجوع للمشاريع
        </Link>
      </Centered>
    );
  }

  const add = async (project: ProjectRef) => {
    setBusy(project.id);
    try {
      await addTo(project, url, { imageUrl: image, title });
      setDone(project);
    } finally {
      setBusy(null);
    }
  };

  const addToNew = async () => {
    if (!newName.trim()) return;
    setBusy("new");
    const created = await createProject(uid, newName);
    await add({ id: created.id, slug: created.slug, name: newName.trim() });
  };

  return (
    <Centered>
      <div className="overflow-hidden rounded-2xl border border-line-strong bg-surface text-start">
        {image && imageOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" onError={() => setImageOk(false)} className="aspect-[4/3] w-full object-cover object-top" />
        ) : null}
        <div className="p-4">
          <p className="line-clamp-2 font-medium" dir="auto">
            {title}
          </p>
          <p className="mt-1 text-xs text-ink-faint" dir="ltr">
            {displayHost(url)}
          </p>
        </div>
      </div>

      {done ? (
        <div className="mt-6 text-center">
          <span className="mx-auto grid size-10 place-items-center rounded-full bg-ink text-canvas">
            <Check className="size-5" />
          </span>
          <p className="mt-3 font-medium">
            انضاف إلى «<span dir="auto">{done.name}</span>»
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link
              href={`/p/${done.slug}`}
              className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-canvas transition hover:bg-white"
            >
              افتح المشروع
            </Link>
            <Button variant="secondary" onClick={() => window.close()}>
              إغلاق
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-7 mb-3 text-sm font-medium text-ink-muted">وين تبي تحطه؟</p>
          <div className="space-y-1.5">
            {projects?.map((p) => (
              <button
                key={p.id}
                onClick={() => void add(p)}
                disabled={!!busy}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-start transition hover:border-line-strong hover:bg-raised disabled:opacity-50",
                  busy === p.id && "border-ink",
                )}
              >
                <span
                  className="size-10 shrink-0 rounded-lg bg-hover bg-cover bg-center"
                  style={p.cover?.[0] ? { backgroundImage: `url(${p.cover[0].url})` } : undefined}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" dir="auto">
                    {p.name}
                  </span>
                  <span className="text-xs text-ink-faint">{countLabel(p.counts?.kept ?? 0)}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="مشروع جديد…"
              className={inputClass}
              dir="auto"
            />
            <Button variant="secondary" size="icon" className="size-11" onClick={() => void addToNew()} disabled={!newName.trim() || !!busy}>
              <Plus className="size-4" />
            </Button>
          </div>
        </>
      )}
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-md px-4 pt-10 pb-16 md:pt-16">{children}</div>;
}

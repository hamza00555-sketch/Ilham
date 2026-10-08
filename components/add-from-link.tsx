"use client";

import { ArrowUpRight, Check, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { findProjectsWithUrl } from "@/lib/data/items";
import { createProject } from "@/lib/data/projects";
import { cn, countLabel } from "@/lib/ui";
import { displayHost, extractUrl, titleFromUrl } from "@/shared/normalize";
import { useShell, type ProjectRef } from "./shell/shell-context";
import { Button } from "./ui/button";
import { inputClass } from "./ui/dialog";

type Result = { project: ProjectRef; outcome: "added" | "duplicate" };

/** /add?url=…&title=…&image=…&video=… — opened by the bookmarklet and the Android share sheet. */
export function AddFromLink() {
  const params = useSearchParams();
  const { uid, projects, addTo } = useShell();
  const url = extractUrl(params.get("url") ?? "") ?? extractUrl(params.get("text") ?? "");
  const title = params.get("title")?.trim() || (url ? titleFromUrl(url) : "");
  const image = httpUrl(params.get("image"));
  const video = httpUrl(params.get("video"));
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [imageOk, setImageOk] = useState(true);
  const [savedIn, setSavedIn] = useState<Set<string>>();

  // Before the user picks: where is this link already saved?
  useEffect(() => {
    if (!url) return;
    let alive = true;
    findProjectsWithUrl(uid, url)
      .then((ids) => alive && setSavedIn(ids))
      .catch(() => alive && setSavedIn(new Set()));
    return () => {
      alive = false;
    };
  }, [uid, url]);

  if (!url) {
    return (
      <Centered>
        <h1 className="font-arabic text-lg font-semibold">ما فيه رابط نضيفه</h1>
        <Link href="/" className="mt-3 inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-ink">
          رجوع للمشاريع
        </Link>
      </Centered>
    );
  }

  const add = async (project: ProjectRef) => {
    setBusy(project.id);
    setFailed(false);
    try {
      const outcome = await addTo(project, url, { imageUrl: image, videoUrl: video, title }, { quiet: true });
      if (outcome === "error") setFailed(true);
      else setResult({ project, outcome });
    } finally {
      setBusy(null);
    }
  };

  const addToNew = async () => {
    if (!newName.trim()) return;
    setBusy("new");
    setFailed(false);
    try {
      const created = await createProject(uid, newName);
      await add({ id: created.id, slug: created.slug, name: newName.trim() });
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Centered>
      <div className="overflow-hidden rounded-2xl border border-line-strong bg-surface">
        {image && imageOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            onError={() => setImageOk(false)}
            className="aspect-[4/3] w-full object-cover object-top"
          />
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

      {result ? (
        <div className="mt-8 text-center" role="status">
          <span className="mx-auto grid size-10 place-items-center rounded-full bg-ink text-canvas">
            <Check className="size-5" />
          </span>
          <p className="mt-3 font-medium">
            {result.outcome === "added" ? "انضاف إلى" : "محفوظ من قبل في"} «<bdi>{result.project.name}</bdi>»
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link
              href={`/p/${result.project.slug}`}
              className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-canvas transition hover:bg-white"
            >
              افتح المشروع
            </Link>
            <Button variant="secondary" size="lg" className="h-11" onClick={() => window.close()}>
              إغلاق
            </Button>
          </div>
        </div>
      ) : (
        <>
          <h1 className="mt-8 mb-3 font-arabic text-lg font-semibold">وين تبي تحطه؟</h1>
          {failed ? (
            <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
              ما قدرنا نضيفه. تأكد من الاتصال وجرّب مرة ثانية.
            </p>
          ) : null}
          <div className="space-y-1.5">
            {projects?.map((p) => {
              const saved = savedIn?.has(p.id);
              const thumb = (
                <span
                  className="size-10 shrink-0 rounded-lg bg-hover bg-cover bg-center"
                  style={p.cover?.[0] ? { backgroundImage: `url(${p.cover[0].url})` } : undefined}
                />
              );
              const label = (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" dir="auto">
                    {p.name}
                  </span>
                  <span className="text-xs text-ink-faint">
                    {saved ? "محفوظ هنا" : countLabel(p.counts?.kept ?? 0)}
                  </span>
                </span>
              );
              return saved ? (
                <Link
                  key={p.id}
                  href={`/p/${p.slug}`}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-ink-muted transition hover:bg-raised"
                >
                  {thumb}
                  {label}
                  <ArrowUpRight className="size-4 shrink-0" />
                </Link>
              ) : (
                <button
                  key={p.id}
                  onClick={() => void add(p)}
                  disabled={!!busy || savedIn === undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-start transition hover:border-line-strong hover:bg-raised disabled:opacity-50",
                    busy === p.id && "border-ink",
                  )}
                >
                  {thumb}
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="مشروع جديد…"
              aria-label="اسم مشروع جديد"
              className={inputClass}
              dir={newName ? "auto" : "rtl"}
            />
            <Button
              variant="secondary"
              size="icon"
              className="size-11"
              onClick={() => void addToNew()}
              disabled={!newName.trim() || !!busy}
              aria-label="أنشئ المشروع وأضف المرجع"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </>
      )}
    </Centered>
  );
}

function httpUrl(value: string | null): string | undefined {
  const v = value?.trim();
  return v && /^https?:\/\//i.test(v) ? v : undefined;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-md px-4 pt-10 pb-16 md:pt-16">{children}</div>;
}

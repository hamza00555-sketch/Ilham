"use client";

import { Check, ChevronRight, Link2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { keepAll, setItemStatus, useItems, useResumeIngest, type ItemDoc, type QueryError } from "@/lib/data/items";
import { friendlyError } from "@/lib/errors";
import { usePasteShortcut } from "@/lib/keys";
import type { ProjectDoc } from "@/lib/data/projects";
import { cn, countLabel, PLATFORMS } from "@/lib/ui";
import type { Platform } from "@/shared/types";
import { useShell } from "../shell/shell-context";
import { Button } from "../ui/button";
import { Spark } from "../ui/brand";
import { BentoBoard } from "./bento-board";
import { ItemDetail } from "./item-detail";
import { ProjectMenu } from "./project-menu";

export function ProjectView() {
  const { slug } = useParams<{ slug: string }>();
  const { projects, setCurrentProjectId } = useShell();
  const project = projects?.find((p) => p.slug === decodeURIComponent(slug));

  useEffect(() => {
    setCurrentProjectId(project?.id ?? null);
    return () => setCurrentProjectId(null);
  }, [project?.id, setCurrentProjectId]);

  if (projects === undefined) return <GridSkeleton />;
  if (!project) return <NotFound />;
  return <ProjectBoard key={project.id} project={project} />;
}

function ProjectBoard({ project }: { project: ProjectDoc }) {
  const { openAdd } = useShell();
  const inboxCount = project.counts?.inbox ?? 0;
  const keptCount = project.counts?.kept ?? 0;
  const [tab, setTab] = useState<"kept" | "inbox">("kept");

  return (
    <div className="pt-5 md:pt-10">
      <header className="px-4 md:px-10">
        <Link
          href="/"
          className="-ms-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-ink-muted transition hover:text-ink md:hidden"
        >
          <ChevronRight className="size-4" />
          المشاريع
        </Link>
        <div className="mt-2 flex items-end justify-between gap-4 md:mt-0">
          <div className="min-w-0">
            <h1 className="truncate font-arabic text-3xl font-semibold tracking-tight text-balance md:text-[40px]" dir="auto">
              {project.name}
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              {countLabel(keptCount)}
              {project.description ? <span className="text-ink-faint"> · {project.description}</span> : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {/* Phones add from the bottom bar (thumb zone); desktop's primary Add lives in the sidebar. */}
            <Button variant="secondary" className="max-md:hidden" onClick={() => openAdd({ projectId: project.id })}>
              <Plus className="size-4" />
              أضف مرجع
            </Button>
            <ProjectMenu project={project} leaveOnDelete />
          </div>
        </div>

        {/* The Inbox only takes space when an agent has left something in it. */}
        {inboxCount > 0 || tab === "inbox" ? (
          <div role="tablist" aria-label="عرض المشروع" className="mt-5 flex gap-2">
            <Chip active={tab === "kept"} onClick={() => setTab("kept")} role="tab">
              المراجع
              <span className={cn("tabular-nums", tab === "kept" ? "text-canvas/60" : "text-ink-faint")}>{keptCount}</span>
            </Chip>
            <Chip active={tab === "inbox"} onClick={() => setTab("inbox")} role="tab">
              <Spark className={cn("size-3", tab === "inbox" ? "text-canvas" : "text-signal")} />
              الوارد
              <span className={cn("tabular-nums", tab === "inbox" ? "text-canvas/60" : "text-signal")}>{inboxCount}</span>
            </Chip>
          </div>
        ) : null}
      </header>

      {tab === "inbox" ? (
        <InboxView project={project} onBack={() => setTab("kept")} />
      ) : (
        <KeptView project={project} />
      )}
    </div>
  );
}

function KeptView({ project }: { project: ProjectDoc }) {
  const { uid, openAdd } = useShell();
  const { items, error, hasMore, loadMore, loadingMore } = useItems(uid, project.id);
  useResumeIngest(uid, items);
  const [filter, setFilter] = useState<Platform | "all">("all");

  const platforms = useMemo(() => {
    const counts = new Map<Platform, number>();
    items?.forEach((i) => counts.set(i.platform, (counts.get(i.platform) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const visible = filter === "all" ? items : items?.filter((i) => i.platform === filter);

  return (
    <>
      {/* Filters earn their place only once a board is big and varied enough to need them. */}
      {platforms.length > 1 && (items?.length ?? 0) >= 6 ? (
        <div
          role="group"
          aria-label="فلترة حسب المنصة"
          className="scrollbar-none mt-5 flex gap-2 overflow-x-auto px-4 py-1.5 [mask-image:linear-gradient(to_left,transparent,black_28px)] md:px-10 md:[mask-image:none]"
        >
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            الكل
          </Chip>
          {platforms.map(([p, n]) => (
            <Chip key={p} active={filter === p} onClick={() => setFilter(p)} color={PLATFORMS[p].color}>
              {PLATFORMS[p].label}
              <span className="text-ink-faint tabular-nums">{n}</span>
            </Chip>
          ))}
        </div>
      ) : null}

      {error ? (
        <BoardError error={error} />
      ) : items === undefined ? (
        <GridSkeleton bare />
      ) : items.length === 0 ? (
        <EmptyBoard onAdd={() => openAdd({ projectId: project.id })} />
      ) : (
        <>
          <BentoBoard items={visible ?? []} />
          {hasMore ? <Sentinel onVisible={loadMore} busy={loadingMore} /> : null}
        </>
      )}
      <ItemDetail ids={visible?.map((i) => i.id) ?? []} />
    </>
  );
}

/** Agent picks wait here: keep what fits, discard the rest (discards teach get_taste). */
function InboxView({ project, onBack }: { project: ProjectDoc; onBack: () => void }) {
  const { uid } = useShell();
  const { items, error, hasMore, loadMore, loadingMore } = useItems(uid, project.id, "inbox");
  useResumeIngest(uid, items);
  const [keeping, setKeeping] = useState(false);

  const keepEverything = async () => {
    if (!items?.length) return;
    setKeeping(true);
    try {
      await keepAll(uid, items);
      toast(`انضاف ${countLabel(items.length)} للمشروع`);
    } catch (err) {
      toast.error("ما قدرنا نحفظها", { description: friendlyError(err) });
    } finally {
      setKeeping(false);
    }
  };

  if (error) return <BoardError error={error} />;
  if (items === undefined) return <GridSkeleton bare />;
  if (!items.length) {
    return (
      <div className="mx-4 mt-8 grid place-items-center rounded-3xl border border-dashed border-line-strong px-6 py-16 text-center md:mx-10">
        <span className="grid size-12 place-items-center rounded-full bg-raised text-signal">
          <Spark className="size-5" />
        </span>
        <h2 className="mt-5 font-arabic text-xl font-semibold">الوارد فاضي</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-ink-muted">
          لما يضيف وكيل مراجع لهذا المشروع، توصل هنا تنتظر قرارك.
        </p>
        <Button variant="secondary" className="mt-6" onClick={onBack}>
          ارجع للمراجع
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 flex items-center justify-between gap-4 px-4 md:px-10">
        <p className="text-sm text-ink-muted">اقتراحات الوكيل. احتفظ باللي يعجبك، والباقي ارمِه عشان يتعلم ذوقك.</p>
        <Button variant="secondary" size="sm" className="shrink-0 max-md:h-11" onClick={() => void keepEverything()} disabled={keeping}>
          <Check className="size-3.5" />
          احتفظ بالكل
        </Button>
      </div>
      <BentoBoard items={items} actions={(item) => <InboxTileActions item={item} />} />
      {hasMore ? <Sentinel onVisible={loadMore} busy={loadingMore} /> : null}
      <ItemDetail ids={items.map((i) => i.id)} />
    </>
  );
}

/** Keep / discard at the foot of an Inbox tile: always on phones, on hover or focus on desktop. */
function InboxTileActions({ item }: { item: ItemDoc }) {
  const { uid } = useShell();
  const decide = async (status: "kept" | "discarded") => {
    try {
      await setItemStatus(uid, item, status);
      if (status === "discarded") {
        toast("انرمى", { action: { label: "تراجع", onClick: () => void setItemStatus(uid, item, "inbox") } });
      }
    } catch (err) {
      toast.error("ما قدرنا نحدّثه", { description: friendlyError(err) });
    }
  };
  return (
    <div className="absolute inset-x-2 bottom-2 flex gap-1.5 transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
      <button
        type="button"
        onClick={() => void decide("kept")}
        className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink text-[13px] font-medium text-canvas shadow-lg shadow-black/30 transition-[background-color,transform] duration-150 ease-out hover:bg-white active:scale-[0.97] md:h-8"
      >
        <Check className="size-3.5" />
        احتفظ
      </button>
      <button
        type="button"
        onClick={() => void decide("discarded")}
        className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-black/60 text-[13px] font-medium text-white backdrop-blur transition-[background-color,transform] duration-150 ease-out hover:bg-black/80 active:scale-[0.97] md:h-8"
      >
        <X className="size-3.5" />
        ارمِ
      </button>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 px-4 sm:gap-x-5 sm:gap-y-8 md:mt-8 md:grid-cols-3 md:px-10 xl:grid-cols-4 2xl:grid-cols-5">
      {children}
    </div>
  );
}

function Chip({
  active,
  color,
  onClick,
  role,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  role?: "tab";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      role={role}
      aria-pressed={role ? undefined : active}
      aria-selected={role ? active : undefined}
      className={cn(
        // 32px pill, 44px tap target via the invisible inset.
        "relative inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0",
        active ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink-muted hover:border-ink-faint hover:text-ink",
      )}
    >
      {color && !active ? <span className="size-1.5 rounded-full" style={{ background: color }} /> : null}
      {children}
    </button>
  );
}

function Sentinel({ onVisible, busy }: { onVisible: () => void; busy: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onVisible);
  useEffect(() => {
    callback.current = onVisible;
  }, [onVisible]);
  useEffect(() => {
    const el = ref.current;
    if (!el || busy) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && callback.current(), {
      rootMargin: "800px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [busy]);
  return <div ref={ref} className="h-24" aria-hidden />;
}

function EmptyBoard({ onAdd }: { onAdd: () => void }) {
  const paste = usePasteShortcut();
  return (
    <div className="mx-4 mt-8 grid place-items-center rounded-3xl border border-dashed border-line-strong px-6 py-20 text-center md:mx-10 md:py-28">
      <span className="grid size-12 place-items-center rounded-full bg-raised">
        <Link2 className="size-5 text-ink-muted" />
      </span>
      <h2 className="mt-6 font-arabic text-xl font-semibold">الصق رابط أو اسحبه هنا</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-ink-muted">
        أي صفحة فيها شغل يلهمك: Dribbble، Behance، YouTube، Vimeo، Awwwards… البريفيو يطلع لحاله.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Button variant="primary" size="lg" onClick={onAdd}>
          <Plus className="size-4" />
          أضف مرجع
        </Button>
        <kbd className="hidden rounded-lg border border-line-strong px-2.5 py-1.5 font-mono text-xs text-ink-faint md:block" dir="ltr">
          {paste}
        </kbd>
      </div>
    </div>
  );
}

function GridSkeleton({ bare }: { bare?: boolean }) {
  return (
    <div className={bare ? "" : "pt-5 md:pt-10"}>
      {bare ? null : (
        <div className="px-4 md:px-10">
          <div className="h-10 w-56 rounded-lg bg-raised" />
          <div className="mt-3 h-4 w-24 rounded bg-raised" />
        </div>
      )}
      <Grid>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <div className="shimmer-surface aspect-[4/3] rounded-card bg-raised" />
            <div className="mt-3 h-3.5 w-3/4 rounded bg-raised" />
          </div>
        ))}
      </Grid>
    </div>
  );
}

/** The items query failed: say why instead of shimmering forever. */
function BoardError({ error }: { error: QueryError }) {
  const missingIndex = error.code === "failed-precondition";
  const reason = missingIndex
    ? "قاعدة البيانات تحتاج فهرس (index) للمراجع. لو أنشأته، انتظر لين يصير Enabled وحدّث الصفحة."
    : friendlyError(error);
  return (
    <div className="grid min-h-[50dvh] place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="font-arabic text-xl font-semibold">ما قدرنا نجيب المراجع</p>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{reason}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {missingIndex && error.fixUrl ? (
            <a
              href={error.fixUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-canvas transition-[background-color,transform] duration-150 ease-out hover:bg-white active:scale-[0.97]"
            >
              أنشئ الفهرس بضغطة
            </a>
          ) : null}
          <Button variant="secondary" onClick={() => window.location.reload()}>
            حدّث الصفحة
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-6 text-center">
      <div>
        <p className="font-arabic text-xl font-semibold">المشروع مو موجود</p>
        <Link href="/" className="mt-3 inline-block text-sm text-ink-muted underline-offset-4 hover:underline">
          رجوع للمشاريع
        </Link>
      </div>
    </div>
  );
}

export { GridSkeleton };

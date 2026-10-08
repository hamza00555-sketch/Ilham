"use client";

import { ArrowUp, ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, Link2, RotateCw, Trash2, UserPlus, X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useParams, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  addUserNote,
  askAgent,
  removeNote,
  setItemStatus,
  useAgentChatConfigured,
  useItem,
  type ItemDoc,
} from "@/lib/data/items";
import { friendlyError } from "@/lib/errors";
import { releaseMotion, useCanHover } from "@/lib/motion";
import { cn, formatPublished, PLATFORMS, relativeTime } from "@/lib/ui";
import { displayHost } from "@/shared/normalize";
import type { ItemNote } from "@/shared/types";
import { threadInvite } from "@/shared/threads";
import { playerSource } from "@/shared/video";
import { useShell } from "../shell/shell-context";
import { Avatar, Spark } from "../ui/brand";
import { Button } from "../ui/button";
import { ItemMenu } from "./item-menu";
import { PreviewDialog } from "./preview-dialog";

// The open reference lives in the URL (?ref=<item id>): Back closes it, and the link can be shared
// with yourself on another device. Prev/next replace the entry, so Back always returns to the board.
const PARAM = "ref";
// Paragraphs follow their own language's edge (English reads ragged-right), unlike one-line titles,
// which the global rule aligns with the Arabic UI.
const prose = { textAlign: "start" } as const;
const ITEM_ID = /^[\w-]{1,64}__[a-f0-9]{64}$/;
const nav = { pushed: false };

export function openRef(id: string) {
  releaseMotion(id);
  const params = new URLSearchParams(window.location.search);
  params.set(PARAM, id);
  window.history.pushState(null, "", `?${params}`);
  nav.pushed = true;
}

function switchRef(id: string) {
  const params = new URLSearchParams(window.location.search);
  params.set(PARAM, id);
  window.history.replaceState(null, "", `?${params}`);
}

function closeRef() {
  if (nav.pushed) {
    nav.pushed = false;
    window.history.back();
    return;
  }
  const params = new URLSearchParams(window.location.search);
  params.delete(PARAM);
  const query = params.toString();
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
}

/** A reference up close: the work, who made it and how, and the notes between you and your agents. */
export function ItemDetail({ ids }: { ids: string[] }) {
  const ref = useSearchParams().get(PARAM);
  const id = ref && ITEM_ID.test(ref) ? ref : null;

  useEffect(() => {
    if (!id) nav.pushed = false;
  }, [id]);

  return (
    <D.Root open={!!id} onOpenChange={(open) => !open && closeRef()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-fade" />
        <D.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "fixed z-50 flex flex-col overflow-y-auto overscroll-contain border-line-strong bg-surface shadow-2xl shadow-black/60 outline-none animate-rise",
            // Phone: a full-height sheet that scrolls as one column.
            "inset-x-0 bottom-0 top-[max(0.75rem,env(safe-area-inset-top))] rounded-t-3xl border-t",
            // Desktop: the work on one side, the story on the other.
            "md:inset-6 md:m-auto md:grid md:max-h-[900px] md:max-w-[1320px] md:grid-cols-[minmax(0,1fr)_400px] md:grid-rows-[auto_minmax(0,1fr)_auto] md:overflow-hidden md:rounded-3xl md:border xl:grid-cols-[minmax(0,1fr)_440px]",
          )}
        >
          {id ? <DetailBody key={id} id={id} ids={ids} /> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function DetailBody({ id, ids }: { id: string; ids: string[] }) {
  const { uid } = useShell();
  const item = useItem(uid, id);
  const [previewOpen, setPreviewOpen] = useState(false);
  // After you send a note, the thread keeps its end in view while the reply arrives.
  const [following, setFollowing] = useState(false);
  const index = ids.indexOf(id);
  const prev = index > 0 ? ids[index - 1] : null;
  const next = index >= 0 && index < ids.length - 1 ? ids[index + 1] : null;

  // Deleted (from its menu, or on another device): nothing left to show.
  useEffect(() => {
    if (item === null) closeRef();
  }, [item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable='true']")) return;
      // Right-to-left: the next reference sits to the left.
      if (e.key === "ArrowLeft" && next) switchRef(next);
      if (e.key === "ArrowRight" && prev) switchRef(prev);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1 border-b border-line bg-surface/90 px-2 backdrop-blur md:static md:col-start-2 md:row-start-1 md:border-s md:bg-surface md:px-3">
        {ids.length > 1 && index >= 0 ? (
          <>
            <IconButton label="المرجع السابق" disabled={!prev} onClick={() => prev && switchRef(prev)}>
              <ChevronRight className="size-4" />
            </IconButton>
            <IconButton label="المرجع التالي" disabled={!next} onClick={() => next && switchRef(next)}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="px-1 text-xs text-ink-faint tabular-nums">
              {index + 1} / {ids.length}
            </span>
          </>
        ) : null}
        <div className="ms-auto flex items-center gap-1">
          {item ? (
            <ItemMenu
              item={item}
              onSetPreview={() => setPreviewOpen(true)}
              className="[&>span]:bg-transparent [&>span]:text-ink-muted [&>span]:backdrop-blur-none hover:[&>span]:bg-raised hover:[&>span]:text-ink"
            />
          ) : null}
          <D.Close
            aria-label="إغلاق"
            className="grid size-11 place-items-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink md:size-9"
          >
            <X className="size-4" />
          </D.Close>
        </div>
      </header>

      {item ? (
        <>
          <Media item={item} />
          <Story
            item={item}
            following={following}
            onDecided={() => (next ? switchRef(next) : prev ? switchRef(prev) : closeRef())}
          />
          <NoteComposer item={item} onSent={() => setFollowing(true)} />
          <PreviewDialog item={item} open={previewOpen} onOpenChange={setPreviewOpen} />
        </>
      ) : (
        <>
          <D.Title className="sr-only">مرجع</D.Title>
          <div className="shimmer-surface aspect-[4/3] shrink-0 bg-raised md:col-start-1 md:row-span-3 md:row-start-1 md:aspect-auto" />
          <div className="space-y-3 p-6 md:col-start-2 md:row-start-2 md:border-s md:border-line">
            <div className="h-3 w-24 rounded bg-raised" />
            <div className="h-6 w-3/4 rounded bg-raised" />
            <div className="h-4 w-1/2 rounded bg-raised" />
          </div>
        </>
      )}
    </>
  );
}

function Media({ item }: { item: ItemDoc }) {
  const preview = item.ingest === "ready" ? item.preview : null;
  const player = playerSource(item);
  const platform = PLATFORMS[item.platform] ?? PLATFORMS.web;
  // Phones size the stage to the work (clamped), desktop gives it the whole side.
  const ratio = player?.kind === "embed" ? 16 / 9 : preview ? preview.width / preview.height : 4 / 3;
  const stage = Math.min(Math.max(ratio, 0.8), 2);

  return (
    <div
      className="relative grid max-h-[62dvh] w-full shrink-0 place-items-center overflow-hidden bg-black aspect-(--stage) md:col-start-1 md:row-span-3 md:row-start-1 md:aspect-auto md:h-full md:max-h-none md:p-8"
      style={{ "--stage": stage } as React.CSSProperties}
    >
      {preview ? (
        <span
          aria-hidden
          className="absolute inset-0 scale-125 bg-cover bg-center opacity-50 blur-2xl"
          style={{ backgroundImage: `url(${preview.lqip})` }}
        />
      ) : null}

      {player?.kind === "embed" ? (
        <div className="relative aspect-video w-full bg-black md:max-h-full md:overflow-hidden md:rounded-xl">
          {/* The still holds the frame while the player loads. */}
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from our own pipeline
            <img src={preview.w1280} alt="" className="absolute inset-0 size-full object-cover" />
          ) : null}
          <iframe
            src={player.src}
            title={item.title ?? "فيديو"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        </div>
      ) : player?.kind === "file" ? (
        <video
          src={player.src}
          poster={preview?.w1280}
          controls
          autoPlay
          muted
          loop
          playsInline
          className="relative max-h-full max-w-full md:rounded-xl"
        />
      ) : preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from our own pipeline
        <img
          src={preview.w1280}
          srcSet={`${preview.w640} 640w, ${preview.w1280} 1280w`}
          sizes="(min-width: 768px) 60vw, 100vw"
          width={preview.width}
          height={preview.height}
          alt=""
          className="relative size-full object-contain md:rounded-xl"
        />
      ) : (
        <span className="relative text-sm font-semibold" style={{ color: platform.color }} dir="ltr">
          {platform.label}
        </span>
      )}
    </div>
  );
}

function Story({ item, following, onDecided }: { item: ItemDoc; following: boolean; onDecided: () => void }) {
  const platform = PLATFORMS[item.platform] ?? PLATFORMS.web;
  const host = displayHost(item.sourceUrl);
  const sourceName = item.platform === "web" ? host : platform.label;
  const title = item.title ?? host;

  const copyLink = async () => {
    await navigator.clipboard.writeText(item.sourceUrl);
    toast("تم نسخ الرابط");
  };

  return (
    <div className="px-5 pt-5 pb-8 md:col-start-2 md:row-start-2 md:overflow-y-auto md:overscroll-contain md:border-s md:border-line md:px-6">
      <p className="flex items-center gap-2 text-xs text-ink-faint">
        <span className="size-1.5 rounded-full" style={{ background: platform.color }} aria-hidden />
        <bdi>{sourceName}</bdi>
        {item.publishedAt ? <span>· نُشر {formatPublished(item.publishedAt)}</span> : null}
      </p>
      <D.Title className="mt-2 text-xl leading-snug font-semibold tracking-tight text-balance" dir="auto">
        {title}
      </D.Title>

      {item.authorName ? <Creator name={item.authorName} url={item.authorUrl} /> : null}

      <div className="mt-5 flex gap-2">
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-canvas transition-[background-color,transform] duration-150 ease-out hover:bg-white active:scale-[0.97]"
        >
          افتح في <bdi>{sourceName}</bdi>
          <ArrowUpRight className="size-4" />
        </a>
        <Button variant="secondary" size="icon" className="size-10" aria-label="نسخ الرابط" onClick={() => void copyLink()}>
          <Link2 className="size-4" />
        </Button>
      </div>

      {item.status === "inbox" ? <InboxDecision item={item} onDecided={onDecided} /> : null}
      {item.status !== "inbox" && item.addedBy === "agent" && item.reason ? (
        <Section label="ليش اختاره الوكيل">
          <p className="text-sm leading-6 text-ink-muted" dir="auto" style={prose}>
            {item.reason}
          </p>
        </Section>
      ) : null}

      {item.description ? (
        <Section label="عن العمل" hint="من صفحة صاحب العمل">
          <About text={item.description} />
        </Section>
      ) : null}

      {item.process ? (
        <Section label="كيف انسوى">
          <p className="text-sm leading-7 whitespace-pre-line text-ink/90" dir="auto" style={prose}>
            <Linkified text={item.process} />
          </p>
        </Section>
      ) : null}

      {item.tools?.length ? (
        <Section label="الأدوات">
          <ul className="flex flex-wrap gap-1.5">
            {item.tools.map((tool) => (
              <li key={tool} className="inline-flex h-7 items-center rounded-full border border-line-strong px-2.5 text-xs text-ink" dir="ltr">
                {tool}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {item.tags?.length ? (
        <Section label="الوسوم">
          <ul className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <li key={tag} className="inline-flex h-6 items-center rounded-full bg-raised px-2 text-[11px] text-ink-muted" dir="ltr">
                {tag}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <ResearchAsk item={item} />
      <Notes item={item} following={following} />
    </div>
  );
}

function Creator({ name, url }: { name: string; url: string | null }) {
  const body = (
    <>
      <Avatar name={name.replace(/^@/, "")} className="size-9" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink" dir="auto">
          {name}
        </span>
        <span className="flex items-center gap-1 text-xs text-ink-muted">
          {url ? (
            <>
              ملف الأعمال · <bdi dir="ltr">{displayHost(url)}</bdi>
              <ArrowUpRight className="size-3" />
            </>
          ) : (
            "صاحب العمل"
          )}
        </span>
      </span>
    </>
  );
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="-mx-2 mt-3 flex items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-raised"
    >
      {body}
    </a>
  ) : (
    <div className="mt-3 flex items-center gap-3 py-1.5">{body}</div>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h3 className="mb-2.5 flex items-baseline gap-2 text-xs font-medium text-ink-faint">
        {label}
        {hint ? <span className="font-normal text-ink-faint/70">· {hint}</span> : null}
      </h3>
      {children}
    </section>
  );
}

/** The creator's description, folded when long. */
function About({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 320 || text.split("\n").length > 6;
  return (
    <>
      <p className={cn("text-sm leading-7 whitespace-pre-line text-ink/90", long && !open && "line-clamp-6")} dir="auto" style={prose}>
        <Linkified text={text} />
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 -ms-1 min-h-9 px-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {open ? "أقل" : "اقرأ الكل"}
        </button>
      ) : null}
    </>
  );
}

const URL_PATTERN = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]'])/g;

/** Plain text with its links clickable (creators often link their process, tools and socials). */
function Linkified({ text }: { text: string }) {
  return text.split(URL_PATTERN).map((part, i) =>
    i % 2 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline decoration-ink-faint underline-offset-2 hover:decoration-ink" dir="ltr">
        {part.replace(/^https?:\/\/(www\.)?/, "")}
      </a>
    ) : (
      part
    ),
  );
}

function InboxDecision({ item, onDecided }: { item: ItemDoc; onDecided: () => void }) {
  const { uid } = useShell();
  const agentName = item.notes?.find((n) => n.by === "agent")?.name;
  const decide = async (status: "kept" | "discarded") => {
    try {
      await setItemStatus(uid, item, status);
      toast(status === "kept" ? "انضاف للمشروع" : "انرمى", {
        action: { label: "تراجع", onClick: () => void setItemStatus(uid, item, "inbox") },
      });
      onDecided();
    } catch (err) {
      toast.error("ما قدرنا نحدّثه", { description: friendlyError(err) });
    }
  };
  return (
    <div className="mt-6 rounded-2xl border border-line bg-raised/50 p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-signal">
        <Spark className="size-3" />
        اقتراح {agentName ? <bdi dir="auto">{agentName}</bdi> : "الوكيل"}
      </p>
      {item.reason ? (
        <p className="mt-2 text-sm leading-6 text-ink/90" dir="auto" style={prose}>
          {item.reason}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <Button variant="primary" className="flex-1 max-md:h-11" onClick={() => void decide("kept")}>
          <Check className="size-4" />
          احتفظ
        </Button>
        <Button variant="ghost" className="flex-1 max-md:h-11" onClick={() => void decide("discarded")}>
          <X className="size-4" />
          ارمِ
        </Button>
      </div>
    </div>
  );
}

const MISSING: [key: "authorName" | "authorUrl" | "tools" | "process", label: string][] = [
  ["authorName", "صاحب العمل"],
  ["authorUrl", "ملف أعماله"],
  ["tools", "الأدوات"],
  ["process", "طريقة العمل"],
];

/** When the page didn't tell us enough, hand the question to an agent in one tap. */
function ResearchAsk({ item }: { item: ItemDoc }) {
  const { slug } = useParams<{ slug: string }>();
  const pending = item.ingest === "queued" || item.ingest === "processing";
  const missing = MISSING.filter(([key]) => (key === "tools" ? !item.tools?.length : !item[key])).map(([, label]) => label);
  if (pending || !missing.length) return null;

  const copy = async () => {
    const project = decodeURIComponent(slug);
    await navigator.clipboard.writeText(
      `Research this reference in my Ilham project "${project}" (item id ${item.id}): ${item.sourceUrl}\n` +
        `Find who made it, their portfolio page, when it was published, the software they used and how it was made — from the creator's own pages or a reliable making-of.\n` +
        `Save it with update_item, then tell me anything interesting about it with add_note, in Arabic.`,
    );
    toast("نُسخ الطلب", { description: "الصقه لأي وكيل مربوط بإلهام." });
  };

  return (
    <div className="mt-7 flex items-center gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-3">
      <p className="min-w-0 flex-1 text-xs leading-5 text-ink-muted">
        ناقص: {missing.join("، ")}. الوكيل يقدر يدوّر عليها.
      </p>
      <Button variant="secondary" size="sm" className="shrink-0 max-md:h-11" onClick={() => void copy()}>
        <Copy className="size-3.5" />
        انسخ طلب للوكيل
      </Button>
    </div>
  );
}

/** A reply still "thinking" after this long was abandoned; the retry takes over. */
const REPLY_STALE_MS = 3 * 60_000;

// A coarse clock for render: time moves in 15-second steps, which is all staleness needs.
let clock = Date.now();
const subscribeClock = (onChange: () => void) => {
  // Catch up at once: the module may have loaded long before this thread opened.
  queueMicrotask(() => {
    clock = Date.now();
    onChange();
  });
  const timer = setInterval(() => {
    clock = Date.now();
    onChange();
  }, 15_000);
  return () => clearInterval(timer);
};
const useClock = () => useSyncExternalStore(subscribeClock, () => clock, () => clock);

function Notes({ item, following }: { item: ItemDoc; following: boolean }) {
  const notes = item.notes ?? [];
  const end = useRef<HTMLDivElement>(null);
  const now = useClock();
  const reply = item.agentReply;
  const startedAt = (reply?.at as { toMillis?: () => number } | null)?.toMillis?.();
  // Pending server timestamps read as null: the request is seconds old.
  const thinking = reply?.status === "thinking" && (startedAt === undefined || now - startedAt < REPLY_STALE_MS);
  const failed = reply?.status === "failed" || (reply?.status === "thinking" && !thinking);

  useEffect(() => {
    if (following) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [following, notes.length, thinking, failed]);

  const retry = async () => {
    try {
      await askAgent(item.id);
    } catch (err) {
      toast.error("ما قدر Claude يرد", { description: friendlyError(err) });
    }
  };

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h3 className="flex items-baseline gap-2 text-xs font-medium text-ink-faint">
          الملاحظات
          {notes.length ? <span className="tabular-nums">{notes.length}</span> : null}
        </h3>
        <InviteAgent item={item} />
      </div>
      {notes.length ? (
        <ol className="mt-4 space-y-5" aria-live="polite">
          {notes.map((note) => (
            <NoteRow key={note.id} item={item} note={note} />
          ))}
          {thinking ? (
            <li className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-raised text-signal">
                <Spark className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-ink">Claude</p>
                <p className="mt-2 flex items-center gap-1" role="status" aria-label="Claude يكتب">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="size-1.5 rounded-full bg-ink-faint motion-safe:animate-pulse"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </p>
              </div>
            </li>
          ) : failed && notes.at(-1)?.by === "user" ? (
            <li className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-raised text-ink-faint">
                <Spark className="size-3" />
              </span>
              <p className="flex-1 text-sm text-ink-muted">ما قدر Claude يرد هالمرة.</p>
              <Button variant="secondary" size="sm" className="max-md:h-11" onClick={() => void retry()}>
                <RotateCw className="size-3.5" />
                أعد المحاولة
              </Button>
            </li>
          ) : null}
        </ol>
      ) : (
        <p className="mt-2 text-sm leading-6 text-ink-faint">
          اكتب ملاحظتك أو اسأل عن هذا العمل. ادعُ أي وكيل (Codex، ChatGPT، Claude، Grok…) ويرد عليك هنا، والمحادثة
          تبقى مع المرجع.
        </p>
      )}
      <div ref={end} />
    </section>
  );
}

/** Copies an invitation any connected agent (Codex, Claude, ChatGPT, Grok…) can follow into this thread. */
function InviteAgent({ item }: { item: ItemDoc }) {
  const copy = async () => {
    const link = `${window.location.origin}${window.location.pathname}?ref=${item.id}`;
    await navigator.clipboard.writeText(threadInvite(link));
    toast("نُسخت الدعوة", { description: "الصقها لأي وكيل مربوط بإلهام، ويجي يكلمك هنا." });
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="ms-auto -me-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink max-md:min-h-11"
    >
      <UserPlus className="size-3.5" />
      ادعُ وكيل
    </button>
  );
}

function NoteRow({ item, note }: { item: ItemDoc; note: ItemNote }) {
  const { uid } = useShell();
  const { user } = useAuth();
  const agent = note.by === "agent";
  const remove = async () => {
    try {
      await removeNote(uid, item, note);
    } catch (err) {
      toast.error("ما قدرنا نحذفها", { description: friendlyError(err) });
    }
  };
  return (
    <li className="group/note flex gap-3">
      {agent ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-raised text-signal">
          <Spark className="size-3" />
        </span>
      ) : (
        <Avatar name={user?.displayName ?? user?.email ?? "أ"} src={user?.photoURL} className="size-7" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-xs">
          <span className="font-medium text-ink" dir="auto">
            {agent ? (note.name ?? "الوكيل") : "أنت"}
          </span>
          <time dateTime={note.at} className="text-ink-faint">
            {relativeTime(note.at)}
          </time>
        </p>
        <p className="mt-1 text-sm leading-6 break-words whitespace-pre-line text-ink/90" dir="auto" style={prose}>
          <Linkified text={note.text} />
        </p>
      </div>
      {agent ? null : (
        <button
          type="button"
          onClick={() => void remove()}
          aria-label="احذف الملاحظة"
          className="-mt-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-faint transition hover:bg-raised hover:text-danger md:-mt-1.5 md:size-9 md:opacity-0 md:group-hover/note:opacity-100 md:focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}

const ASK_KEY = "ilham.askAgent";

/** Whether your notes go to Claude for a reply. Remembered on this device; on by default. */
function useAskAgent(): [boolean, (value: boolean) => void] {
  const [ask, setAsk] = useState(() => {
    try {
      return localStorage.getItem(ASK_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const update = (value: boolean) => {
    setAsk(value);
    try {
      localStorage.setItem(ASK_KEY, value ? "on" : "off");
    } catch {
      // Private mode: the choice lasts for this visit.
    }
  };
  return [ask, update];
}

function NoteComposer({ item, onSent }: { item: ItemDoc; onSent: () => void }) {
  const { uid } = useShell();
  const canHover = useCanHover();
  const configured = useAgentChatConfigured();
  const [askPreference, setAsk] = useAskAgent();
  const ask = askPreference && configured === true;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await addUserNote(uid, item, text);
      setText("");
      onSent();
      field.current?.focus();
      if (ask) {
        await askAgent(item.id).catch((err) =>
          toast.error("ما قدر Claude يرد", { description: friendlyError(err) }),
        );
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      toast.error("ما قدرنا نحفظ الملاحظة", {
        description: code === "too-many-notes" ? "وصل المرجع لحد الملاحظات (100). احذف القديمة." : friendlyError(err),
      });
    } finally {
      setBusy(false);
    }
  };

  // Desktop: Enter sends, Shift+Enter breaks the line. Phones keep Enter for new lines.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (canHover && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className={cn(
        "sticky bottom-0 z-10 mt-auto border-t border-line bg-surface px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:col-start-2 md:row-start-3 md:border-s md:px-4 md:pb-4",
        configured ? "pt-2" : "pt-3 md:pt-4",
      )}
    >
      {/* Only when Claude's automatic replies are on; otherwise notes wait for whichever agent you invite. */}
      {configured ? (
        <button
          type="button"
          onClick={() => setAsk(!askPreference)}
          aria-pressed={ask}
          className={cn(
            "-ms-1 mb-1.5 inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors hover:bg-raised",
            ask ? "text-ink" : "text-ink-faint",
          )}
        >
          <Spark className={cn("size-3", ask ? "text-signal" : "text-ink-faint")} />
          {ask ? "Claude يرد" : "ملاحظة لك بس"}
        </button>
      ) : null}
      <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-canvas p-1.5 transition-colors focus-within:border-ink">
        <textarea
          ref={field}
          name="note"
          rows={1}
          dir="auto"
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={ask ? "اسأل Claude عن هذا العمل…" : "اكتب ملاحظة…"}
          aria-label="ملاحظة على المرجع"
          className="field-sizing-content max-h-36 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none md:text-sm"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label={ask ? "أرسل لـ Claude" : "احفظ الملاحظة"}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-canvas transition-[opacity,transform] duration-150 ease-out active:scale-[0.94] disabled:opacity-25 md:size-9"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
    </form>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent md:size-9"
    >
      {children}
    </button>
  );
}

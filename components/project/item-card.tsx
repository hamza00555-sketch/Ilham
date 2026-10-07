"use client";

import { ImagePlus, MessageCircle, Play } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Tile } from "@/lib/bento";
import type { ItemDoc } from "@/lib/data/items";
import { claimMotion, releaseMotion, useCanHover, useIsMotionActive, useMotionAllowed } from "@/lib/motion";
import { cn, PLATFORMS } from "@/lib/ui";
import { displayHost } from "@/shared/normalize";
import { motionSource } from "@/shared/video";
import { Spark } from "../ui/brand";
import { openRef } from "./item-detail";
import { ItemMenu } from "./item-menu";
import { MotionLayer } from "./motion-layer";
import { PreviewDialog } from "./preview-dialog";

const SIZES = "(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw";
/** Hover must settle briefly before a card comes alive, so sweeping the cursor across the grid stays calm. */
const HOVER_DWELL_MS = 280;

/** Bento tiles: one or two cells of a 6-column laptop board, full or half width on a phone. */
const TILE_SIZES = {
  wide: "(min-width: 900px) 34vw, 100vw",
  narrow: "(min-width: 900px) 17vw, 50vw",
};

/**
 * A reference on a board. In the uniform grid (the Inbox) it is a 4:3 card with its caption below;
 * as a bento `tile` it fills its cells and the caption rises over the work on hover.
 */
export function ItemCard({
  item,
  index,
  tile,
  children,
}: {
  item: ItemDoc;
  index: number;
  tile?: Tile;
  children?: ReactNode;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const platform = PLATFORMS[item.platform] ?? PLATFORMS.web;
  const preview = item.ingest === "ready" ? item.preview : null;
  const pending = item.ingest === "queued" || item.ingest === "processing";
  const host = displayHost(item.sourceUrl);
  const title = item.title ?? host;
  // Generic sites are named by their host ("linear.app"), known platforms by their brand.
  const sourceName = item.platform === "web" ? host : platform.label;
  const byline = item.authorName ?? (sourceName === title ? null : sourceName);
  const isVideo = item.mediaType === "video" || !!preview?.video;
  const isAgent = item.addedBy === "agent";
  const notes = item.notes ?? [];
  // Lime when the latest word is an agent's: something it wants you to read.
  const agentSpoke = notes.at(-1)?.by === "agent";

  // Tall shots and pages crop from the top, landscape from the center. Very wide OG cards
  // (≈1.91:1, often text-heavy) are shown whole on their own dominant color instead.
  const ratio = preview ? preview.width / preview.height : 1;
  // Bento tiles already follow the work's shape, so they always fill (bands of a white dominant
  // color read as a broken tile); the 4:3 grid shows very wide cards whole instead.
  const contain = !tile && ratio > 1.85 && item.mediaType !== "video";
  const fit = contain ? "object-contain" : cn("object-cover", ratio < 1.25 ? "object-top" : "object-center");
  // The work's frame: the whole tile on the bento board, the 4:3 top of a grid card.
  const frame = tile ? "inset-0" : "inset-x-0 top-0 aspect-[4/3]";
  const sizes = tile ? (tile.w > 1 ? TILE_SIZES.wide : TILE_SIZES.narrow) : SIZES;

  const source = preview ? motionSource(item) : null;
  const cardRef = useRef<HTMLElement>(null);
  const { active: motionActive, onPointerEnter, onPointerLeave } = useLiveMotion(cardRef, item.id, !!source);

  return (
    <motion.article
      ref={cardRef}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: Math.min(index, 12) * 0.03 }}
      className="group relative min-w-0"
      style={tile ? { gridColumn: `${tile.col + 1} / span ${tile.w}`, gridRow: `${tile.row + 1} / span ${tile.h}` } : undefined}
    >
      {/* Opens the reference's detail sheet; ⌘/Ctrl-click opens it in a new tab. */}
      <a
        href={`?ref=${item.id}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          openRef(item.id);
        }}
        className={cn("block overflow-hidden rounded-card bg-raised", tile ? "absolute inset-0" : "relative aspect-[4/3]")}
        style={preview ? { backgroundColor: preview.dominantColor } : undefined}
        aria-label={[
          title,
          sourceName,
          isVideo && "فيديو",
          isAgent && "أضافه الإيجنت",
          notes.length === 1 ? "ملاحظة وحدة" : notes.length > 1 && `${notes.length} ملاحظات`,
        ]
          .filter(Boolean)
          .join("، ")}
      >
        {preview ? (
          <>
            {contain ? null : (
              <span
                aria-hidden
                className="absolute inset-0 scale-110 bg-cover bg-center blur-lg"
                style={{ backgroundImage: `url(${preview.lqip})` }}
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element -- previews are pre-sized WebP from our own pipeline */}
            <img
              src={preview.w640}
              srcSet={`${preview.w640} 640w, ${preview.w1280} 1280w`}
              sizes={sizes}
              width={preview.width}
              height={preview.height}
              alt=""
              loading={index < 8 ? "eager" : "lazy"}
              decoding="async"
              onLoad={() => setLoadedSrc(preview.w640)}
              className={cn(
                "absolute inset-0 size-full transition-[opacity,transform] duration-300 ease-out-quint group-hover:scale-[1.02]",
                fit,
                loadedSrc === preview.w640 ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        ) : pending ? (
          <PendingTile color={platform.color} host={host} />
        ) : (
          <FallbackTile color={platform.color} label={platform.label} title={title} />
        )}
      </a>

      {source && motionActive ? <MotionLayer source={source} className={frame} /> : null}

      {/* Chrome over the work. Never takes clicks: the whole card opens the detail sheet. */}
      <div aria-hidden className={cn("pointer-events-none absolute overflow-hidden rounded-card", frame)}>
        {tile ? (
          <span
            className={cn(
              "absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pt-12 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100",
              // Tile controls sit at the foot; the caption rises above them.
              children ? "pb-14" : "pb-2.5",
            )}
          >
            <span className="mb-1.5 size-1.5 shrink-0 rounded-full" style={{ background: platform.color }} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-white" dir="auto">
                {title}
              </span>
              {item.status === "inbox" && item.reason ? (
                <span className="line-clamp-2 text-xs leading-5 text-white/75" dir="auto" style={{ textAlign: "start" }}>
                  {item.reason}
                </span>
              ) : byline ? (
                <span className="block truncate text-xs text-white/70" dir="auto">
                  {byline}
                </span>
              ) : null}
            </span>
          </span>
        ) : null}
        <span className="absolute top-2.5 start-2.5 flex gap-1.5">
          {isAgent ? (
            <span className="grid size-6 place-items-center rounded-full bg-black/60 text-signal backdrop-blur">
              <Spark className="size-3" />
            </span>
          ) : null}
          {isVideo ? (
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full bg-black/55 backdrop-blur transition-opacity duration-200",
                motionActive && "opacity-0",
              )}
            >
              <Play className="size-2.5 fill-white text-white" />
            </span>
          ) : null}
          {notes.length ? (
            <span
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-full bg-black/60 px-2 text-[11px] font-medium tabular-nums backdrop-blur",
                agentSpoke ? "text-signal" : "text-white",
              )}
            >
              <MessageCircle className="size-3" />
              {notes.length}
            </span>
          ) : null}
        </span>
      </div>

      {item.ingest === "failed" ? (
        <div className={cn("pointer-events-none absolute flex items-end justify-center pb-2", frame)}>
          <button
            onClick={() => setPreviewOpen(true)}
            className="pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur transition hover:bg-black/80">
              <ImagePlus className="size-3.5" />
              أضف بريفيو
            </span>
          </button>
        </div>
      ) : null}

      {tile ? null : (
        <div className="mt-2.5 flex items-center gap-2 px-0.5">
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: platform.color }} aria-hidden />
          <p className="min-w-0 truncate text-[13px] font-medium" dir="auto">
            {title}
          </p>
          {byline ? (
            <span className="ms-auto hidden max-w-[40%] shrink-0 truncate ps-2 text-xs text-ink-faint sm:block" dir="auto">
              {byline}
            </span>
          ) : null}
        </div>
      )}

      {children}

      <ItemMenu
        item={item}
        onSetPreview={() => setPreviewOpen(true)}
        className="absolute top-0.5 end-0.5 md:top-1 md:end-1 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
      />
      <PreviewDialog item={item} open={previewOpen} onOpenChange={setPreviewOpen} />
    </motion.article>
  );
}

/**
 * Desktop: the card comes alive after a short hover dwell. Phone: the card nearest the middle of
 * the screen plays. Either way only one card plays at a time (see lib/motion.ts).
 */
function useLiveMotion(ref: React.RefObject<HTMLElement | null>, id: string, enabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const canHover = useCanHover();
  const allowed = useMotionAllowed() && enabled;
  const active = useIsMotionActive(id) && allowed;

  // Touch: a thin band across the middle of the viewport decides who plays.
  useEffect(() => {
    const el = ref.current;
    if (!allowed || canHover || !el) return;
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? claimMotion(id) : releaseMotion(id)),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      releaseMotion(id);
    };
  }, [ref, id, allowed, canHover]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    active,
    onPointerEnter: (e: React.PointerEvent) => {
      if (!allowed || !canHover || e.pointerType !== "mouse") return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => claimMotion(id), HOVER_DWELL_MS);
    },
    onPointerLeave: () => {
      clearTimeout(timer.current);
      releaseMotion(id);
    },
  };
}

function PendingTile({ color, host }: { color: string; host: string }) {
  return (
    <span className="shimmer-surface absolute inset-0 grid place-items-center">
      <span
        className="absolute inset-0 opacity-25"
        style={{ background: `radial-gradient(circle at 50% 60%, ${color}55, transparent 65%)` }}
      />
      <span className="relative flex flex-col items-center gap-3 text-ink-faint">
        <span className="relative h-0.5 w-12 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="يجهّز البريفيو">
          <span className="absolute inset-y-0 w-1/2 rounded-full bg-white/45 animate-scan" />
        </span>
        <span className="text-[11px]" dir="ltr">
          {host}
        </span>
      </span>
    </span>
  );
}

function FallbackTile({ color, label, title }: { color: string; label: string; title: string }) {
  return (
    <span
      className="absolute inset-0 flex flex-col items-start justify-between p-4"
      style={{ background: `linear-gradient(150deg, ${color}2e, #121214 60%)` }}
    >
      <span className="text-xs font-semibold tracking-wide" style={{ color }} dir="ltr">
        {label}
      </span>
      <span className="line-clamp-2 w-full pb-9 text-[15px] leading-snug font-semibold text-ink/90" dir="auto">
        {title}
      </span>
    </span>
  );
}

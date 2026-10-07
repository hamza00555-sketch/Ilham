"use client";

import { ArrowUpRight, ImagePlus, Play } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import type { ItemDoc } from "@/lib/data/items";
import { cn, PLATFORMS } from "@/lib/ui";
import { displayHost } from "@/shared/normalize";
import { Spark } from "../ui/brand";
import { ItemMenu } from "./item-menu";
import { PreviewDialog } from "./preview-dialog";

const SIZES = "(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw";

export function ItemCard({ item, index }: { item: ItemDoc; index: number }) {
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const platform = PLATFORMS[item.platform] ?? PLATFORMS.web;
  const preview = item.ingest === "ready" ? item.preview : null;
  const pending = item.ingest === "queued" || item.ingest === "processing";
  const title = item.title ?? displayHost(item.sourceUrl);
  // Tall shots and pages crop from the top, landscape from the center. Very wide OG cards
  // (≈1.91:1, often text-heavy) are shown whole over their own blurred colors instead.
  const ratio = preview ? preview.width / preview.height : 1;
  const fit =
    ratio > 1.85 && item.mediaType !== "video"
      ? "object-contain"
      : cn("object-cover", ratio < 1.25 ? "object-top" : "object-center");
  const byline = item.authorName ?? platform.label;

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 12) * 0.03 }}
      className="group relative"
    >
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-[4/3] overflow-hidden rounded-card bg-raised"
        style={preview ? { backgroundColor: preview.dominantColor } : undefined}
        aria-label={`${title} — ${platform.label}`}
      >
        {preview ? (
          <>
            <span
              aria-hidden
              className="absolute inset-0 scale-110 bg-cover bg-center blur-lg"
              style={{ backgroundImage: `url(${preview.lqip})` }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- previews are pre-sized WebP from our own pipeline */}
            <img
              src={preview.w640}
              srcSet={`${preview.w640} 640w, ${preview.w1280} 1280w`}
              sizes={SIZES}
              alt=""
              loading={index < 8 ? "eager" : "lazy"}
              decoding="async"
              onLoad={() => setLoadedSrc(preview.w640)}
              className={cn(
                "absolute inset-0 size-full transition-[opacity,transform] duration-700 ease-out-quint group-hover:scale-[1.035]",
                fit,
                loadedSrc === preview.w640 ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        ) : pending ? (
          <PendingTile color={platform.color} host={displayHost(item.sourceUrl)} />
        ) : (
          <FallbackTile color={platform.color} label={platform.label} title={title} />
        )}

        <span className="pointer-events-none absolute inset-x-0 bottom-0 hidden items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3.5 pt-14 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:flex">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white" dir="auto">
              {title}
            </span>
            <span className="mt-0.5 block truncate text-xs text-white/70" dir="auto">
              {byline}
            </span>
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
            <ArrowUpRight className="size-4" />
          </span>
        </span>

        <span className="absolute top-2.5 start-2.5 flex gap-1.5">
          {item.addedBy === "agent" ? (
            <span
              className="grid size-6 place-items-center rounded-full bg-black/60 text-signal backdrop-blur"
              title={item.reason ?? "أضافه الإيجنت"}
            >
              <Spark className="size-3" />
            </span>
          ) : null}
          {item.mediaType === "video" ? (
            <span className="grid size-6 place-items-center rounded-full bg-black/55 backdrop-blur">
              <Play className="size-2.5 fill-white text-white" />
            </span>
          ) : null}
        </span>
      </a>

      {item.ingest === "failed" ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-[4/3] items-end justify-center pb-3">
          <button
            onClick={() => setPreviewOpen(true)}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/80"
          >
            <ImagePlus className="size-3.5" />
            أضف بريفيو
          </button>
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center gap-2 px-0.5">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: platform.color }} />
        <p className="min-w-0 truncate text-[13px] font-medium" dir="auto">
          {title}
        </p>
        <span className="hidden max-w-[40%] shrink-0 truncate ps-2 text-xs text-ink-faint ms-auto sm:block" dir="auto">
          {byline}
        </span>
      </div>

      <ItemMenu
        item={item}
        onSetPreview={() => setPreviewOpen(true)}
        className="absolute top-2 end-2 size-7 bg-black/40 opacity-100 transition-opacity md:size-8 md:bg-black/55 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
      />
      <PreviewDialog item={item} open={previewOpen} onOpenChange={setPreviewOpen} />
    </motion.article>
  );
}

function PendingTile({ color, host }: { color: string; host: string }) {
  return (
    <span className="shimmer-surface absolute inset-0 grid place-items-center">
      <span
        className="absolute inset-0 opacity-25"
        style={{ background: `radial-gradient(circle at 50% 60%, ${color}55, transparent 65%)` }}
      />
      <span className="relative flex flex-col items-center gap-2 text-ink-faint">
        <Spark className="size-4 animate-pulse" />
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
      className="absolute inset-0 flex flex-col justify-between p-4"
      style={{ background: `linear-gradient(150deg, ${color}2e, #121214 60%)` }}
    >
      <span className="self-start text-xs font-semibold tracking-wide" style={{ color }} dir="ltr">
        {label}
      </span>
      <span className="line-clamp-2 pb-8 text-[15px] leading-snug font-semibold text-ink/90" dir="auto">
        {title}
      </span>
    </span>
  );
}

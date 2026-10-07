"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/ui";
import type { MotionSource } from "@/shared/video";

const PLAYER_ORIGINS = {
  youtube: "https://www.youtube-nocookie.com",
  vimeo: "https://player.vimeo.com",
} as const;

/**
 * The card's living preview, laid over the still. It becomes visible only once the player itself
 * reports playback, so an embed that is blocked, slow or erroring never covers the poster.
 */
/** `className` places the layer over the work (default: the grid card's 4:3 frame). */
export function MotionLayer({ source, className }: { source: MotionSource; className?: string }) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  // Official postMessage APIs: subscribe to state changes, reveal on the first "playing".
  useEffect(() => {
    if (source.kind !== "embed") return;
    const origin = PLAYER_ORIGINS[source.provider];
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      let data: Record<string, unknown>;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      // Vimeo ignores subscriptions sent before its own "ready", so subscribe again on it.
      if (source.provider === "vimeo" && data?.event === "ready" && frame.current?.contentWindow) {
        subscribeVimeo(frame.current.contentWindow);
        return;
      }
      const info = data?.info as { playerState?: number } | number | undefined;
      const ytPlaying =
        (data?.event === "onStateChange" && info === 1) ||
        (data?.event === "infoDelivery" && typeof info === "object" && info?.playerState === 1);
      if (source.provider === "vimeo" && data?.event === "error") return setPlaying(false);
      // Vimeo sends "play" on intent, even when decoding then fails; only advancing time means frames.
      const seconds = (data?.data as { seconds?: number } | undefined)?.seconds;
      const vimeoPlaying = (data?.event === "playProgress" || data?.event === "timeupdate") && (seconds ?? 0) > 0;
      if (source.provider === "youtube" ? ytPlaying : vimeoPlaying) setPlaying(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [source]);

  const subscribe = () => {
    if (source.kind !== "embed") return;
    const win = frame.current?.contentWindow;
    const origin = PLAYER_ORIGINS[source.provider];
    if (!win) return;
    if (source.provider === "youtube") {
      win.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), origin);
      win.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }), origin);
    } else {
      subscribeVimeo(win);
    }
  };

  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute overflow-hidden rounded-card bg-black transition-opacity duration-300 ease-out [container-type:size]",
        className ?? "inset-x-0 top-0 aspect-[4/3]",
        playing ? "opacity-100" : "opacity-0",
      )}
    >
      {source.kind === "file" ? (
        <video
          src={source.src}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          onPlaying={() => setPlaying(true)}
          className="size-full object-cover"
        />
      ) : (
        <iframe
          ref={frame}
          src={withApi(source)}
          title="معاينة متحركة"
          tabIndex={-1}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={subscribe}
          // A 16:9 player covering a frame of any shape (container units), oversized by 18% and
          // centered to crop the player's own chrome.
          className="absolute top-1/2 left-1/2 h-[calc(max(100cqh,56.25cqw)*1.18)] w-[calc(max(100cqw,177.78cqh)*1.18)] max-w-none -translate-x-1/2 -translate-y-1/2 border-0"
        />
      )}
    </span>
  );
}

function subscribeVimeo(win: Window) {
  for (const value of ["playProgress", "timeupdate", "error"]) {
    win.postMessage(JSON.stringify({ method: "addEventListener", value }), PLAYER_ORIGINS.vimeo);
  }
}

function withApi(source: Extract<MotionSource, { kind: "embed" }>): string {
  const url = new URL(source.src);
  if (source.provider === "youtube") {
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("origin", window.location.origin);
  } else {
    url.searchParams.set("api", "1");
  }
  return url.toString();
}

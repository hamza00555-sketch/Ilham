"use client";

import { Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const hasLink = (e: DragEvent) =>
  !!e.dataTransfer && [...e.dataTransfer.types].some((t) => t === "text/uri-list" || t === "text/plain");

/** Full-window drop target for links dragged from another tab. */
export function DropOverlay({ onDropText, target }: { onDropText: (text: string) => boolean; target: string | null }) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const enter = (e: DragEvent) => {
      if (!hasLink(e)) return;
      depth.current++;
      setActive(true);
    };
    const over = (e: DragEvent) => {
      if (hasLink(e)) e.preventDefault();
    };
    const leave = () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const drop = (e: DragEvent) => {
      depth.current = 0;
      setActive(false);
      if (!e.dataTransfer) return;
      const uri = e.dataTransfer.getData("text/uri-list").split("\n").find((l) => l && !l.startsWith("#"));
      const text = uri ?? e.dataTransfer.getData("text/plain");
      if (text && onDropText(text)) e.preventDefault();
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [onDropText]);

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-canvas/80 p-6 backdrop-blur-sm animate-fade">
      <div className="grid w-full max-w-lg place-items-center rounded-3xl border-2 border-dashed border-ink-faint px-8 py-16 text-center">
        <Link2 className="size-7 text-ink-muted" />
        <p className="mt-4 text-lg font-semibold">أفلت الرابط هنا</p>
        <p className="mt-1 text-sm text-ink-muted">{target ? `يروح على «${target}»` : "تختار المشروع بعدها"}</p>
      </div>
    </div>
  );
}

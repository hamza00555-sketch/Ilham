"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { CELL_RATIO, columnsFor, gapFor, layoutBento, type TileInput } from "@/lib/bento";
import type { ItemDoc } from "@/lib/data/items";
import { ItemCard } from "./item-card";

const toInput = (item: ItemDoc): TileInput => {
  const preview = item.ingest === "ready" ? item.preview : null;
  return {
    id: item.id,
    ratio: preview ? preview.width / preview.height : null,
    width: preview?.width ?? 0,
    video: item.mediaType === "video" || !!preview?.video,
  };
};

/** The board's width, live. A callback ref, so the observer follows the element it measures. */
function useWidth() {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * The project board as a bento: big, wide, tall and small tiles from each work's own shape, packed
 * without gaps. The biggest tile is a third of a laptop board; the smallest stays a clear thumbnail.
 */
export function BentoBoard({ items }: { items: ItemDoc[] }) {
  const [ref, width] = useWidth();
  const cols = columnsFor(width);
  const gap = gapFor(width);
  const inputs = useMemo(() => items.map(toInput), [items]);
  const tiles = useMemo(() => layoutBento(inputs, cols), [inputs, cols]);
  const row = width ? (width - (cols - 1) * gap) / cols / CELL_RATIO : 0;

  return (
    <div className="mt-6 px-4 md:mt-8 md:px-10">
      <div
        ref={ref}
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: `${row}px`, gap }}
      >
        {width ? (
          <AnimatePresence initial={false}>
            {items.map((item, i) => (
              <ItemCard key={item.id} item={item} index={i} tile={tiles[i]} />
            ))}
          </AnimatePresence>
        ) : null}
      </div>
    </div>
  );
}

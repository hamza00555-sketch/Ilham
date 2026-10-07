"use client";

import { useSyncExternalStore } from "react";

// One living preview at a time: hovering a card (or scrolling one into the middle of the screen
// on a phone) takes the stage from whichever card had it.
let active: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((fn) => fn());

export function claimMotion(id: string) {
  if (active === id) return;
  active = id;
  emit();
}

export function releaseMotion(id: string) {
  if (active !== id) return;
  active = null;
  emit();
}

export function useIsMotionActive(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => active === id,
    () => false,
  );
}

function useMedia(query: string, serverValue: boolean): boolean {
  return useSyncExternalStore(
    (fn) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Fine pointer with real hover (desktop). Touch devices use the in-view rule instead. */
export const useCanHover = () => useMedia("(hover: hover) and (pointer: fine)", true);

/** No autoplaying motion for reduced-motion users or Data Saver. */
export function useMotionAllowed(): boolean {
  const reduced = useMedia("(prefers-reduced-motion: reduce)", true);
  const saveData =
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return !reduced && !saveData;
}

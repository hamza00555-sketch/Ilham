"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};
const isApple = () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

/** "⌘V" on Apple devices, "Ctrl V" elsewhere. */
export function usePasteShortcut(): string {
  return useSyncExternalStore(noop, () => (isApple() ? "⌘V" : "Ctrl V"), () => "⌘V");
}

"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade" />
        <D.Content
          className={cn(
            "fixed z-50 max-h-[90dvh] w-full overflow-y-auto overscroll-contain border-line-strong bg-surface shadow-2xl shadow-black/60 outline-none",
            // Bottom sheet on phones, centered card on larger screens.
            "inset-x-0 bottom-0 rounded-t-3xl border-t px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
            "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-6",
            "animate-rise",
            className,
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-lg font-semibold tracking-tight">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm text-ink-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close
              className="-m-1 rounded-full p-1.5 text-ink-faint transition hover:bg-raised hover:text-ink"
              aria-label="إغلاق"
            >
              <X className="size-4" />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}

// Focus shows as a bright border instead of the global outline, so fields don't get a double ring.
export const inputClass =
  "h-11 w-full rounded-xl border border-line-strong bg-canvas px-3.5 text-[15px] text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-ink focus-visible:outline-none";

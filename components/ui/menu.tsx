"use client";

import { DropdownMenu as M } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/ui";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuSub = M.Sub;

const surface =
  "z-50 min-w-48 overflow-hidden rounded-xl border border-line-strong bg-raised p-1 shadow-xl shadow-black/50 animate-rise";

export function MenuContent({ className, ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content sideOffset={6} collisionPadding={12} className={cn(surface, className)} {...props} />
    </M.Portal>
  );
}

export function MenuItem({
  icon,
  children,
  danger,
  className,
  ...props
}: ComponentProps<typeof M.Item> & { icon?: ReactNode; danger?: boolean }) {
  return (
    <M.Item
      className={cn(
        "flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none",
        "data-[highlighted]:bg-hover data-[disabled]:opacity-40",
        danger ? "text-danger" : "text-ink",
        className,
      )}
      {...props}
    >
      {icon ? <span className="text-ink-muted [&_svg]:size-4">{icon}</span> : null}
      {children}
    </M.Item>
  );
}

export function MenuSubTrigger({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <M.SubTrigger className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-hover data-[state=open]:bg-hover">
      {icon ? <span className="text-ink-muted [&_svg]:size-4">{icon}</span> : null}
      {children}
    </M.SubTrigger>
  );
}

export function MenuSubContent({ className, ...props }: ComponentProps<typeof M.SubContent>) {
  return (
    <M.Portal>
      <M.SubContent sideOffset={4} collisionPadding={12} className={cn(surface, "max-h-72 overflow-y-auto", className)} {...props} />
    </M.Portal>
  );
}

export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-line" />;

"use client";

import { LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/ui";
import { Avatar } from "../ui/brand";
import { useShell } from "./shell-context";
import { UserMenu } from "./user-menu";

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { openAdd } = useShell();

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/85 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-6">
        <Link
          href="/"
          className={cn("flex w-16 flex-col items-center gap-1 text-[11px]", pathname === "/" ? "text-ink" : "text-ink-faint")}
        >
          <LayoutGrid className="size-5" />
          المشاريع
        </Link>
        <button
          onClick={() => openAdd()}
          className="grid size-12 -translate-y-1 place-items-center rounded-full bg-ink text-canvas shadow-lg shadow-black/40 transition active:scale-95"
          aria-label="إضافة رابط"
        >
          <Plus className="size-6" />
        </button>
        {user ? (
          <UserMenu align="end">
            <button className="flex w-16 flex-col items-center gap-1 text-[11px] text-ink-faint">
              <Avatar name={user.displayName ?? user.email ?? "?"} src={user.photoURL} className="size-6" />
              الحساب
            </button>
          </UserMenu>
        ) : null}
      </div>
    </nav>
  );
}

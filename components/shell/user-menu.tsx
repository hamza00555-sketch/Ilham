"use client";

import { Bookmark, LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { signOut, useAuth } from "@/lib/auth";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../ui/menu";
import { BookmarkletDialog } from "./bookmarklet-dialog";

export function UserMenu({ children, align = "start" }: { children: ReactNode; align?: "start" | "end" }) {
  const { user } = useAuth();
  const [bookmarklet, setBookmarklet] = useState(false);

  return (
    <>
      <Menu>
        <MenuTrigger asChild>{children}</MenuTrigger>
        <MenuContent align={align} side="top" className="min-w-56">
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium">{user?.displayName ?? "حسابك"}</p>
            <p className="truncate text-xs text-ink-faint" dir="ltr">
              {user?.email}
            </p>
          </div>
          <MenuSeparator />
          <MenuItem icon={<Bookmark />} onSelect={() => setBookmarklet(true)}>
            أضف من أي موقع
          </MenuItem>
          <MenuItem icon={<LogOut />} onSelect={() => void signOut()}>
            تسجيل خروج
          </MenuItem>
        </MenuContent>
      </Menu>
      <BookmarkletDialog open={bookmarklet} onOpenChange={setBookmarklet} />
    </>
  );
}

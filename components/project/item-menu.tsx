"use client";

import { ExternalLink, FolderInput, ImagePlus, Link2, MoreHorizontal, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteItem, moveItem, restoreItem, retryIngest, type ItemDoc } from "@/lib/data/items";
import { cn } from "@/lib/ui";
import { useShell } from "../shell/shell-context";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu";

export function ItemMenu({
  item,
  onSetPreview,
  className,
}: {
  item: ItemDoc;
  onSetPreview: () => void;
  className?: string;
}) {
  const { uid, projects } = useShell();
  const others = projects?.filter((p) => p.id !== item.projectId) ?? [];
  const busy = item.ingest === "queued" || item.ingest === "processing";

  const copy = async () => {
    await navigator.clipboard.writeText(item.sourceUrl);
    toast("تم نسخ الرابط");
  };

  const remove = async () => {
    await deleteItem(uid, item.id);
    toast("انحذف", { action: { label: "تراجع", onClick: () => void restoreItem(uid, item) } });
  };

  const move = async (projectId: string, name: string) => {
    const result = await moveItem(uid, item, projectId);
    toast(result === "merged" ? `كان موجود في «${name}» من قبل` : `انتقل إلى «${name}»`);
  };

  return (
    <Menu>
      <MenuTrigger
        className={cn(
          "grid place-items-center rounded-full text-white backdrop-blur transition hover:bg-black/75",
          className,
        )}
        aria-label="خيارات"
      >
        <MoreHorizontal className="size-4" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem icon={<ExternalLink />} onSelect={() => window.open(item.sourceUrl, "_blank", "noopener")}>
          فتح المصدر
        </MenuItem>
        <MenuItem icon={<Link2 />} onSelect={() => void copy()}>
          نسخ الرابط
        </MenuItem>
        <MenuItem icon={<ImagePlus />} onSelect={onSetPreview} disabled={busy}>
          تغيير البريفيو…
        </MenuItem>
        {item.ingest === "failed" ? (
          <MenuItem icon={<RotateCw />} onSelect={() => void retryIngest(uid, item.id)}>
            إعادة المحاولة
          </MenuItem>
        ) : null}
        {others.length ? (
          <MenuSub>
            <MenuSubTrigger icon={<FolderInput />}>نقل إلى</MenuSubTrigger>
            <MenuSubContent>
              {others.map((p) => (
                <MenuItem key={p.id} onSelect={() => void move(p.id, p.name)}>
                  <span dir="auto" className="truncate">
                    {p.name}
                  </span>
                </MenuItem>
              ))}
            </MenuSubContent>
          </MenuSub>
        ) : null}
        <MenuSeparator />
        <MenuItem icon={<Trash2 />} danger onSelect={() => void remove()}>
          حذف
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

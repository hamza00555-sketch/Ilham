"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { deleteProject, renameProject, type ProjectDoc } from "@/lib/data/projects";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/ui";
import { useShell } from "../shell/shell-context";
import { Button } from "../ui/button";
import { Dialog, Field, inputClass } from "../ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../ui/menu";

/**
 * Rename / delete. `trigger="overlay"` is the quiet dot that sits on a cover (home grid);
 * `leaveOnDelete` sends you home when deleting the project you're inside.
 */
export function ProjectMenu({
  project,
  trigger = "button",
  leaveOnDelete = false,
  className,
}: {
  project: ProjectDoc;
  trigger?: "button" | "overlay";
  leaveOnDelete?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { uid } = useShell();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      if (leaveOnDelete) router.push("/");
      await deleteProject(uid, project.id);
      toast(`انحذف «${project.name}»`);
    } catch (err) {
      toast.error("ما قدرنا نحذف المشروع", { description: friendlyError(err) });
    } finally {
      setBusy(false);
      setDeleting(false);
    }
  };

  return (
    <>
      <Menu>
        {trigger === "overlay" ? (
          // Same as the item cards: 44px hit area on phones around a quiet 28px dot.
          <MenuTrigger
            className={cn("group/menu grid size-11 place-items-center rounded-full transition-opacity md:size-9", className)}
            aria-label={`خيارات «${project.name}»`}
          >
            <span className="grid size-7 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition-colors group-hover/menu:bg-black/70 group-data-[state=open]/menu:bg-black/70 md:size-8 md:bg-black/55">
              <MoreHorizontal className="size-4" />
            </span>
          </MenuTrigger>
        ) : (
          <MenuTrigger asChild>
            <Button variant="secondary" size="icon" className={cn("max-md:size-11", className)} aria-label="خيارات المشروع">
              <MoreHorizontal className="size-4" />
            </Button>
          </MenuTrigger>
        )}
        <MenuContent align="end">
          <MenuItem icon={<Pencil />} onSelect={() => setRenaming(true)}>
            إعادة تسمية
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 />} danger onSelect={() => setDeleting(true)}>
            حذف المشروع
          </MenuItem>
        </MenuContent>
      </Menu>

      <Dialog open={renaming} onOpenChange={setRenaming} title="إعادة تسمية">
        <RenameForm project={project} onDone={() => setRenaming(false)} />
      </Dialog>

      <Dialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`حذف «${project.name}»؟`}
        description="ينحذف المشروع وكل المراجع اللي فيه. ما فيه تراجع."
      >
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleting(false)}>
            إلغاء
          </Button>
          <Button variant="danger" className="flex-1" onClick={() => void remove()} disabled={busy}>
            احذف
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function RenameForm({ project, onDone }: { project: ProjectDoc; onDone: () => void }) {
  const { uid } = useShell();
  const [name, setName] = useState(project.name);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await renameProject(uid, project.id, name);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="الاسم">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} dir="auto" />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!name.trim()}>
        حفظ
      </Button>
    </form>
  );
}

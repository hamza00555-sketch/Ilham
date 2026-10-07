"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { deleteProject, renameProject, type ProjectDoc } from "@/lib/data/projects";
import { useShell } from "../shell/shell-context";
import { Button } from "../ui/button";
import { Dialog, Field, inputClass } from "../ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../ui/menu";

export function ProjectMenu({ project }: { project: ProjectDoc }) {
  const router = useRouter();
  const { uid } = useShell();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      router.push("/");
      await deleteProject(uid, project.id);
      toast(`انحذف «${project.name}»`);
    } catch (err) {
      toast.error("ما قدرنا نحذف المشروع", { description: (err as Error).message });
    } finally {
      setBusy(false);
      setDeleting(false);
    }
  };

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="خيارات المشروع">
            <MoreHorizontal className="size-4" />
          </Button>
        </MenuTrigger>
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

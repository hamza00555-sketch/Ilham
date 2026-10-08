"use client";

import { Inbox, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { keepInbox } from "@/lib/data/items";
import { deleteProject, renameProject, setProjectAgentReview, type ProjectDoc } from "@/lib/data/projects";
import { friendlyError } from "@/lib/errors";
import { cn, countLabel } from "@/lib/ui";
import { reviewsAgentPicks } from "@/shared/types";
import { useShell } from "../shell/shell-context";
import { Button } from "../ui/button";
import { Dialog, Field, inputClass } from "../ui/dialog";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu";

/**
 * Rename, agent review, delete. `trigger="overlay"` is the quiet dot that sits on a cover (home grid);
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
  const { uid, agentSettings } = useShell();
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
          <AgentReviewMenu project={project} uid={uid} accountReview={agentSettings?.review ?? true} />
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

/** Where this project's agent picks go: the Inbox for review, straight in, or the account default. */
function AgentReviewMenu({ project, uid, accountReview }: { project: ProjectDoc; uid: string; accountReview: boolean }) {
  const value = project.agentReview ?? "default";

  const change = async (next: string) => {
    const mode = next === "on" || next === "off" ? next : null;
    try {
      await setProjectAgentReview(uid, project.id, mode);
      const reviewing = reviewsAgentPicks({ agentReview: mode }, { review: accountReview });
      const waiting = project.counts?.inbox ?? 0;
      if (!reviewing && waiting > 0) {
        toast("صار الوكيل يضيف مباشرة", {
          description: `فيه ${countLabel(waiting)} تنتظر في الوارد.`,
          action: {
            label: "احتفظ فيها",
            onClick: () => void keepInbox(uid, project.id).catch((err) => toast.error("ما قدرنا نحفظها", { description: friendlyError(err) })),
          },
        });
      } else {
        toast(reviewing ? "اقتراحات الوكيل بتوقف في الوارد" : "صار الوكيل يضيف مباشرة");
      }
    } catch (err) {
      toast.error("ما قدرنا نحفظ الإعداد", { description: friendlyError(err) });
    }
  };

  return (
    <MenuSub>
      <MenuSubTrigger icon={<Inbox />}>اقتراحات الوكيل</MenuSubTrigger>
      <MenuSubContent className="w-64">
        <MenuRadioGroup value={value} onValueChange={(next) => void change(next)}>
          <MenuRadioItem value="default" hint={accountReview ? "حالياً: توقف في الوارد" : "حالياً: تنضاف مباشرة"}>
            حسب الإعداد العام
          </MenuRadioItem>
          <MenuRadioItem value="on" hint="توقف لين تحتفظ فيها أو ترميها">
            راجعها في الوارد
          </MenuRadioItem>
          <MenuRadioItem value="off" hint="تنضاف للمراجع وعليها ✦">
            أضفها مباشرة
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuSubContent>
    </MenuSub>
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

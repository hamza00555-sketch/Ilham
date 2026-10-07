"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { createProject } from "@/lib/data/projects";
import { Button } from "../ui/button";
import { Dialog, Field, inputClass } from "../ui/dialog";
import { useShell } from "./shell-context";

export function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { uid } = useShell();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { slug } = await createProject(uid, name);
      setName("");
      onOpenChange(false);
      router.push(`/p/${slug}`);
    } catch (err) {
      toast.error("ما قدرنا ننشئ المشروع", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="مشروع جديد" description="لوحة تجمع فيها مراجع فكرة وحدة.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="الاسم" hint="مثلاً: nike-ar-launch أو «هوية مقهى»">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} dir="auto" />
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!name.trim() || busy}>
          أنشئ المشروع
        </Button>
      </form>
    </Dialog>
  );
}

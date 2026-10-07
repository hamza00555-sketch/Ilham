"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createProject } from "@/lib/data/projects";
import { displayHost, extractUrl } from "@/shared/normalize";
import { Button } from "../ui/button";
import { Dialog, Field, inputClass } from "../ui/dialog";
import { useShell, type ProjectRef } from "./shell-context";

export interface AddPrefill {
  url?: string;
  projectId?: string;
}

const NEW = "__new__";

export function AddDialog({
  open,
  onOpenChange,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: AddPrefill;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="إضافة مرجع" description="الصق رابط أي عمل يلهمك.">
      {/* Dialog content unmounts on close, so the form starts fresh on every open. */}
      <AddForm prefill={prefill} onDone={() => onOpenChange(false)} />
    </Dialog>
  );
}

function AddForm({ prefill, onDone }: { prefill?: AddPrefill; onDone: () => void }) {
  const router = useRouter();
  const { uid, projects, currentProject, addTo } = useShell();
  const [url, setUrl] = useState(prefill?.url ?? "");
  const [projectId, setProjectId] = useState(prefill?.projectId ?? currentProject?.id ?? projects?.[0]?.id ?? NEW);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = extractUrl(url);
  const creating = projectId === NEW || !projects?.length;
  const canSubmit = !!parsed && (creating ? newName.trim().length > 0 : !!projectId) && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !parsed) return;
    setBusy(true);
    try {
      let target: ProjectRef | undefined = projects?.find((p) => p.id === projectId);
      if (creating) {
        const created = await createProject(uid, newName);
        target = { id: created.id, slug: created.slug, name: newName.trim() };
      }
      if (!target) return;
      const added = await addTo(target, parsed);
      onDone();
      if ((added || creating) && currentProject?.id !== target.id) router.push(`/p/${target.slug}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="الرابط" hint={parsed ? displayHost(parsed) : "Dribbble · Behance · YouTube · Vimeo · أي صفحة"}>
        <input
          autoFocus
          dir="ltr"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={inputClass}
        />
      </Field>

      {projects?.length ? (
        <Field label="المشروع">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputClass} appearance-none`}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value={NEW}>＋ مشروع جديد…</option>
          </select>
        </Field>
      ) : null}

      {creating ? (
        <Field label="اسم المشروع الجديد">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="مثلاً: VR Onboarding"
            className={inputClass}
            dir="auto"
          />
        </Field>
      ) : null}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!canSubmit}>
        {busy ? "يضيف…" : "أضف"}
      </Button>
    </form>
  );
}

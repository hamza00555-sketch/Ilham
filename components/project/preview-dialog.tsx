"use client";

import { ImageUp } from "lucide-react";
import { useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { setPreviewFromFile, setPreviewFromUrl, type ItemDoc } from "@/lib/data/items";
import { friendlyError } from "@/lib/errors";
import { useShell } from "../shell/shell-context";
import { Button } from "../ui/button";
import { Dialog, Field, inputClass } from "../ui/dialog";

const REASONS: Record<string, string> = {
  blocked: "الموقع يحجب السيرفرات، فما قدرنا نسحب صورته.",
  "no-image": "الصفحة ما فيها صورة نقدر نستخدمها.",
  "invalid-image": "الصورة اللي لقيناها ما انفتحت.",
};

/** Lets the user supply a preview: a screenshot from the phone, a pasted image, or an image URL. */
export function PreviewDialog({
  item,
  open,
  onOpenChange,
}: {
  item: ItemDoc;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { uid } = useShell();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await task();
      onOpenChange(false);
      setImageUrl("");
      toast("يجهّز البريفيو…");
    } catch (err) {
      toast.error("ما قدرنا نحدّث البريفيو", { description: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("لازم تكون صورة");
    if (file.size > 15 * 1024 * 1024) return toast.error("الصورة أكبر من 15MB");
    void run(() => setPreviewFromFile(item.id, file));
  };

  const onPaste = (e: ClipboardEvent) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      onFile(file);
    }
  };

  const submitUrl = (e: FormEvent) => {
    e.preventDefault();
    if (!/^https?:\/\//i.test(imageUrl.trim())) return toast.error("الصق رابط صورة يبدأ بـ https");
    void run(() => setPreviewFromUrl(uid, item.id, imageUrl.trim()));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="بريفيو المرجع"
      description={item.ingestError ? REASONS[item.ingestError] : "استبدل الصورة بصورة من عندك."}
    >
      <div onPaste={onPaste} className="space-y-5">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="grid w-full place-items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-canvas px-4 py-8 text-center transition hover:border-ink-faint disabled:opacity-50"
        >
          <ImageUp className="size-6 text-ink-muted" />
          <span className="text-sm font-medium">ارفع صورة أو screenshot</span>
          <span className="text-xs text-ink-faint">أو الصقها هنا مباشرة (⌘V)</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />

        <form onSubmit={submitUrl} className="space-y-3">
          <Field label="أو رابط صورة">
            <input
              dir="ltr"
              name="image-url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://cdn…/shot.png"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Button type="submit" variant="secondary" className="w-full" disabled={busy || !imageUrl.trim()}>
            استخدم الرابط
          </Button>
        </form>
      </div>
    </Dialog>
  );
}

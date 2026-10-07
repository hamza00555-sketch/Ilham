"use client";

import { Smartphone } from "lucide-react";
import { useEffect, useRef } from "react";
import { Spark } from "../ui/brand";
import { Dialog } from "../ui/dialog";

/** Runs inside the page you're viewing, so it can read og:image even on sites that block servers. */
function bookmarkletCode(origin: string) {
  const js = `(()=>{const q=s=>document.querySelector(s),m=n=>(q('meta[property="'+n+'"]')||q('meta[name="'+n+'"]'))?.content||'';const p=new URLSearchParams({url:location.href,title:m('og:title')||document.title,image:m('og:image')||m('twitter:image')});window.open('${origin}/add?'+p,'ilham','width=480,height=720')})()`;
  return `javascript:${encodeURIComponent(js)}`;
}

export function BookmarkletDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  // React blocks javascript: URLs in JSX, so the href is set on the DOM node directly.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => linkRef.current?.setAttribute("href", bookmarkletCode(window.location.origin)));
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="أضف من أي موقع"
      description="اسحب الزر لشريط المفضلة. بعدها من أي صفحة عمل، اضغطه ويوصل للمشروع مع صورته."
    >
      <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong bg-canvas py-8">
        <a
          ref={linkRef}
          onClick={(e) => e.preventDefault()}
          className="inline-flex cursor-grab items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-canvas shadow-lg active:cursor-grabbing"
          draggable
        >
          <Spark className="size-3.5" />
          Add to Ilham
        </a>
        <p className="mt-3 text-xs text-ink-faint">⇧⌘B يظهر شريط المفضلة في Chrome</p>
      </div>
      <div className="mt-4 flex gap-3 rounded-2xl bg-raised p-4 text-sm text-ink-muted">
        <Smartphone className="mt-0.5 size-4 shrink-0" />
        <p>
          في الجوال: ثبّت إلهام على الشاشة الرئيسية، وشارك أي رابط له من قائمة المشاركة (أندرويد)، أو الصق الرابط
          داخل التطبيق.
        </p>
      </div>
    </Dialog>
  );
}

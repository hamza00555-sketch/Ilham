"use client";

import { useAgentChatConfigured } from "@/lib/data/items";
import { cn } from "@/lib/ui";
import { Spark } from "../ui/brand";

/** How agents talk with you on a reference: any connected agent, free; or Claude replying on its own. */
export function AgentChatSetting() {
  const configured = useAgentChatConfigured();
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Spark className="size-3.5 text-signal" />
        محادثة كل مرجع
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-ink-muted">
        كل مرجع له محادثته. اكتب ملاحظتك، واضغط «ادعُ وكيل» والصق الدعوة لأي وكيل مربوط بمفتاح (Codex، ChatGPT، Claude،
        Grok…): يقرأ العمل وكل اللي انقال عنه، يرد في نفس المحادثة، ويبقى ينتظر ردك ما دامت جلسته مفتوحة.
      </p>

      <div className="mt-4 border-t border-line pt-3">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          الرد التلقائي من Claude
          <span
            className={cn(
              "ms-auto rounded-full px-2.5 py-0.5 text-xs font-medium",
              configured ? "bg-ink text-canvas" : "bg-raised text-ink-muted",
            )}
          >
            {configured === undefined ? "…" : configured ? "مفعّل" : "مقفل"}
          </span>
        </h3>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          اختياري ومدفوع: Claude يرد على كل ملاحظة بنفسه بدون ما تدعو أحد، ويدوّر في الويب لو سألته عن البرامج أو طريقة
          الشغل. زر «Claude يرد» فوق خانة الكتابة يشغّله لكل ملاحظة.
        </p>
        {configured === false ? (
          <ol className="mt-3 list-inside list-decimal space-y-1.5 text-xs leading-5 text-ink-muted">
            <li>
              سوّ مفتاح من{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-ink"
                dir="ltr"
              >
                console.anthropic.com
              </a>{" "}
              (يحتاج رصيد في الحساب).
            </li>
            <li>
              في Vercel: Settings ← Environment Variables، أضف <span dir="ltr" className="font-mono">ANTHROPIC_API_KEY</span>{" "}
              والصق المفتاح هناك مباشرة.
            </li>
            <li>اعمل Redeploy، وترجع هذي «مفعّل».</li>
          </ol>
        ) : null}
      </div>
    </section>
  );
}

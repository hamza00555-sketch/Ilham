"use client";

import { useAgentChatConfigured } from "@/lib/data/items";
import { cn } from "@/lib/ui";
import { Spark } from "../ui/brand";

/** Whether Claude answers notes on references, and how to switch it on. */
export function AgentChatSetting() {
  const configured = useAgentChatConfigured();
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Spark className="size-3.5 text-signal" />
        محادثة كل مرجع
        <span
          className={cn(
            "ms-auto rounded-full px-2.5 py-0.5 text-xs font-medium",
            configured ? "bg-ink text-canvas" : "bg-raised text-ink-muted",
          )}
        >
          {configured === undefined ? "…" : configured ? "مفعّلة" : "مقفلة"}
        </span>
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-ink-muted">
        اكتب ملاحظة على أي مرجع، وClaude يرد عليك في نفس المحادثة: يعرف العمل وصاحبه وصورته وكل اللي انقال عنه، ويدوّر في
        الويب لو سألته عن البرامج أو طريقة الشغل. تقدر تكتب ملاحظة لك بس من زر «Claude يرد» فوق خانة الكتابة.
      </p>
      {configured === false ? (
        <ol className="mt-4 list-inside list-decimal space-y-1.5 border-t border-line pt-3 text-xs leading-5 text-ink-muted">
          <li>
            سوّ مفتاح من{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink" dir="ltr">
              console.anthropic.com
            </a>{" "}
            (يحتاج رصيد في الحساب).
          </li>
          <li>
            في Vercel: Settings ← Environment Variables، أضف <span dir="ltr" className="font-mono">ANTHROPIC_API_KEY</span> والصق
            المفتاح هناك مباشرة.
          </li>
          <li>اعمل Redeploy، وترجع هذي «مفعّلة».</li>
        </ol>
      ) : null}
    </section>
  );
}

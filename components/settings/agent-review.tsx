"use client";

import { Switch } from "radix-ui";
import { toast } from "sonner";
import { setAgentReview } from "@/lib/data/settings";
import { friendlyError } from "@/lib/errors";
import { useShell } from "../shell/shell-context";
import { Spark } from "../ui/brand";

/** Whether agent picks wait in the Inbox by default. Projects can override it from their ⋯ menu. */
export function AgentReviewSetting() {
  const { uid, agentSettings, projects } = useShell();
  const on = agentSettings?.review ?? true;
  const overrides = projects?.filter((p) => p.agentReview === "on" || p.agentReview === "off") ?? [];

  const change = async (review: boolean) => {
    try {
      await setAgentReview(uid, review);
    } catch (err) {
      toast.error("ما قدرنا نحفظ الإعداد", { description: friendlyError(err) });
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 id="agent-review-label" className="flex items-center gap-2 font-semibold">
            <Spark className="size-3.5 text-signal" />
            راجع اقتراحات الوكيل قبل ما تنضاف
          </h2>
          <p id="agent-review-desc" className="mt-1.5 text-sm leading-6 text-ink-muted">
            {on
              ? "كل اللي يضيفه الوكيل يوقف في الوارد لين تحتفظ فيه أو ترميه."
              : "اللي يضيفه الوكيل ينضاف للمراجع مباشرة، وعليه علامة ✦ عشان تعرف مين أضافه."}
          </p>
        </div>
        <Switch.Root
          checked={on}
          disabled={!agentSettings}
          onCheckedChange={(value) => void change(value)}
          aria-labelledby="agent-review-label"
          aria-describedby="agent-review-desc"
          className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full bg-hover p-0.5 transition-colors duration-200 ease-out data-[state=checked]:bg-ink disabled:opacity-40"
        >
          {/* Right-to-left: off rests at the start (right), on slides to the end. */}
          <Switch.Thumb className="block size-6 rounded-full bg-ink-muted shadow transition-transform duration-200 ease-out data-[state=checked]:-translate-x-5 data-[state=checked]:bg-canvas" />
        </Switch.Root>
      </div>
      <p className="mt-4 border-t border-line pt-3 text-xs leading-5 text-ink-faint">
        تقدر تغيّرها لكل مشروع لحاله من قائمة ⋯ داخل المشروع.
        {overrides.length ? (
          <>
            {" "}
            مشاريع لها إعداد خاص:{" "}
            {overrides.map((p, i) => (
              <span key={p.id}>
                {i ? "، " : null}«<bdi>{p.name}</bdi>» {p.agentReview === "on" ? "مراجعة" : "مباشرة"}
              </span>
            ))}
            .
          </>
        ) : null}
      </p>
    </section>
  );
}

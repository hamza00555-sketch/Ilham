"use client";

import { Check, ChevronRight, Copy, KeyRound, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { toast } from "sonner";
import { createKey, listKeys, revokeKey, type ApiKeyInfo } from "@/lib/data/keys";
import { friendlyError } from "@/lib/errors";
import { cn, relativeTime } from "@/lib/ui";
import { Spark } from "../ui/brand";
import { Button } from "../ui/button";
import { Dialog, inputClass } from "../ui/dialog";
import { AgentChatSetting } from "./agent-chat";
import { AgentReviewSetting } from "./agent-review";

const subscribeNoop = () => () => {};
/** The site's own origin, for setup snippets (stable after hydration). */
function useOrigin() {
  return useSyncExternalStore(subscribeNoop, () => window.location.origin, () => "");
}

export function AgentKeys() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>();
  const [fresh, setFresh] = useState<{ key: string; name: string }>();
  const [revoking, setRevoking] = useState<ApiKeyInfo>();

  const refresh = () =>
    listKeys()
      .then(setKeys)
      .catch((err) => {
        setKeys([]);
        toast.error("ما قدرنا نجيب المفاتيح", { description: friendlyError(err) });
      });

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="px-4 pt-5 md:px-10 md:pt-10">
      <Link
        href="/"
        className="-ms-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-ink-muted transition hover:text-ink md:hidden"
      >
        <ChevronRight className="size-4" />
        المشاريع
      </Link>
      <header className="mt-2 max-w-2xl md:mt-0">
        <h1 className="font-arabic text-3xl font-semibold tracking-tight md:text-[40px]">الوكلاء</h1>
        <p className="mt-3 text-[15px] leading-7 text-ink-muted">
          أعطِ مفتاح لأي وكيل (Codex، Claude، ChatGPT، Grok…): يضيف مراجع لمشاريعك، ويتكلم معك في محادثة أي مرجع. سوّ
          مفتاح لكل وكيل باسمه عشان تعرف مين رد. وأنت تقرر: يوقف اللي يضيفه في{" "}
          <span className="text-signal">✦ الوارد</span> لين توافق، أو ينضاف على طول.
        </p>
      </header>

      <div className="mt-8 max-w-2xl space-y-6 pb-10">
        <AgentReviewSetting />
        <AgentChatSetting />
        <h2 className="pt-4 text-xs font-medium text-ink-faint">المفاتيح</h2>
        <CreateKeyForm
          onCreated={(created) => {
            setFresh(created);
            void refresh();
          }}
        />
        {fresh ? <NewKeyPanel apiKey={fresh.key} name={fresh.name} onDone={() => setFresh(undefined)} /> : null}
        <KeyList keys={keys} onRevoke={setRevoking} />
      </div>

      <RevokeDialog
        apiKey={revoking}
        onClose={() => setRevoking(undefined)}
        onRevoked={() => {
          setRevoking(undefined);
          void refresh();
        }}
      />
    </div>
  );
}

function CreateKeyForm({ onCreated }: { onCreated: (created: { key: string; name: string }) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { key, info } = await createKey(name.trim() || "Agent");
      onCreated({ key, name: info.name });
      setName("");
    } catch (err) {
      const code = (err as { code?: string }).code;
      toast.error("ما قدرنا ننشئ المفتاح", {
        description: code === "too-many-keys" ? "وصلت للحد (10 مفاتيح). احذف واحد قديم." : friendlyError(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        name="key-name"
        dir="auto"
        autoComplete="off"
        maxLength={40}
        placeholder="اسم الوكيل، مثلاً Codex أو ChatGPT"
        aria-label="اسم المفتاح"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={cn(inputClass, "h-11 flex-1")}
      />
      <Button type="submit" variant="primary" className="h-11 shrink-0" disabled={busy}>
        <KeyRound className="size-4" />
        أنشئ مفتاح
      </Button>
    </form>
  );
}

type Tab = "url" | "codex" | "claude" | "mcp" | "prompt" | "api";
const TABS: { id: Tab; label: string }[] = [
  { id: "url", label: "رابط مباشر" },
  { id: "codex", label: "Codex" },
  { id: "claude", label: "Claude Code" },
  { id: "mcp", label: "أي أداة MCP" },
  { id: "prompt", label: "التعليمات" },
  { id: "api", label: "API" },
];

function NewKeyPanel({ apiKey, name, onDone }: { apiKey: string; name: string; onDone: () => void }) {
  const origin = useOrigin();
  const [tab, setTab] = useState<Tab>("url");
  const snippets: Record<Tab, { hint: string; code: string }> = {
    url: {
      hint: "للتطبيقات اللي تطلب رابط MCP بس (ChatGPT، تطبيق Claude، Grok…): أضفه كـ connector بدون تسجيل دخول. الرابط فيه مفتاحك، فعامله زي كلمة السر.",
      code: `${origin}/api/mcp?key=${apiKey}`,
    },
    mcp: {
      hint: "لأي أداة تدعم MCP عن بعد (Cursor، Gemini CLI، Windsurf…): الرابط مع هيدر المفتاح.",
      code: `URL:     ${origin}/api/mcp\nHeader:  Authorization: Bearer ${apiKey}`,
    },
    codex: {
      hint: "أضف هذا لملف ‎~/.codex/config.toml‎، وحط المفتاح في متغير البيئة ILHAM_KEY.",
      code: `[mcp_servers.ilham]\nurl = "${origin}/api/mcp"\nbearer_token_env_var = "ILHAM_KEY"\n\n# then, in the terminal you run codex from:\nexport ILHAM_KEY="${apiKey}"`,
    },
    claude: {
      hint: "شغّل هذا الأمر مرة وحدة في الطرفية.",
      code: `claude mcp add --transport http ilham ${origin}/api/mcp \\\n  --header "Authorization: Bearer ${apiKey}"`,
    },
    prompt: {
      hint: "الصقها للوكيل مع اسم المشروع. يقرأ الـ brief وذوقك قبل ما يدوّر، ويجيب معلومات صاحب كل عمل.",
      code: `You are Ilham's curator agent. Use the "ilham" MCP tools.\n1. get_project("<slug>") — read the brief and knownUrls.\n2. get_taste("<slug>") — learn what I keep vs. discard.\n3. start_run("<slug>", "<your search plan>").\n4. Find <N> pieces that match the brief's mood and keywords. Skip anything in "exclude" or knownUrls.\n5. Prefer the original creator's page — no reposts, no aggregators.\n6. For each: url, direct high-res imageUrl, title, 3–5 namespaced tags, one-sentence reason tied to the brief.\n7. Credits for each: creator, creatorUrl (their portfolio), publishedAt, tools (software used) and process (how it was made, 1–3 sentences from the creator's page or a making-of). Leave out what you can't verify.\n8. add_inspiration in ONE batch, then finish_run with a 2-line summary.\n9. Anything else worth telling me about a piece → add_note, in Arabic.\n10. Notes waiting for you: list_waiting_threads, then answer each with add_note.\n\nWhen I share a reference link (…/p/<project>?ref=<id>): open_thread with it, answer my latest note with add_note, then wait_for_reply and keep answering in that thread until I say we're done.`,
    },
    api: {
      hint: "لأي أداة تقدر تسوي طلبات HTTP (n8n، Make، سكربت).",
      code: `curl -X POST ${origin}/api/v1/projects/<slug>/items \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"items":[{"url":"https://…","imageUrl":"https://…","tags":["type:ui"],"reason":"…","creator":"…","creatorUrl":"https://…","tools":["Blender"]}]}'`,
    },
  };

  return (
    <section className="rounded-2xl border border-line-strong bg-surface p-5 animate-rise">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-raised text-signal">
          <Spark className="size-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">
            مفتاح <bdi dir="auto">{name}</bdi> جاهز
          </h2>
          <p className="mt-1 text-sm text-ink-muted">انسخه الحين. ما بيظهر مرة ثانية، ولو ضاع احذفه وسوّ واحد جديد.</p>
        </div>
      </div>

      <CodeBlock code={apiKey} className="mt-4" />

      <div role="tablist" aria-label="طريقة الربط" className="mt-6 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-8 rounded-full border px-3.5 text-[13px] transition-colors",
              tab === t.id ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-muted">{snippets[tab].hint}</p>
      <CodeBlock code={snippets[tab].code} className="mt-2" />

      <Button variant="secondary" className="mt-5 w-full" onClick={onDone}>
        نسخته، خلاص
      </Button>
    </section>
  );
}

function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className={cn("relative rounded-xl border border-line bg-canvas", className)}>
      <pre dir="ltr" className="overflow-x-auto p-3.5 pe-12 font-mono text-[12.5px] leading-6 whitespace-pre text-ink">
        {code}
      </pre>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? "تم النسخ" : "نسخ"}
        className="absolute top-1.5 right-1.5 grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink"
      >
        {copied ? <Check className="size-4 text-ink" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

function KeyList({ keys, onRevoke }: { keys: ApiKeyInfo[] | undefined; onRevoke: (key: ApiKeyInfo) => void }) {
  if (keys === undefined) {
    return <div className="shimmer-surface h-16 rounded-2xl bg-raised" />;
  }
  if (!keys.length) {
    return <p className="text-sm text-ink-faint">ما عندك مفاتيح للحين.</p>;
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {keys.map((k) => (
        <li key={k.id} className="flex items-center gap-3 bg-surface px-4 py-3">
          <KeyRound className="size-4 shrink-0 text-ink-faint" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" dir="auto">
              {k.name}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">
              <span dir="ltr" className="font-mono">
                {k.preview}…
              </span>
              <span>{k.lastUsedAt ? ` · آخر استخدام ${relativeTime(k.lastUsedAt)}` : " · ما استُخدم بعد"}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRevoke(k)}
            aria-label={`احذف مفتاح ${k.name}`}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function RevokeDialog({ apiKey, onClose, onRevoked }: { apiKey?: ApiKeyInfo; onClose: () => void; onRevoked: () => void }) {
  const [busy, setBusy] = useState(false);
  const revoke = async () => {
    if (!apiKey) return;
    setBusy(true);
    try {
      await revokeKey(apiKey.id);
      toast(`انحذف مفتاح «${apiKey.name}»`);
      onRevoked();
    } catch (err) {
      toast.error("ما قدرنا نحذف المفتاح", { description: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!apiKey}
      onOpenChange={(open) => !open && onClose()}
      title={`حذف مفتاح «${apiKey?.name ?? ""}»؟`}
      description="أي وكيل يستخدمه يوقف على طول. المراجع اللي أضافها تبقى."
    >
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          إلغاء
        </Button>
        <Button variant="danger" className="flex-1" onClick={() => void revoke()} disabled={busy}>
          احذف
        </Button>
      </div>
    </Dialog>
  );
}

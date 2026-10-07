"use client";

import { ArrowLeft, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { sendEmailLink, signInWithGoogle } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { Button } from "./ui/button";
import { GoogleMark, Spark, Wordmark } from "./ui/brand";
import { inputClass } from "./ui/dialog";

// Moodboard-like tiles drifting behind the sign-in card.
const TILES = [
  ["#1d3b53", "#0f1c2a"],
  ["#5a2a17", "#1e0f09"],
  ["#2e2457", "#120e24"],
  ["#14453d", "#0a1d1a"],
  ["#4b1f3a", "#1a0b15"],
  ["#3d3d16", "#16160a"],
  ["#22324f", "#0d121d"],
  ["#53321a", "#1d1209"],
];

function Mosaic() {
  const columns = 6;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex gap-3 overflow-hidden px-3 opacity-80">
      {Array.from({ length: columns }, (_, c) => {
        const tiles = Array.from({ length: 8 }, (_, i) => TILES[(i * 3 + c * 5) % TILES.length]);
        return (
          <div
            key={c}
            className="flex flex-1 flex-col gap-3 animate-drift motion-reduce:animate-none"
            style={{ animationDuration: `${50 + c * 9}s`, animationDirection: c % 2 ? "reverse" : "normal" }}
          >
            {[...tiles, ...tiles].map(([a, b], i) => (
              <div
                key={i}
                className="aspect-[4/3] w-full shrink-0 rounded-[10px]"
                style={{ background: `linear-gradient(${120 + i * 23}deg, ${a}, ${b})` }}
              />
            ))}
          </div>
        );
      })}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(11_11_12/0.94)_28%,rgb(11_11_12/0.72)_62%,rgb(11_11_12/0.96))]" />
    </div>
  );
}

export function SignIn() {
  const [busy, setBusy] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const google = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error("ما قدرنا ندخلك", { description: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await sendEmailLink(email.trim());
      setSent(true);
    } catch (err) {
      toast.error("ما قدرنا نرسل الرابط", { description: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16">
      <Mosaic />
      <div className="relative z-10 w-full max-w-sm animate-rise text-center">
        <Wordmark className="text-sm text-ink-muted" />
        <h1 className="mt-6 font-arabic text-6xl leading-none font-bold tracking-tight md:text-7xl">إلهام</h1>
        <p className="mx-auto mt-5 max-w-xs font-arabic text-[15px] leading-7 text-ink-muted">
          كل مراجعك في مكان واحد. تضيفها أنت أو الإيجنت، وكل كرت يوديك للعمل الأصلي.
        </p>

        {sent ? (
          <div className="mt-10 rounded-2xl border border-line-strong bg-surface/80 p-5 backdrop-blur">
            <Mail className="mx-auto size-6 text-ink-muted" />
            <p className="mt-3 font-medium">شيّك على إيميلك</p>
            <p className="mt-1 text-sm text-ink-muted">
              أرسلنا رابط الدخول على <span dir="ltr">{email}</span>
            </p>
          </div>
        ) : emailMode ? (
          <form onSubmit={sendLink} className="mt-10 space-y-3">
            <input
              type="email"
              name="email"
              autoComplete="email"
              spellCheck={false}
              required
              autoFocus
              dir="ltr"
              placeholder="you@studio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} h-12 text-center`}
            />
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              أرسل رابط الدخول
            </Button>
            <button
              type="button"
              onClick={() => setEmailMode(false)}
              className="min-h-11 px-3 text-sm text-ink-muted hover:text-ink"
            >
              رجوع
            </button>
          </form>
        ) : (
          <div className="mt-10 space-y-3">
            <Button variant="primary" size="lg" className="w-full" onClick={google} disabled={busy}>
              <GoogleMark />
              المتابعة بـ Google
            </Button>
            <button
              type="button"
              onClick={() => setEmailMode(true)}
              className="inline-flex min-h-11 items-center gap-1.5 px-3 text-sm text-ink-muted transition hover:text-ink"
            >
              أو برابط على الإيميل
              <ArrowLeft className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <Spark className="absolute bottom-8 size-3 text-ink-faint" />
    </main>
  );
}

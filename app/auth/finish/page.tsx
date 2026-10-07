"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Spark } from "@/components/ui/brand";
import { inputClass } from "@/components/ui/dialog";
import { finishEmailLink, isEmailLink, storedEmail } from "@/lib/auth";

const noopSubscribe = () => () => {};

/** Landing page for the passwordless email link. */
export default function FinishSignIn() {
  const router = useRouter();
  // null during prerender; the real URL once on the client.
  const href = useSyncExternalStore(noopSubscribe, () => window.location.href, () => null);
  const valid = href !== null && isEmailLink(href);
  const saved = valid ? storedEmail() : null;
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [failed, setFailed] = useState(false);

  const complete = (address: string, link: string) =>
    finishEmailLink(address, link)
      .then(() => router.replace("/"))
      .catch(() => setFailed(true));

  // Same browser that asked for the link: finish straight away.
  useEffect(() => {
    if (href && valid && saved) void complete(saved, href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, valid, saved]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!href || !email.trim()) return;
    setSubmitted(true);
    void complete(email.trim(), href);
  };

  const message =
    href === null
      ? "يدخّلك…"
      : !valid
        ? "الرابط مو صالح أو انتهت صلاحيته."
        : failed
          ? "ما قدرنا ندخلك. جرّب ترسل رابط جديد."
          : saved || submitted
            ? "يدخّلك…"
            : null;

  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="w-full max-w-sm">
        <Spark className="mx-auto size-6 text-ink-muted" />
        {message ? (
          <p className="mt-4 text-ink-muted">{message}</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <p className="text-sm text-ink-muted">اكتب الإيميل اللي طلبت عليه الرابط</p>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} text-center`}
            />
            <Button type="submit" variant="primary" size="lg" className="w-full">
              دخول
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

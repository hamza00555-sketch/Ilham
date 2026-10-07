"use client";

import { Suspense, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { SignIn } from "../sign-in";
import { Spark } from "../ui/brand";
import { MobileNav } from "./mobile-nav";
import { ShellProvider } from "./shell-context";
import { Sidebar } from "./sidebar";

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spark className="size-6 animate-pulse text-ink-faint" />
    </div>
  );
}

/** Auth gate + chrome. Everything inside is client-rendered from Firestore. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;
  if (!user) return <SignIn />;

  return (
    <ShellProvider uid={user.uid}>
      <a
        href="#main"
        className="sr-only z-[70] rounded-full bg-ink px-4 py-2 text-sm font-medium text-canvas focus:not-sr-only focus:fixed focus:top-3 focus:start-3"
      >
        تخطَّ إلى المحتوى
      </a>
      <div className="flex min-h-dvh">
        <Suspense fallback={<div className="hidden w-64 shrink-0 border-e border-line md:block" />}>
          <Sidebar />
        </Suspense>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-28 outline-none md:pb-16">
          {children}
        </main>
      </div>
      <Suspense>
        <MobileNav />
      </Suspense>
    </ShellProvider>
  );
}

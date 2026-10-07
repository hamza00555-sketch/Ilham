"use client";

import { Direction } from "radix-ui";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Direction.Provider dir="rtl">
      <AuthProvider>{children}</AuthProvider>
      <Toaster
        theme="dark"
        dir="rtl"
        position="bottom-center"
        mobileOffset={{ bottom: 96 }}
        toastOptions={{
          classNames: {
            toast: "!bg-raised !border-line-strong !rounded-2xl !text-ink !shadow-2xl !font-sans",
            description: "!text-ink-muted",
            actionButton: "!bg-ink !text-canvas !rounded-full !font-medium",
          },
        }}
      />
    </Direction.Provider>
  );
}

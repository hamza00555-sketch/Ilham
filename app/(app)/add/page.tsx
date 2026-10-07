import type { Metadata } from "next";
import { Suspense } from "react";
import { AddFromLink } from "@/components/add-from-link";

// Rendered client-side behind the auth gate in (app)/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "إضافة" };

// Entry point for the bookmarklet and the PWA share target: /add?url=…&title=…&image=…
export default function AddPage() {
  return (
    <Suspense>
      <AddFromLink />
    </Suspense>
  );
}

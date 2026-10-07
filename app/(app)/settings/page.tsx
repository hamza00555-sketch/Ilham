import type { Metadata } from "next";
import { AgentKeys } from "@/components/settings/agent-keys";

// Rendered client-side behind the auth gate in (app)/layout.tsx.
export const instant = false;

export const metadata: Metadata = { title: "مفاتيح الوكلاء" };

export default function SettingsPage() {
  return <AgentKeys />;
}

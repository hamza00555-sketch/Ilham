import { AppShell } from "@/components/shell/app-shell";

// Pages under this layout render only after Firebase Auth resolves in the browser,
// so there is no server-rendered segment for instant-navigation validation to check.
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}

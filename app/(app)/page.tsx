import { ProjectsHome } from "@/components/projects/projects-home";

// Rendered client-side behind the auth gate in (app)/layout.tsx.
export const instant = false;

export default function HomePage() {
  return <ProjectsHome />;
}

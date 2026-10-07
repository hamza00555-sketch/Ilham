import { Suspense } from "react";
import { GridSkeleton, ProjectView } from "@/components/project/project-view";

// Rendered client-side behind the auth gate in (app)/layout.tsx.
export const instant = false;

// The slug is only known at request time; ProjectView reads it with useParams() inside Suspense.
export default function ProjectPage() {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <ProjectView />
    </Suspense>
  );
}

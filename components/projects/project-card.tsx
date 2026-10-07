import Link from "next/link";
import type { ProjectDoc } from "@/lib/data/projects";
import { cn, countLabel } from "@/lib/ui";
import type { CoverTile } from "@/shared/types";
import { ProjectMenu } from "../project/project-menu";
import { Spark } from "../ui/brand";

function Tile({ tile, className }: { tile: CoverTile; className?: string }) {
  return (
    <span
      className={cn(
        "block bg-cover transition-transform duration-300 ease-out-quint group-hover:scale-[1.02]",
        tile.tall ? "bg-top" : "bg-center",
        className,
      )}
      style={{ backgroundImage: `url(${tile.url}), url(${tile.lqip})`, backgroundColor: tile.color }}
    />
  );
}

/** Behance-style moodboard cover: 1 → full, 2 → split, 3 → hero + stack, 4 → grid. */
function Cover({ tiles }: { tiles: CoverTile[] }) {
  if (!tiles.length) {
    return (
      <span className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,#1f1f24,#121214_70%)]">
        <Spark className="size-6 text-ink-faint/60" />
      </span>
    );
  }
  if (tiles.length === 1) return <Tile tile={tiles[0]} className="size-full" />;
  if (tiles.length === 2)
    return (
      <span className="grid size-full grid-cols-2 gap-0.5">
        {tiles.map((t, i) => (
          <Tile key={i} tile={t} />
        ))}
      </span>
    );
  if (tiles.length === 3)
    return (
      <span className="grid size-full grid-cols-3 grid-rows-2 gap-0.5">
        <Tile tile={tiles[0]} className="col-span-2 row-span-2" />
        <Tile tile={tiles[1]} />
        <Tile tile={tiles[2]} />
      </span>
    );
  return (
    <span className="grid size-full grid-cols-2 grid-rows-2 gap-0.5">
      {tiles.slice(0, 4).map((t, i) => (
        <Tile key={i} tile={t} />
      ))}
    </span>
  );
}

export function ProjectCard({ project, index }: { project: ProjectDoc; index: number }) {
  return (
    <div className="group relative animate-rise" style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}>
      <Link href={`/p/${project.slug}`} className="block">
        <span className="relative block aspect-[4/3] overflow-hidden rounded-card bg-raised ring-1 ring-line ring-inset">
          <Cover tiles={project.cover ?? []} />
        </span>
        <span className="mt-3 flex items-baseline justify-between gap-3 px-0.5">
          <span className="truncate text-[15px] font-medium" dir="auto">
            {project.name}
          </span>
          <span className="shrink-0 text-xs text-ink-faint">
            {countLabel(project.counts?.kept ?? 0)}
            {project.counts?.inbox ? <span className="ms-2 text-signal">✦ {project.counts.inbox}</span> : null}
          </span>
        </span>
      </Link>
      {/* Sibling of the link (a menu can't live inside <a>); shows on hover or focus on desktop. */}
      <ProjectMenu
        project={project}
        trigger="overlay"
        className="absolute top-0.5 end-0.5 md:top-1 md:end-1 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
      />
    </div>
  );
}

import type { Platform } from "@/shared/types";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const PLATFORMS: Record<Platform, { label: string; color: string }> = {
  dribbble: { label: "Dribbble", color: "#ea4c89" },
  behance: { label: "Behance", color: "#1769ff" },
  youtube: { label: "YouTube", color: "#ff2e4d" },
  vimeo: { label: "Vimeo", color: "#1ab7ea" },
  awwwards: { label: "Awwwards", color: "#e8e8e8" },
  artstation: { label: "ArtStation", color: "#13aff0" },
  pinterest: { label: "Pinterest", color: "#e60023" },
  instagram: { label: "Instagram", color: "#e1306c" },
  mobbin: { label: "Mobbin", color: "#f4f4f5" },
  web: { label: "Web", color: "#a1a1aa" },
};

export function countLabel(n: number) {
  if (n === 0) return "فاضي";
  if (n === 1) return "مرجع واحد";
  if (n === 2) return "مرجعين";
  if (n <= 10) return `${n} مراجع`;
  return `${n} مرجع`;
}

export function projectCountLabel(n: number) {
  if (n === 0) return "ابدأ أول مشروع";
  if (n === 1) return "مشروع واحد";
  if (n === 2) return "مشروعين";
  if (n <= 10) return `${n} مشاريع`;
  return `${n} مشروع`;
}

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

// Latin digits, like the counts above.
const rtf = new Intl.RelativeTimeFormat("ar-u-nu-latn", { numeric: "auto" });

/** "قبل 5 دقائق", "أمس"… */
export function relativeTime(isoDate: string): string {
  const minutes = Math.round((new Date(isoDate).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) return "الحين";
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  return new Intl.DateTimeFormat("ar-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(new Date(isoDate));
}

/** A publish date as precise as we know it: "5 مارس 2023", "مارس 2023" or "2023". */
export function formatPublished(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!m) return String(y);
  const value = new Date(Date.UTC(y, m - 1, d || 1));
  return new Intl.DateTimeFormat("ar-u-nu-latn", { day: d ? "numeric" : undefined, month: "long", year: "numeric", timeZone: "UTC" }).format(value);
}

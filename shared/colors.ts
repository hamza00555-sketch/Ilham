// Color helpers for palettes and color search (`colorBuckets` + array-contains).

export type RGB = [number, number, number];

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

export function fromHex(hex: string): RGB {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export function toHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

const HUES: [number, string][] = [
  [15, "red"],
  [45, "orange"],
  [70, "yellow"],
  [160, "green"],
  [195, "teal"],
  [255, "blue"],
  [290, "purple"],
  [340, "pink"],
  [360, "red"],
];

/** "blue-dark", "orange-mid", "neutral-light"… coarse enough that similar colors match. */
export function colorBucket(rgb: RGB): string {
  const [h, s, l] = toHsl(rgb);
  const tone = l < 0.3 ? "dark" : l > 0.72 ? "light" : "mid";
  if (s < 0.18 || l < 0.08 || l > 0.95) return `neutral-${tone}`;
  const family = HUES.find(([max]) => h < max)?.[1] ?? "red";
  return `${family}-${tone}`;
}

/**
 * Simple palette from raw RGB pixels: bucket by quantized color, take the most frequent,
 * and skip near-duplicates. Good enough for swatches and color search.
 */
export function extractPalette(pixels: Uint8Array | Buffer, channels: number, size = 5): RGB[] {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 2 < pixels.length; i += channels) {
    if (channels === 4 && pixels[i + 3] < 128) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const entry = counts.get(key);
    if (entry) {
      entry.n++;
      entry.r += r;
      entry.g += g;
      entry.b += b;
    } else {
      counts.set(key, { n: 1, r, g, b });
    }
  }
  const sorted = [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .map((e) => [e.r / e.n, e.g / e.n, e.b / e.n] as RGB);

  const palette: RGB[] = [];
  for (const color of sorted) {
    if (palette.every((p) => distance(p, color) > 48)) palette.push(color);
    if (palette.length === size) break;
  }
  return palette;
}

function distance(a: RGB, b: RGB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

import { describe, expect, it } from "vitest";
import { chooseSizes, columnsFor, layoutBento, naturalSize, SPAN, type TileInput } from "@/lib/bento";

const img = (id: string, ratio: number | null, extra: Partial<TileInput> = {}): TileInput => ({
  id,
  ratio,
  width: 1280,
  video: false,
  ...extra,
});

/** A realistic mix: Dribbble 4:3 shots, videos, posters, phone screens, wide OG cards, pending. */
function board(n: number): TileInput[] {
  const shapes: [number | null, boolean][] = [
    [4 / 3, false], [16 / 9, true], [0.75, false], [1, false], [1.91, false], [0.46, false], [4 / 3, false], [null, false], [1.5, false],
  ];
  return Array.from({ length: n }, (_, i) => {
    const [ratio, video] = shapes[(i * 7) % shapes.length];
    return img(`item-${i}`, ratio, { video });
  });
}

function cellsOf(tiles: ReturnType<typeof layoutBento>) {
  const seen = new Set<string>();
  for (const t of tiles) {
    for (let r = t.row; r < t.row + t.h; r++) {
      for (let c = t.col; c < t.col + t.w; c++) {
        const key = `${r}:${c}`;
        if (seen.has(key)) throw new Error(`overlap at ${key}`);
        seen.add(key);
      }
    }
  }
  return seen;
}

describe("naturalSize", () => {
  it("follows the work's shape", () => {
    expect(naturalSize(img("a", 16 / 9, { video: true }))).toBe("W");
    expect(naturalSize(img("a", 1.91))).toBe("W");
    expect(naturalSize(img("a", 0.56))).toBe("T");
    expect(naturalSize(img("a", 4 / 3))).toBe("S");
    expect(naturalSize(img("a", null))).toBe("S");
  });
});

describe("columnsFor", () => {
  it("2 on phones, 4 on tablets, 6 on laptops, 8 on wide screens", () => {
    expect([358, 688, 1104, 1584].map(columnsFor)).toEqual([2, 4, 6, 8]);
  });
});

describe("chooseSizes", () => {
  it("opens with a hero, then spaces them 6 to 12 apart", () => {
    const sizes = chooseSizes(board(120));
    const heroes = sizes.flatMap((s, i) => (s === "L" ? [i] : []));
    expect(heroes[0]).toBeLessThan(3);
    for (let k = 1; k < heroes.length; k++) {
      expect(heroes[k] - heroes[k - 1]).toBeGreaterThanOrEqual(7);
      expect(heroes[k] - heroes[k - 1]).toBeLessThanOrEqual(16);
    }
  });
  it("never makes a blurry or tall image the hero", () => {
    const sizes = chooseSizes([img("small", 4 / 3, { width: 400 }), img("tall", 0.5), img("none", null)]);
    expect(sizes).not.toContain("L");
  });
  it("keeps most sizes when a new reference arrives on top", () => {
    const items = board(60);
    const before = chooseSizes(items);
    const after = chooseSizes([img("new", 0.75), ...items]).slice(1);
    const same = before.filter((s, i) => s === after[i]).length;
    expect(same / before.length).toBeGreaterThan(0.8);
  });
});

describe("layoutBento", () => {
  it.each([2, 4, 6, 8])("packs without overlaps and closes the last row (%i columns)", (cols) => {
    for (const n of [7, 23, 60, 90]) {
      const tiles = layoutBento(board(n), cols);
      expect(tiles).toHaveLength(n);
      const cells = cellsOf(tiles);
      const rows = Math.max(...tiles.map((t) => t.row + t.h));
      expect(tiles.every((t) => t.col + t.w <= cols)).toBe(true);
      // A full rectangle, or at most a couple of cells short when the shapes can't close it.
      expect(rows * cols - cells.size).toBeLessThanOrEqual(2);
    }
  });
  it("tile spans match their sizes", () => {
    for (const t of layoutBento(board(30), 6)) expect([t.w, t.h]).toEqual(SPAN[t.size]);
  });
});

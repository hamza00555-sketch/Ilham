// The project board's bento layout: each reference gets a tile size from its own shape, then the
// tiles are packed into the grid in order, filling gaps (like CSS `grid-auto-flow: row dense`, but
// computed here so the last row can be closed cleanly). Pure, so it is tested without a browser.

export type TileSize = "L" | "W" | "T" | "S";

export interface TileInput {
  id: string;
  /** width / height of the preview; null while there is none (pending, failed). */
  ratio: number | null;
  /** Preview width in pixels: heroes need enough of them to stay sharp. */
  width: number;
  video: boolean;
}

export interface Tile {
  size: TileSize;
  /** 0-based cell of the tile's start corner (column 0 is the start edge, right in RTL). */
  col: number;
  row: number;
  w: number;
  h: number;
}

export const SPAN: Record<TileSize, [w: number, h: number]> = { L: [2, 2], W: [2, 1], T: [1, 2], S: [1, 1] };

/** Cells are 4:3, so a 2×1 tile is about 2.7:1 and a 1×2 tile about 0.65:1. */
export const CELL_RATIO = 4 / 3;

/** Columns for a board width: 2 on phones, 4 on tablets, 6 on laptops, 8 on wide screens. */
export function columnsFor(width: number): number {
  if (width < 560) return 2;
  if (width < 900) return 4;
  if (width < 1500) return 6;
  return 8;
}

/** Gap between tiles: tighter on phones. */
export const gapFor = (width: number) => (width < 560 ? 10 : 14);

/** The tile a reference's own shape asks for, before heroes and the last-row fix. */
export function naturalSize(t: TileInput): TileSize {
  if (t.ratio === null) return "S";
  if (t.video || t.ratio >= 1.6) return "W";
  if (t.ratio <= 0.85) return "T";
  return "S";
}

const heroEligible = (t: TileInput) => t.ratio !== null && t.ratio >= 0.9 && t.ratio <= 2 && t.width >= 900;

/** FNV-1a: a stable number per id, so a reference keeps its size when others are added around it. */
function hash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const MIN_HERO_GAP = 6;
const MAX_HERO_GAP = 12;

/**
 * Sizes for the whole board. Heroes (2×2) open the board and then come roughly every nine
 * references: never closer than six, never further than twelve, picked by id rather than by
 * position so they don't hop around as the board grows.
 */
export function chooseSizes(items: TileInput[]): TileSize[] {
  let since = Infinity;
  return items.map((t, i) => {
    const eligible = heroEligible(t);
    const opening = since === Infinity && i < 3;
    const hero =
      eligible && (opening || (since >= MIN_HERO_GAP && (hash(t.id) % 4 === 0 || since >= MAX_HERO_GAP)));
    if (hero) {
      since = 0;
      return "L";
    }
    if (since !== Infinity) since++;
    return naturalSize(t);
  });
}

class Grid {
  private cells: boolean[] = [];
  private firstOpen = 0;
  rows = 0;
  constructor(readonly cols: number) {}

  clone(): Grid {
    const g = new Grid(this.cols);
    g.cells = this.cells.slice();
    g.firstOpen = this.firstOpen;
    g.rows = this.rows;
    return g;
  }

  private taken(row: number, col: number) {
    return this.cells[row * this.cols + col] === true;
  }

  /** First-fit from the top, like `dense`: earlier gaps get filled by later tiles. */
  place(w: number, h: number): { col: number; row: number } {
    const width = Math.min(w, this.cols);
    for (let row = this.firstOpen; ; row++) {
      for (let col = 0; col + width <= this.cols; col++) {
        let fits = true;
        for (let r = row; r < row + h && fits; r++) {
          for (let c = col; c < col + width && fits; c++) fits = !this.taken(r, c);
        }
        if (!fits) continue;
        for (let r = row; r < row + h; r++) for (let c = col; c < col + width; c++) this.cells[r * this.cols + c] = true;
        this.rows = Math.max(this.rows, row + h);
        while (this.firstOpen < this.rows && this.rowFull(this.firstOpen)) this.firstOpen++;
        return { col, row };
      }
    }
  }

  private rowFull(row: number) {
    for (let c = 0; c < this.cols; c++) if (!this.taken(row, c)) return false;
    return true;
  }

  /** Empty cells inside the used rows: what makes a board look unfinished. */
  holes(): number {
    let n = 0;
    for (let i = 0; i < this.rows * this.cols; i++) if (!this.cells[i]) n++;
    return n;
  }
}

/**
 * Sizes a tile may switch to when closing the last row. A little extra crop is worth a finished
 * board, but never a portrait squeezed into a wide band or a landscape into a tall one.
 */
function alternatives(size: TileSize, t: TileInput): TileSize[] {
  if (t.ratio === null) return [];
  const wideOk = t.video || t.ratio >= 1.2;
  const tallOk = !t.video && t.ratio <= 1.1;
  switch (size) {
    case "S":
      return [...(wideOk ? (["W"] as const) : []), ...(tallOk ? (["T"] as const) : [])];
    case "W":
      return ["S", ...(heroEligible(t) ? (["L"] as const) : [])];
    case "T":
      return ["S"];
    case "L":
      return ["W", "S"];
  }
}

const TAIL = 16;
const FIX_ROUNDS = 10;

/** Sizes and positions for every reference on a board `cols` wide. */
export function layoutBento(items: TileInput[], cols: number): Tile[] {
  const sizes = chooseSizes(items);

  // Pack everything before the tail once; only the tail is re-packed while closing the last row.
  const tailStart = Math.max(0, items.length - TAIL);
  const head = new Grid(cols);
  const headTiles = sizes.slice(0, tailStart).map((size) => {
    const [w, h] = SPAN[size];
    return { size, ...head.place(w, h), w: Math.min(w, cols), h };
  });

  const packTail = (tailSizes: TileSize[]) => {
    const grid = head.clone();
    const tiles = tailSizes.map((size) => {
      const [w, h] = SPAN[size];
      return { size, ...grid.place(w, h), w: Math.min(w, cols), h };
    });
    return { tiles, holes: grid.holes() };
  };

  let tail = sizes.slice(tailStart);
  let best = packTail(tail);
  for (let round = 0; round < FIX_ROUNDS && best.holes > 0; round++) {
    let improved: { tail: TileSize[]; packed: ReturnType<typeof packTail> } | null = null;
    // Later tiles first: changing them disturbs less of the board.
    for (let i = tail.length - 1; i >= 0; i--) {
      for (const alt of alternatives(tail[i], items[tailStart + i])) {
        const candidate = tail.slice();
        candidate[i] = alt;
        const packed = packTail(candidate);
        if (packed.holes < (improved?.packed.holes ?? best.holes)) improved = { tail: candidate, packed };
      }
    }
    if (!improved) break;
    tail = improved.tail;
    best = improved.packed;
  }
  return [...headTiles, ...best.tiles];
}

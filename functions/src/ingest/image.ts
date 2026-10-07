import sharp from "sharp";
import { colorBucket, extractPalette, toHex, type RGB } from "../../../shared/colors";

export interface ProcessedImage {
  w640: Buffer;
  w1280: Buffer;
  width: number;
  height: number;
  lqip: string;
  dominantColor: string;
  palette: string[];
  colorBuckets: string[];
}

/** Tall pages/projects are cropped from the top at 1:2 so previews stay light. */
const MAX_TALL_RATIO = 2;

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const source = () => sharp(input, { limitInputPixels: 100_000_000 }).rotate();

  const meta = await source().metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const srcW = (swap ? meta.height : meta.width) ?? 0;
  const srcH = (swap ? meta.width : meta.height) ?? 0;
  if (!srcW || !srcH) throw new Error("Unreadable image");

  const variant = async (width: number, quality: number) => {
    const w = Math.min(width, srcW);
    const tall = srcH / srcW > MAX_TALL_RATIO;
    return source()
      .resize(tall ? { width: w, height: Math.round(w * MAX_TALL_RATIO), fit: "cover", position: "top" } : { width: w })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  };

  const [large, small, tiny, stats, raw] = await Promise.all([
    variant(1280, 80),
    variant(640, 76),
    source().resize({ width: 24 }).webp({ quality: 40 }).toBuffer(),
    source().stats(),
    source().resize(64, 64, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  const palette = extractPalette(raw.data, raw.info.channels);
  const dominant: RGB = [stats.dominant.r, stats.dominant.g, stats.dominant.b];

  return {
    w640: small.data,
    w1280: large.data,
    width: large.info.width,
    height: large.info.height,
    lqip: `data:image/webp;base64,${tiny.toString("base64")}`,
    dominantColor: toHex(dominant),
    palette: palette.map(toHex),
    colorBuckets: [...new Set([dominant, ...palette].map(colorBucket))],
  };
}

import { describe, expect, it } from "vitest";
import { colorBucket, extractPalette, fromHex, toHex } from "@/shared/colors";

describe("colorBucket", () => {
  it.each([
    ["#0b0b0c", "neutral-dark"],
    ["#f8f8f8", "neutral-light"],
    ["#1769ff", "blue-mid"],
    ["#ea4c89", "pink-mid"],
    ["#c6ff3d", "green-mid"],
    ["#ffd400", "yellow-mid"],
    ["#14453d", "teal-dark"],
    ["#ff5a1f", "orange-mid"],
    ["#e60023", "red-mid"],
  ])("%s → %s", (hex, bucket) => expect(colorBucket(fromHex(hex))).toBe(bucket));
});

describe("extractPalette", () => {
  it("returns the dominant distinct colors, most frequent first", () => {
    const px: number[] = [];
    for (let i = 0; i < 70; i++) px.push(20, 40, 200);
    for (let i = 0; i < 30; i++) px.push(240, 240, 240);
    for (let i = 0; i < 5; i++) px.push(22, 42, 202); // near-duplicate of the first
    const palette = extractPalette(Uint8Array.from(px), 3).map(toHex);
    expect(palette).toHaveLength(2);
    expect(palette[0]).toBe("#1428c8");
  });
});

import { describe, expect, it } from "vitest";
import { motionSource, vimeoId, youtubeId } from "@/shared/video";

describe("youtubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/abcdefghijk", "abcdefghijk"],
  ])("%s", (url, id) => expect(youtubeId(url)).toBe(id));
});

describe("vimeoId", () => {
  it.each([
    ["https://vimeo.com/76979871", "76979871"],
    ["https://vimeo.com/channels/staffpicks/76979871", "76979871"],
    ["https://player.vimeo.com/video/76979871", "76979871"],
    ["https://vimeo.com/user123", null],
    ["https://example.com/76979871", null],
  ])("%s", (url, id) => expect(vimeoId(url)).toBe(id));
});

describe("motionSource", () => {
  it("prefers our own stored loop", () => {
    expect(
      motionSource({ sourceUrl: "https://vimeo.com/76979871", platform: "vimeo", preview: { video: "https://cdn/loop.mp4" } }),
    ).toEqual({ kind: "file", src: "https://cdn/loop.mp4" });
  });
  it("falls back to muted, chrome-less official embeds", () => {
    const yt = motionSource({ sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", platform: "youtube" });
    expect(yt?.kind).toBe("embed");
    expect(yt && "src" in yt && yt.src).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*mute=1.*controls=0.*loop=1.*playlist=dQw4w9WgXcQ/);
    const vm = motionSource({ sourceUrl: "https://vimeo.com/76979871", platform: "vimeo" });
    expect(vm && vm.src).toBe("https://player.vimeo.com/video/76979871?background=1&autoplay=1&muted=1&loop=1&dnt=1");
  });
  it("has nothing for still references", () => {
    expect(motionSource({ sourceUrl: "https://dribbble.com/shots/1-x", platform: "dribbble", preview: { video: null } })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  detectPlatform,
  extractUrl,
  hashUrl,
  InvalidUrlError,
  searchTokens,
  titleFromUrl,
} from "@/shared/normalize";

describe("extractUrl", () => {
  it("pulls the link out of share-sheet text", () => {
    expect(extractUrl("Check this out https://dribbble.com/shots/123-Hero.")).toBe("https://dribbble.com/shots/123-Hero");
  });
  it("accepts bare domains", () => {
    expect(extractUrl("linear.app/method")).toBe("https://linear.app/method");
  });
  it("returns null for plain text", () => {
    expect(extractUrl("just some words")).toBeNull();
  });
});

describe("canonicalizeUrl", () => {
  it("strips tracking params, hash and trailing slash, and sorts the query", () => {
    expect(canonicalizeUrl("HTTP://Dribbble.com/shots/123-Hero/?utm_source=x&b=2&a=1&fbclid=z#comments")).toBe(
      "https://dribbble.com/shots/123-Hero?a=1&b=2",
    );
  });
  it("collapses youtu.be and youtube.com watch links to one form", () => {
    const short = canonicalizeUrl("https://youtu.be/dQw4w9WgXcQ?si=abc");
    const long = canonicalizeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share");
    expect(short).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(long).toBe(short);
  });
  it("keeps meaningful params", () => {
    expect(canonicalizeUrl("https://example.com/search?q=glass&page=2")).toBe("https://example.com/search?page=2&q=glass");
  });
  it("drops the slash on bare origins", () => {
    expect(canonicalizeUrl("https://godly.website/")).toBe("https://godly.website");
  });
  it("rejects non-web links", () => {
    expect(() => canonicalizeUrl("javascript:alert(1)")).toThrow(InvalidUrlError);
    expect(() => canonicalizeUrl("hello")).toThrow(InvalidUrlError);
  });
});

describe("hashUrl", () => {
  it("is a stable sha-256 hex digest", async () => {
    const a = await hashUrl("https://dribbble.com/shots/1");
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashUrl("https://dribbble.com/shots/1")).toBe(a);
    expect(await hashUrl("https://dribbble.com/shots/2")).not.toBe(a);
  });
});

describe("detectPlatform", () => {
  it.each([
    ["https://dribbble.com/shots/1", "dribbble"],
    ["https://www.behance.net/gallery/1/x", "behance"],
    ["https://www.youtube.com/watch?v=1", "youtube"],
    ["https://vimeo.com/1", "vimeo"],
    ["https://www.pinterest.co.uk/pin/1", "pinterest"],
    ["https://pin.it/abc", "pinterest"],
    ["https://linear.app", "web"],
  ])("%s → %s", (url, platform) => expect(detectPlatform(url)).toBe(platform));
});

describe("titleFromUrl", () => {
  it("reads the slug of a Dribbble shot", () => {
    expect(titleFromUrl("https://dribbble.com/shots/23456789-Spatial-Onboarding-UI")).toBe("Spatial Onboarding UI");
  });
  it("reads the last segment of a Behance project", () => {
    expect(titleFromUrl("https://www.behance.net/gallery/123456789/Brand-Identity-System")).toBe("Brand Identity System");
  });
  it("falls back to the host for hashed file names", () => {
    expect(titleFromUrl("https://i.pinimg.com/originals/d5/3b/01/d53b014d86a6b6761bf649a0ed813c2b.png")).toBe("i.pinimg.com");
  });
});

describe("searchTokens", () => {
  it("lowercases, splits and dedupes, keeping Arabic", () => {
    expect(searchTokens("Glass UI — Glass", "هوية بصرية")).toEqual(["glass", "ui", "هوية", "بصرية"]);
  });
});

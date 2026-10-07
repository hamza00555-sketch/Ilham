import { describe, expect, it } from "vitest";
import { cleanTitle } from "@/server/ingest/extractors";
import { parseHtml } from "@/server/ingest/metadata";
import { asVideo, MAX_VIDEO_BYTES } from "@/server/ingest/pipeline";
import { assertPublicHost, looksBlocked, type FetchResult } from "@/server/ingest/safeFetch";

describe("parseHtml", () => {
  it("reads OpenGraph, resolves relative images and decodes entities", () => {
    const meta = parseHtml(
      `<html><head>
        <title>Fallback</title>
        <meta property="og:title" content="Spatial UI &amp; Glass">
        <meta property="og:image" content="/img/cover.png">
        <meta property="og:site_name" content="Studio">
        <meta name="author" content="Jane">
      </head></html>`,
      "https://studio.example/work/1",
    );
    expect(meta).toMatchObject({
      title: "Spatial UI & Glass",
      image: "https://studio.example/img/cover.png",
      siteName: "Studio",
      author: "Jane",
    });
  });
  it("falls back to <title> and twitter:image", () => {
    const meta = parseHtml(
      `<title>Only title</title><meta name="twitter:image" content="https://cdn.example/t.jpg">`,
      "https://x.example",
    );
    expect(meta.title).toBe("Only title");
    expect(meta.image).toBe("https://cdn.example/t.jpg");
  });
});

describe("cleanTitle", () => {
  it("splits Dribbble titles into work + author", () => {
    expect(cleanTitle("Spatial Onboarding by Jane Doe for Studio on Dribbble", "dribbble")).toEqual({
      title: "Spatial Onboarding",
      author: "Jane Doe",
    });
  });
  it("strips Behance and site-name suffixes", () => {
    expect(cleanTitle("Brand System :: Behance", "behance").title).toBe("Brand System");
    expect(cleanTitle("Visa Icon and Illustration System - Forma & Co", "behance")).toEqual({
      title: "Visa Icon and Illustration System",
      author: "Forma & Co",
    });
    expect(cleanTitle("Linear — The method | Linear", "web", "Linear").title).toBe("Linear — The method");
  });
});

describe("asVideo", () => {
  const pad = (head: Buffer, size = 4096) => Buffer.concat([head, Buffer.alloc(size - head.length)]);
  it("recognizes MP4 and WebM by magic bytes, whatever the content-type says", () => {
    expect(asVideo(pad(Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70])))?.contentType).toBe("video/mp4");
    expect(asVideo(pad(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])))?.contentType).toBe("video/webm");
  });
  it("rejects other files and oversize videos", () => {
    expect(asVideo(pad(Buffer.from("<html>")))).toBeNull();
    expect(asVideo(pad(Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]), MAX_VIDEO_BYTES + 1))).toBeNull();
  });
});

describe("assertPublicHost (SSRF guard)", () => {
  it.each(["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "::1", "[::ffff:127.0.0.1]", "localhost", "metadata.google.internal"])(
    "blocks %s",
    async (host) => {
      await expect(assertPublicHost(host)).rejects.toThrow(/Blocked/);
    },
  );
  it("allows public IPs", async () => {
    await expect(assertPublicHost("8.8.8.8")).resolves.toBeUndefined();
  });
});

describe("looksBlocked", () => {
  const res = (status: number, body = "", headers: Record<string, string> = {}): FetchResult => ({
    url: "https://x",
    status,
    contentType: "text/html",
    headers: new Headers(headers),
    body: Buffer.from(body),
  });
  it("detects bot walls", () => {
    expect(looksBlocked(res(403))).toBe(true);
    expect(looksBlocked(res(202, "<script>window.awsWafCookieDomainList=[]</script>"))).toBe(true);
    expect(looksBlocked(res(200, "<title>Just a moment...</title>"))).toBe(true);
    expect(looksBlocked(res(200, "ok", { "cf-mitigated": "challenge" }))).toBe(true);
  });
  it("lets normal pages through", () => {
    expect(looksBlocked(res(200, "<html><head><title>Work</title></head></html>"))).toBe(false);
    expect(looksBlocked(res(404))).toBe(false);
  });
});

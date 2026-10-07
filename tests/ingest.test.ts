import { describe, expect, it } from "vitest";
import { cleanTitle, youtubeId } from "@/functions/src/ingest/extractors";
import { parseHtml } from "@/functions/src/ingest/metadata";
import { assertPublicHost, looksBlocked, type FetchResult } from "@/functions/src/ingest/safeFetch";

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
    expect(cleanTitle("Linear — The method | Linear", "web", "Linear").title).toBe("Linear — The method");
  });
});

describe("youtubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/abcdefghijk", "abcdefghijk"],
  ])("%s", (url, id) => expect(youtubeId(url)).toBe(id));
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

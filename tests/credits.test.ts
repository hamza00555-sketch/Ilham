import { describe, expect, it } from "vitest";
import { parseYoutubeWatch } from "@/server/ingest/extractors";
import { parseHtml } from "@/server/ingest/metadata";
import { cleanDescription, cleanTools, detectTools, normalizeDate } from "@/shared/credits";
import { buildItem, creditFields, makeNote } from "@/shared/items";

describe("detectTools", () => {
  it("finds the software a creator names, under its usual name", () => {
    expect(detectTools("Made in C4D + Octane, comp in After Effects", "#blender")).toEqual([
      "Blender",
      "Cinema 4D",
      "Octane",
      "After Effects",
    ]);
    expect(detectTools("سويته في بلندر وفوتوشوب")).toEqual(["Blender", "Photoshop"]);
  });
  it("doesn't mistake everyday words for tools", () => {
    expect(detectTools("unity of form, a notch in the frame, I'm an illustrator on the runway")).toEqual([]);
  });
});

describe("cleanTools", () => {
  it("canonicalizes, drops vendor prefixes and dedupes", () => {
    expect(cleanTools(["c4d", "Adobe After Effects", "after effects", "UE5", " Houdini ", "", 3, "My Own Tool"])).toEqual([
      "Cinema 4D",
      "After Effects",
      "Unreal Engine",
      "Houdini",
      "My Own Tool",
    ]);
    expect(cleanTools(undefined)).toEqual([]);
  });
});

describe("normalizeDate", () => {
  it("keeps the precision the source has", () => {
    expect(normalizeDate("2011-04-15 08:35:35")).toBe("2011-04-15");
    expect(normalizeDate("2023-05-01T10:00:00Z")).toBe("2023-05-01");
    expect(normalizeDate("2023-05")).toBe("2023-05");
    expect(normalizeDate("2023")).toBe("2023");
    expect(normalizeDate("March 5, 2023")).toMatch(/^2023-03-0[45]$/);
    expect(normalizeDate(1690000000)).toBe("2023-07-22");
  });
  it("rejects junk and impossible dates", () => {
    expect(normalizeDate("soon")).toBeNull();
    expect(normalizeDate("1066")).toBeNull();
    expect(normalizeDate("2023-13")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
  });
});

describe("cleanDescription", () => {
  it("tidies whitespace and drops platform taglines and title echoes", () => {
    expect(cleanDescription("  Line one\r\n\r\n\r\n\r\nLine   two ", "T")).toBe("Line one\n\nLine two");
    expect(cleanDescription("Enjoy the videos and music you love, upload original content…")).toBeNull();
    expect(cleanDescription("Spatial UI", "spatial ui")).toBeNull();
  });
});

describe("parseHtml credits", () => {
  it("reads author, portfolio, date, keywords and the full description from JSON-LD", () => {
    const meta = parseHtml(
      `<head>
        <meta property="og:description" content="Short">
        <meta name="keywords" content="3d, blender">
        <script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":"CreativeWork",
          "author":{"@type":"Person","name":"Jane Doe","url":"/jane"},
          "datePublished":"2024-02-10","description":"The whole story of how this was made."}]}</script>
        <script type="application/ld+json">{broken</script>
      </head>`,
      "https://studio.example/work/1",
    );
    expect(meta).toMatchObject({
      author: "Jane Doe",
      authorUrl: "https://studio.example/jane",
      publishedAt: "2024-02-10",
      keywords: "3d, blender",
      description: "The whole story of how this was made.",
    });
  });
  it("treats a link in article:author as the creator's page, not their name", () => {
    const meta = parseHtml(
      `<meta property="article:author" content="https://social.example/jane">
       <meta property="article:published_time" content="2022-09-01T08:00:00Z">`,
      "https://blog.example/post",
    );
    expect(meta.author).toBeUndefined();
    expect(meta.authorUrl).toBe("https://social.example/jane");
    expect(meta.publishedAt).toBe("2022-09-01T08:00:00Z");
  });
});

describe("parseYoutubeWatch", () => {
  it("reads the full description and the publish date", () => {
    const html = `<meta itemprop="datePublished" content="2024-01-02T03:04:05-08:00">
      <script>var x = {"videoDetails":{"shortDescription":"Made in Blender \\u0026 Houdini.\\nMusic: \\"Song\\"","isLive":false}};</script>`;
    expect(parseYoutubeWatch(html)).toEqual({
      description: 'Made in Blender & Houdini.\nMusic: "Song"',
      publishedAt: "2024-01-02T03:04:05-08:00",
    });
    expect(parseYoutubeWatch("<html></html>")).toEqual({ description: undefined, publishedAt: undefined });
  });
});

describe("items with credits and notes", () => {
  it("an agent's credits and first note ride along with its pick", async () => {
    const { item } = await buildItem("p", "https://www.behance.net/gallery/1/x", {
      addedBy: "agent",
      agentName: "Codex",
      credits: { creator: " Jane ", creatorUrl: "javascript:alert(1)", publishedAt: "2023-05", tools: ["c4d"], process: "Sculpted, then lit." },
      note: "The making-of video is worth a watch.",
    });
    expect(item).toMatchObject({
      authorName: "Jane",
      authorUrl: null,
      publishedAt: "2023-05",
      tools: ["Cinema 4D"],
      process: "Sculpted, then lit.",
    });
    expect(item.notes).toHaveLength(1);
    expect(item.notes?.[0]).toMatchObject({ by: "agent", name: "Codex", text: "The making-of video is worth a watch." });
  });
  it("updates only touch the credits they name, and null clears one", () => {
    expect(creditFields({ tools: ["blender"] })).toEqual({ tools: ["Blender"] });
    expect(creditFields({ creator: null, process: undefined })).toEqual({ authorName: null });
  });
  it("blank notes are dropped; user notes carry no agent name", () => {
    expect(makeNote("user", "   ")).toBeNull();
    expect(makeNote("user", "hi", "Codex")).toMatchObject({ by: "user", name: null, text: "hi" });
  });
});

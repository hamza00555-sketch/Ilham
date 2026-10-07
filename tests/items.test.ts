import { describe, expect, it } from "vitest";
import { buildItem, cleanHints, cleanTags, isWebUrl } from "@/shared/items";

describe("buildItem", () => {
  it("agent picks land in the inbox with their reason, tags and run", async () => {
    const { id, item } = await buildItem("proj1", "https://youtu.be/dQw4w9WgXcQ?si=abc", {
      addedBy: "agent",
      tags: ["Type:UI", "type:ui", " mood dark "],
      reason: "  Fits the brief.  ",
      agentRunId: "run1",
    });
    expect(id).toMatch(/^proj1__[a-f0-9]{64}$/);
    expect(item).toMatchObject({
      status: "inbox",
      addedBy: "agent",
      ingest: "queued",
      platform: "youtube",
      tags: ["type:ui", "mood-dark"],
      reason: "Fits the brief.",
      agentRunId: "run1",
    });
  });

  it("your own adds are kept, and the same work gets the same id however it's linked", async () => {
    const a = await buildItem("p", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=x");
    const b = await buildItem("p", "https://youtu.be/dQw4w9WgXcQ");
    expect(a.item.status).toBe("kept");
    expect(a.id).toBe(b.id);
  });
});

describe("cleanTags / cleanHints / isWebUrl", () => {
  it("caps tags at 12 and drops junk", () => {
    expect(cleanTags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(12);
    expect(cleanTags(["", 5 as unknown as string, "ok"])).toEqual(["ok"]);
    expect(cleanTags(undefined)).toEqual([]);
  });
  it("keeps only http(s) hints", () => {
    expect(cleanHints({ imageUrl: "javascript:alert(1)", videoUrl: "https://v.mp4", title: " T " })).toEqual({
      videoUrl: "https://v.mp4",
      title: "T",
    });
    expect(cleanHints({})).toBeNull();
  });
  it("accepts web pages only", () => {
    expect(isWebUrl("https://dribbble.com/shots/1")).toBe(true);
    expect(isWebUrl("ftp://x.com")).toBe(false);
    expect(isWebUrl("not a url")).toBe(false);
  });
});

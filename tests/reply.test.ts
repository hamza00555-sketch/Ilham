import { describe, expect, it } from "vitest";
import { buildReplyMessages } from "@/server/agent/reply";
import type { Item, ItemNote } from "@/shared/types";

const note = (by: ItemNote["by"], text: string, name: string | null = null): ItemNote => ({ id: text, by, name, text, at: "2026-10-08T00:00:00Z" });

const item = (extra: Partial<Item>) =>
  ({
    sourceUrl: "https://vimeo.com/22439234",
    platform: "vimeo",
    mediaType: "video",
    title: "The Mountain",
    authorName: "TSO Photography",
    authorUrl: "https://vimeo.com/terjes",
    tools: ["Lightroom"],
    tags: ["type:timelapse"],
    preview: { w1280: "https://blob.example/1280.webp" },
    notes: [],
    ...extra,
  }) as unknown as Item;

describe("buildReplyMessages", () => {
  it("opens with the work and its image, then turns notes into the conversation", () => {
    const messages = buildReplyMessages({
      item: item({ notes: [note("agent", "Night pacing fits the intro.", "Codex"), note("user", "وش العدسة؟")] }),
      project: { name: "VR Onboarding", brief: { mood: "calm" } },
    });
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    const opening = messages[0].content as { type: string; text?: string; source?: { url: string } }[];
    expect(opening[0]).toMatchObject({ type: "image", source: { url: "https://blob.example/1280.webp" } });
    expect(opening[1].text).toContain("Creator: TSO Photography (https://vimeo.com/terjes)");
    expect(opening[1].text).toContain('Project: VR Onboarding — brief: {"mood":"calm"}');
    expect(messages[1].content).toBe("[Codex] Night pacing fits the intro.");
    expect(messages.at(-1)).toEqual({ role: "user", content: "وش العدسة؟" });
  });

  it("leaves out images the API can't reach and keeps its own notes unsigned", () => {
    const messages = buildReplyMessages({
      item: item({ preview: { w1280: "http://localhost:3000/api/dev-blob/x.webp" } as Item["preview"], notes: [note("user", "hi"), note("agent", "hello", "Claude"), note("user", "more")] }),
      project: null,
    });
    const opening = messages[0].content as { type: string }[];
    expect(opening.map((b) => b.type)).toEqual(["text"]);
    expect(messages[2].content).toBe("hello");
  });
});

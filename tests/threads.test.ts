import { describe, expect, it } from "vitest";
import { parseThreadLink, threadInvite } from "@/shared/threads";

const ID = `motion-studies__${"a".repeat(64)}`;

describe("parseThreadLink", () => {
  it("reads the project and reference from a sheet link", () => {
    expect(parseThreadLink(`https://ilham.app/p/motion-studies?ref=${ID}`)).toEqual({ project: "motion-studies", id: ID });
    expect(parseThreadLink(`  http://localhost:3000/p/motion-studies/?ref=${ID}&x=1 `)).toEqual({
      project: "motion-studies",
      id: ID,
    });
  });

  it("decodes Arabic project slugs", () => {
    const slug = encodeURIComponent("حركة");
    expect(parseThreadLink(`https://ilham.app/p/${slug}?ref=${ID}`)?.project).toBe("حركة");
  });

  it("rejects anything that is not a reference link", () => {
    expect(parseThreadLink("not a url")).toBeNull();
    expect(parseThreadLink(`https://ilham.app/p/motion-studies`)).toBeNull();
    expect(parseThreadLink(`https://ilham.app/settings?ref=${ID}`)).toBeNull();
    expect(parseThreadLink(`https://ilham.app/p/motion-studies?ref=../../users`)).toBeNull();
    expect(parseThreadLink(`https://ilham.app/p/a/b?ref=${ID}`)).toBeNull();
  });
});

describe("threadInvite", () => {
  it("names the link and the tools any agent needs", () => {
    const link = `https://ilham.app/p/motion-studies?ref=${ID}`;
    const invite = threadInvite(link);
    expect(invite).toContain(link);
    for (const tool of ["open_thread", "add_note", "wait_for_reply"]) expect(invite).toContain(tool);
    expect(invite).not.toMatch(/codex|chatgpt|grok/i);
  });
});

import { describe, expect, it } from "vitest";
import { slugify } from "@/shared/slug";

describe("slugify", () => {
  it("makes ASCII slugs", () => {
    expect(slugify("  VR Onboarding — Concept! ")).toBe("vr-onboarding-concept");
    expect(slugify("Café Brand")).toBe("cafe-brand");
  });
  it("falls back to a random slug for Arabic-only names", () => {
    expect(slugify("هوية مقهى")).toMatch(/^p-[a-z2-9]{6}$/);
  });
});

import "server-only";
import { z } from "zod";
import { HttpError } from "../auth";
import { MAX_BATCH } from "./service";

// One source of truth for what agents may send, used by REST v1 and the MCP tools.

const brief = z.record(z.string(), z.unknown());

export const createProjectInput = z.object({
  name: z.string().min(1).max(80).describe("Project name, e.g. \"VR Onboarding\"."),
  description: z.string().max(280).optional().describe("One line about the project."),
  brief: brief.optional().describe("What to look for: goal, mood, keywords, sources, exclude, quota."),
});

// Credits: who made a piece, when, with what, and how. Agents research these; the page's own
// credits win where the server can read them.
const credits = {
  creator: z.string().max(120).describe("Who made it: the artist's or studio's name."),
  creatorUrl: z.string().max(2000).describe("Their portfolio or profile page (Behance, ArtStation, Instagram, personal site)."),
  publishedAt: z.string().max(40).describe("When it was published: YYYY-MM-DD, YYYY-MM or YYYY."),
  tools: z.array(z.string().max(40)).max(12).describe("Software used, as the creator names it: Blender, Cinema 4D, After Effects, Unreal Engine, Figma…"),
  process: z
    .string()
    .max(1500)
    .describe("How it was made, in 1-3 sentences: technique, pipeline, making-of. Only what the creator or a reliable source says."),
};

export const agentItem = z.object({
  url: z.string().max(2000).describe("The original work's page (the creator's own page, not an aggregator)."),
  imageUrl: z.string().max(2000).optional().describe("Direct high-res image URL, if you have it (helps on sites that block servers, like Dribbble)."),
  videoUrl: z.string().max(2000).optional().describe("Direct mp4/webm URL for a short loop, if the work is motion."),
  title: z.string().max(200).optional(),
  tags: z.array(z.string().max(40)).max(12).optional().describe("Namespaced tags like type:ui, style:glass, mood:dark."),
  reason: z.string().max(400).optional().describe("One sentence: why this fits the brief. Shown to the user in the Inbox."),
  creator: credits.creator.optional(),
  creatorUrl: credits.creatorUrl.optional(),
  publishedAt: credits.publishedAt.optional(),
  tools: credits.tools.optional(),
  process: credits.process.optional(),
  note: z.string().max(2000).optional().describe("Anything else worth telling the user about this piece. Shown as your note on it."),
});

export const addItemsInput = z.object({
  items: z.array(agentItem).min(1).max(MAX_BATCH),
  agentRunId: z.string().max(64).optional(),
});

export const updateItemInput = z.object({
  status: z.enum(["inbox", "kept", "discarded"]).optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
  creator: credits.creator.nullable().optional(),
  creatorUrl: credits.creatorUrl.nullable().optional(),
  publishedAt: credits.publishedAt.nullable().optional(),
  tools: credits.tools.optional(),
  process: credits.process.nullable().optional(),
});

export const addNoteInput = z.object({
  text: z.string().min(1).max(2000).describe("Your note to the user about this reference. Plain text, their language."),
});

export const startRunInput = z.object({
  project: z.string().min(1).max(64).describe("Project slug."),
  query: z.string().min(1).max(1000).describe("Your search plan for this run."),
});

export const finishRunInput = z.object({
  summary: z.string().max(2000).optional(),
  status: z.enum(["done", "failed"]).optional(),
});

/** Parses a JSON body against a schema, or throws a 400 that names the bad fields. */
export async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const body = await request.json().catch(() => {
    throw new HttpError(400, "invalid-json");
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".") || "body").join(", ");
    throw new HttpError(400, `invalid-input: ${fields}`);
  }
  return parsed.data;
}

export const originOf = (request: Request) => new URL(request.url).origin;

const ITEM_ID = /^[\w-]{1,64}__[a-f0-9]{64}$/;

/** The slug and item id of /api/v1/projects/[slug]/items/[id] routes, with the id checked. */
export async function itemParams(ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  if (!ITEM_ID.test(id)) throw new HttpError(400, "invalid-item");
  return { slug, id };
}

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

export const agentItem = z.object({
  url: z.string().max(2000).describe("The original work's page (the creator's own page, not an aggregator)."),
  imageUrl: z.string().max(2000).optional().describe("Direct high-res image URL, if you have it (helps on sites that block servers, like Dribbble)."),
  videoUrl: z.string().max(2000).optional().describe("Direct mp4/webm URL for a short loop, if the work is motion."),
  title: z.string().max(200).optional(),
  tags: z.array(z.string().max(40)).max(12).optional().describe("Namespaced tags like type:ui, style:glass, mood:dark."),
  reason: z.string().max(400).optional().describe("One sentence: why this fits the brief. Shown to the user in the Inbox."),
});

export const addItemsInput = z.object({
  items: z.array(agentItem).min(1).max(MAX_BATCH),
  agentRunId: z.string().max(64).optional(),
});

export const updateItemInput = z.object({
  status: z.enum(["inbox", "kept", "discarded"]).optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
  note: z.string().max(1000).nullable().optional(),
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

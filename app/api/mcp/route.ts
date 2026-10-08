import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { resolveKey } from "@/server/agent/keys";
import {
  addItemsInput,
  addNoteInput,
  createProjectInput,
  finishRunInput,
  startRunInput,
  updateItemInput,
} from "@/server/agent/schemas";
import {
  addItems,
  addNote,
  createProject,
  finishRun,
  getItem,
  getProject,
  getTaste,
  listProjects,
  startRun,
  updateItem,
} from "@/server/agent/service";
import { HttpError } from "@/server/auth";

// Same as REST v1, as MCP tools. Connect with the URL of this route and
// `Authorization: Bearer ilham_sk_…` (Settings → الوكلاء).
export const maxDuration = 300;

const slug = z.string().min(1).max(64).describe("Project slug, from list_projects.");
const itemId = z.string().min(1).max(140).describe("Item id, from get_project, list results or add_inspiration.");

type Ctx = { http?: { authInfo?: { extra?: Record<string, unknown> } } };
const uidOf = (ctx: Ctx) => ctx.http?.authInfo?.extra?.uid as string;
const originOf = (ctx: Ctx) => ctx.http?.authInfo?.extra?.origin as string;
const agentNameOf = (ctx: Ctx) => (ctx.http?.authInfo?.extra?.agentName as string | undefined) ?? null;

/** Tool results as JSON text; failures as tool errors the agent can read and recover from. */
async function run(work: () => Promise<unknown>) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(await work(), null, 2) }] };
  } catch (err) {
    const message = err instanceof HttpError ? err.code : "internal-error";
    if (!(err instanceof HttpError)) console.error("mcp tool failed", err);
    return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
  }
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_projects",
      {
        title: "List projects",
        description: "All of the user's Ilham projects with their slug, brief, counts and review (whether your picks wait in the Inbox). Start here.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async (_args, ctx) => run(() => listProjects(uidOf(ctx), originOf(ctx))),
    );

    server.registerTool(
      "get_project",
      {
        title: "Get project",
        description:
          "A project's brief (goal, mood, keywords, sources, exclude, quota), recent keeps, and knownUrls already in it. Read before searching so you don't suggest duplicates.",
        inputSchema: z.object({ project: slug }),
        annotations: { readOnlyHint: true },
      },
      async ({ project }, ctx) => run(() => getProject(uidOf(ctx), originOf(ctx), project)),
    );

    server.registerTool(
      "get_taste",
      {
        title: "Get taste",
        description: "What the user kept vs. discarded recently in a project, with the most common tags of each. Use it to match their taste.",
        inputSchema: z.object({ project: slug }),
        annotations: { readOnlyHint: true },
      },
      async ({ project }, ctx) => run(() => getTaste(uidOf(ctx), project)),
    );

    server.registerTool(
      "create_project",
      {
        title: "Create project",
        description: "Creates a new project. Only when the user asks for one.",
        inputSchema: createProjectInput,
      },
      async (input, ctx) => run(() => createProject(uidOf(ctx), originOf(ctx), input)),
    );

    server.registerTool(
      "add_inspiration",
      {
        title: "Add inspiration",
        description:
          "Adds up to 50 references to a project in one batch. They wait in the project's Inbox for the user to keep or discard, unless the user turned review off for it (the project's `review` is false); then they join the project directly, still marked as yours. Send the creator's original page as url, plus imageUrl when you have a direct high-res image, 3-5 namespaced tags, and a one-sentence reason tied to the brief. Include the credits you found: creator, creatorUrl (their portfolio), publishedAt, tools (software used) and process (how it was made). Duplicates are skipped automatically.",
        inputSchema: addItemsInput.extend({ project: slug }),
      },
      async ({ project, items, agentRunId }, ctx) =>
        run(() => addItems(uidOf(ctx), project, items, agentRunId, agentNameOf(ctx))),
    );

    server.registerTool(
      "get_item",
      {
        title: "Get item",
        description:
          "One reference in full: its credits (creator, creatorUrl, publishedAt, tools, process), the creator's own description, and the notes on it, including the user's replies to you.",
        inputSchema: z.object({ project: slug, id: itemId }),
        annotations: { readOnlyHint: true },
      },
      async ({ project, id }, ctx) => run(() => getItem(uidOf(ctx), originOf(ctx), project, id)),
    );

    server.registerTool(
      "update_item",
      {
        title: "Update item",
        description:
          "Changes an item's status (inbox / kept / discarded) or tags, or fills in its credits after researching it: creator, creatorUrl (portfolio), publishedAt, tools (software) and process (how it was made). Pass null to clear a credit.",
        inputSchema: updateItemInput.extend({ project: slug, id: itemId }),
      },
      async ({ project, id, ...patch }, ctx) => run(() => updateItem(uidOf(ctx), project, id, patch)),
    );

    server.registerTool(
      "add_note",
      {
        title: "Add note",
        description:
          "Leaves a note for the user on one reference: something worth knowing about it, a question, or an answer to their note. Shown on the reference with your name.",
        inputSchema: addNoteInput.extend({ project: slug, id: itemId }),
      },
      async ({ project, id, text }, ctx) => run(() => addNote(uidOf(ctx), project, id, text, agentNameOf(ctx))),
    );

    server.registerTool(
      "start_run",
      {
        title: "Start run",
        description: "Opens a search session for a project. Pass the returned runId as agentRunId to add_inspiration.",
        inputSchema: startRunInput,
      },
      async ({ project, query }, ctx) => run(() => startRun(uidOf(ctx), project, query)),
    );

    server.registerTool(
      "finish_run",
      {
        title: "Finish run",
        description: "Closes a search session with a 1-2 line summary of what you added and why.",
        inputSchema: finishRunInput.extend({ runId: z.string().min(1).max(64) }),
      },
      async ({ runId, ...rest }, ctx) => run(() => finishRun(uidOf(ctx), runId, rest)),
    );
  },
  { serverInfo: { name: "ilham", version: "1.0.0" } },
);

const authed = withMcpAuth(
  handler,
  async (request, token) => {
    const owner = await resolveKey(token);
    if (!owner) return undefined;
    return {
      token: token!,
      clientId: owner.keyId,
      scopes: ["read", "write"],
      extra: { uid: owner.uid, origin: new URL(request.url).origin, agentName: owner.name },
    };
  },
  { required: true },
);

export { authed as DELETE, authed as GET, authed as POST };

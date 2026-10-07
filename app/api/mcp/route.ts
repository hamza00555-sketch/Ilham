import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { resolveKey } from "@/server/agent/keys";
import { addItemsInput, createProjectInput, finishRunInput, startRunInput, updateItemInput } from "@/server/agent/schemas";
import {
  addItems,
  createProject,
  finishRun,
  getProject,
  getTaste,
  listProjects,
  startRun,
  updateItem,
} from "@/server/agent/service";
import { HttpError } from "@/server/auth";

// Same as REST v1, as MCP tools. Connect with the URL of this route and
// `Authorization: Bearer ilham_sk_…` (Settings → مفاتيح الوكلاء).
export const maxDuration = 300;

const slug = z.string().min(1).max(64).describe("Project slug, from list_projects.");

type Ctx = { http?: { authInfo?: { extra?: Record<string, unknown> } } };
const uidOf = (ctx: Ctx) => ctx.http?.authInfo?.extra?.uid as string;
const originOf = (ctx: Ctx) => ctx.http?.authInfo?.extra?.origin as string;

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
        description: "All of the user's Ilham projects with their slug, brief and counts. Start here.",
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
          "Adds up to 50 references to a project's Inbox in one batch; the user keeps or discards them. Send the creator's original page as url, plus imageUrl when you have a direct high-res image, 3-5 namespaced tags, and a one-sentence reason tied to the brief. Duplicates are skipped automatically.",
        inputSchema: addItemsInput.extend({ project: slug }),
      },
      async ({ project, items, agentRunId }, ctx) => run(() => addItems(uidOf(ctx), project, items, agentRunId)),
    );

    server.registerTool(
      "update_item",
      {
        title: "Update item",
        description: "Changes an item's status (inbox / kept / discarded), tags or note. Item ids come from get_project or add_inspiration.",
        inputSchema: updateItemInput.extend({ project: slug, id: z.string().min(1).max(140) }),
      },
      async ({ project, id, ...patch }, ctx) => run(() => updateItem(uidOf(ctx), project, id, patch)),
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
      extra: { uid: owner.uid, origin: new URL(request.url).origin },
    };
  },
  { required: true },
);

export { authed as DELETE, authed as GET, authed as POST };

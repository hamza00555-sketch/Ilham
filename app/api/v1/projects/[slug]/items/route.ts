import { requireAgent } from "@/server/agent/keys";
import { addItemsInput, readBody } from "@/server/agent/schemas";
import { addItems, listItems } from "@/server/agent/service";
import { errorResponse, HttpError } from "@/server/auth";
import type { ItemStatus } from "@/shared/types";

// Picks are processed after the response, a few at a time; a full batch of 50 fits comfortably.
export const maxDuration = 300;

const STATUSES: ItemStatus[] = ["kept", "inbox", "discarded"];

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { uid } = await requireAgent(request);
    const { slug } = await ctx.params;
    const params = new URL(request.url).searchParams;
    const status = (params.get("status") ?? "kept") as ItemStatus;
    if (!STATUSES.includes(status)) throw new HttpError(400, "invalid-status");
    return Response.json({ items: await listItems(uid, slug, status, Number(params.get("limit") ?? 50)) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Adds up to 50 picks to the project's Inbox. 202: previews are still being made. */
export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { uid } = await requireAgent(request);
    const { slug } = await ctx.params;
    const { items, agentRunId } = await readBody(request, addItemsInput);
    return Response.json(await addItems(uid, slug, items, agentRunId), { status: 202 });
  } catch (err) {
    return errorResponse(err);
  }
}

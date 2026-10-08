import { after } from "next/server";
import { replyConfigured, replyToNotes } from "@/server/agent/reply";
import { errorResponse, HttpError, requireUser } from "@/server/auth";

// Claude answers your latest note on a reference. The reply is written after the response; the
// sheet follows it live (agentReply → the new note).
export const maxDuration = 300;

const ITEM_ID = /^[\w-]{1,64}__[a-f0-9]{64}$/;

/** Whether replies are switched on for this deployment (ANTHROPIC_API_KEY is set). */
export async function GET(request: Request) {
  try {
    await requireUser(request);
    return Response.json({ configured: replyConfigured() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const { itemId } = (await request.json().catch(() => ({}))) as { itemId?: unknown };
    if (typeof itemId !== "string" || !ITEM_ID.test(itemId)) throw new HttpError(400, "invalid-item");
    if (!replyConfigured()) throw new HttpError(503, "agent-not-configured");
    after(() => replyToNotes(uid, itemId));
    return Response.json({ status: "queued" }, { status: 202 });
  } catch (err) {
    return errorResponse(err);
  }
}

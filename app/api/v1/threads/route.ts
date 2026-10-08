import { connection } from "next/server";
import { requireAgent } from "@/server/agent/keys";
import { originOf } from "@/server/agent/schemas";
import { listWaitingThreads, openThread } from "@/server/agent/service";
import { errorResponse } from "@/server/auth";

/**
 * GET /api/v1/threads: references whose latest note is the user's, unanswered.
 * GET /api/v1/threads?link=<reference link>: that one thread, with its notes.
 */
export async function GET(request: Request) {
  // Per request, never prerendered: keeps the build from running this handler at all.
  await connection();
  try {
    const { uid } = await requireAgent(request);
    const link = new URL(request.url).searchParams.get("link");
    if (link) return Response.json(await openThread(uid, originOf(request), link));
    return Response.json({ threads: await listWaitingThreads(uid, originOf(request)) });
  } catch (err) {
    return errorResponse(err);
  }
}

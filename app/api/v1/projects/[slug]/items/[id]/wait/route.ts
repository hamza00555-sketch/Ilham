import { requireAgent } from "@/server/agent/keys";
import { itemParams } from "@/server/agent/schemas";
import { waitForReply } from "@/server/agent/service";
import { errorResponse } from "@/server/auth";

// Long-poll for the user's next note on a thread: ?after=<note id>&timeout=<seconds, max 240>.
export const maxDuration = 300;

export async function GET(request: Request, ctx: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { uid } = await requireAgent(request);
    const { slug, id } = await itemParams(ctx);
    const params = new URL(request.url).searchParams;
    const timeout = Number(params.get("timeout") ?? 50);
    return Response.json(
      await waitForReply(uid, slug, id, params.get("after") ?? undefined, Number.isFinite(timeout) ? timeout : 50),
    );
  } catch (err) {
    return errorResponse(err);
  }
}

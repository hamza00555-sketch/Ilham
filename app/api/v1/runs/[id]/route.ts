import { requireAgent } from "@/server/agent/keys";
import { finishRunInput, readBody } from "@/server/agent/schemas";
import { finishRun } from "@/server/agent/service";
import { errorResponse, HttpError } from "@/server/auth";

/** Closes a run with a short summary. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireAgent(request);
    const { id } = await ctx.params;
    if (!/^[\w-]{1,64}$/.test(id)) throw new HttpError(400, "invalid-run");
    return Response.json(await finishRun(uid, id, await readBody(request, finishRunInput)));
  } catch (err) {
    return errorResponse(err);
  }
}

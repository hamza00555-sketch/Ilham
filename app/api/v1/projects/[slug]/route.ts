import { requireAgent } from "@/server/agent/keys";
import { originOf } from "@/server/agent/schemas";
import { getProject } from "@/server/agent/service";
import { errorResponse } from "@/server/auth";

/** The project, its brief, recent keeps, and every URL already in it (kept, inbox or discarded). */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { uid } = await requireAgent(request);
    const { slug } = await ctx.params;
    return Response.json(await getProject(uid, originOf(request), slug));
  } catch (err) {
    return errorResponse(err);
  }
}

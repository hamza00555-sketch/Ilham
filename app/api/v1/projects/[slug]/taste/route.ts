import { requireAgent } from "@/server/agent/keys";
import { getTaste } from "@/server/agent/service";
import { errorResponse } from "@/server/auth";

/** What you kept vs. discarded recently, and which tags win. Read it before searching. */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { uid } = await requireAgent(request);
    const { slug } = await ctx.params;
    return Response.json(await getTaste(uid, slug));
  } catch (err) {
    return errorResponse(err);
  }
}

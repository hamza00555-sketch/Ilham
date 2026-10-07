import { requireAgent } from "@/server/agent/keys";
import { readBody, updateItemInput } from "@/server/agent/schemas";
import { updateItem } from "@/server/agent/service";
import { errorResponse, HttpError } from "@/server/auth";

export async function PATCH(request: Request, ctx: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { uid } = await requireAgent(request);
    const { slug, id } = await ctx.params;
    if (!/^[\w-]{1,64}__[a-f0-9]{64}$/.test(id)) throw new HttpError(400, "invalid-item");
    return Response.json(await updateItem(uid, slug, id, await readBody(request, updateItemInput)));
  } catch (err) {
    return errorResponse(err);
  }
}

import { requireAgent } from "@/server/agent/keys";
import { itemParams, originOf, readBody, updateItemInput } from "@/server/agent/schemas";
import { getItem, updateItem } from "@/server/agent/service";
import { errorResponse } from "@/server/auth";

type Params = { params: Promise<{ slug: string; id: string }> };

/** One reference with its credits, the creator's description and the notes on it. */
export async function GET(request: Request, ctx: Params) {
  try {
    const { uid } = await requireAgent(request);
    const { slug, id } = await itemParams(ctx);
    return Response.json(await getItem(uid, originOf(request), slug, id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request, ctx: Params) {
  try {
    const { uid } = await requireAgent(request);
    const { slug, id } = await itemParams(ctx);
    return Response.json(await updateItem(uid, slug, id, await readBody(request, updateItemInput)));
  } catch (err) {
    return errorResponse(err);
  }
}

import { revokeKey } from "@/server/agent/keys";
import { errorResponse, HttpError, requireUser } from "@/server/auth";

/** Revokes a key immediately: the next agent request with it gets 401. */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireUser(request);
    const { id } = await ctx.params;
    if (!/^[a-f0-9]{64}$/.test(id)) throw new HttpError(400, "invalid-key-id");
    await revokeKey(uid, id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

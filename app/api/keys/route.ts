import { createKey, listKeys } from "@/server/agent/keys";
import { errorResponse, requireUser } from "@/server/auth";

/** Your agent keys (metadata only). */
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json({ keys: await listKeys(uid) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** A new key. The plaintext is in this response and nowhere else, ever. */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const { name } = (await request.json().catch(() => ({}))) as { name?: unknown };
    const created = await createKey(uid, typeof name === "string" ? name : "");
    return Response.json(created, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

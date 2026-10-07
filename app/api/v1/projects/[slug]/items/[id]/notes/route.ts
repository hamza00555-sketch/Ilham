import { requireAgent } from "@/server/agent/keys";
import { addNoteInput, itemParams, readBody } from "@/server/agent/schemas";
import { addNote } from "@/server/agent/service";
import { errorResponse } from "@/server/auth";

/** Leaves a note for the user on one reference, signed with the key's name. */
export async function POST(request: Request, ctx: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { uid, name } = await requireAgent(request);
    const { slug, id } = await itemParams(ctx);
    const { text } = await readBody(request, addNoteInput);
    return Response.json(await addNote(uid, slug, id, text, name), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

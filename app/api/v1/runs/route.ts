import { requireAgent } from "@/server/agent/keys";
import { readBody, startRunInput } from "@/server/agent/schemas";
import { startRun } from "@/server/agent/service";
import { errorResponse } from "@/server/auth";

/** Opens a run (one search session); pass its runId as agentRunId when adding items. */
export async function POST(request: Request) {
  try {
    const { uid } = await requireAgent(request);
    const { project, query } = await readBody(request, startRunInput);
    return Response.json(await startRun(uid, project, query), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

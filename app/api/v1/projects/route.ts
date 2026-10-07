import { requireAgent } from "@/server/agent/keys";
import { createProjectInput, originOf, readBody } from "@/server/agent/schemas";
import { createProject, listProjects } from "@/server/agent/service";
import { errorResponse } from "@/server/auth";

/** Your projects with their briefs and counts. */
export async function GET(request: Request) {
  try {
    const { uid } = await requireAgent(request);
    return Response.json({ projects: await listProjects(uid, originOf(request)) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireAgent(request);
    const input = await readBody(request, createProjectInput);
    return Response.json(await createProject(uid, originOf(request), input), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

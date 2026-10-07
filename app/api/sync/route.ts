import { errorResponse, HttpError, requireUser } from "@/server/auth";
import { syncProjects } from "@/server/stats";

const PROJECT_ID = /^[\w-]{1,64}$/;

/** Refreshes counts and covers after the browser deletes, restores or moves items. */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const { projectIds } = (await request.json().catch(() => ({}))) as { projectIds?: unknown };
    if (
      !Array.isArray(projectIds) ||
      projectIds.length === 0 ||
      projectIds.length > 4 ||
      !projectIds.every((id) => typeof id === "string" && PROJECT_ID.test(id))
    ) {
      throw new HttpError(400, "invalid-projects");
    }
    await syncProjects(uid, projectIds as string[]);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

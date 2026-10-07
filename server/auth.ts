import "server-only";
import { admin } from "./firebase-admin";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/**
 * The signed-in person behind a request, from the Firebase ID token in `Authorization: Bearer`.
 * ILHAM_ALLOWED_EMAILS (comma-separated) keeps the server's fetch budget for the people you name.
 */
export async function requireUser(request: Request): Promise<{ uid: string; email: string | null }> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "unauthenticated");

  // Outside the try: a broken FIREBASE_SERVICE_ACCOUNT is a server error (logged, 500), not a bad token.
  const { auth } = admin();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    throw new HttpError(401, "unauthenticated");
  }

  const allowed = process.env.ILHAM_ALLOWED_EMAILS?.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = decoded.email?.toLowerCase() ?? null;
  if (allowed?.length && (!email || !allowed.includes(email))) throw new HttpError(403, "not-allowed");

  return { uid: decoded.uid, email };
}

/** Turns thrown errors into JSON responses; anything unexpected is logged and becomes a 500. */
export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return Response.json({ error: err.code }, { status: err.status });
  console.error(err);
  return Response.json({ error: "internal" }, { status: 500 });
}

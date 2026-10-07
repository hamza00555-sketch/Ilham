"use client";

import { firebase } from "./firebase/client";

/**
 * Calls one of our route handlers as the signed-in person. POSTs `body` (JSON or FormData) unless
 * another method is given. Throws `{ code }` like the SDKs do.
 */
export async function callApi<T = unknown>(
  path: string,
  body?: FormData | Record<string, unknown>,
  { method = body ? "POST" : "GET" }: { method?: "GET" | "POST" | "DELETE" } = {},
): Promise<T> {
  const token = await firebase().auth.currentUser?.getIdToken();
  if (!token) throw Object.assign(new Error("unauthenticated"), { code: "unauthenticated" });

  const isForm = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body && !isForm ? { "content-type": "application/json" } : {}) },
      body: !body ? undefined : isForm ? body : JSON.stringify(body),
      // Small JSON requests still go out if the page closes right after (the /add popup does).
      keepalive: method === "POST" && !isForm,
      cache: "no-store",
    });
  } catch {
    throw Object.assign(new Error("network"), { code: "network-request-failed" });
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(json.error ?? "internal"), { code: json.error ?? "internal" });
  return json;
}

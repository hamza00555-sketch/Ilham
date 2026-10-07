"use client";

import { firebase } from "./firebase/client";

/** POSTs to one of our route handlers as the signed-in person. Throws `{ code }` like the SDKs do. */
export async function callApi<T = unknown>(path: string, body: FormData | Record<string, unknown>): Promise<T> {
  const token = await firebase().auth.currentUser?.getIdToken();
  if (!token) throw Object.assign(new Error("unauthenticated"), { code: "unauthenticated" });

  const isForm = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, ...(isForm ? {} : { "content-type": "application/json" }) },
      body: isForm ? body : JSON.stringify(body),
      // Small JSON requests still go out if the page closes right after (the /add popup does).
      keepalive: !isForm,
    });
  } catch {
    throw Object.assign(new Error("network"), { code: "network-request-failed" });
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(json.error ?? "internal"), { code: json.error ?? "internal" });
  return json;
}

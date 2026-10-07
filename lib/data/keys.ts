"use client";

import { callApi } from "../api";

/** Mirrors server/agent/keys.ts ApiKeyInfo. Keys live server-side only; the browser never lists the secret. */
export interface ApiKeyInfo {
  id: string;
  name: string;
  preview: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

export const listKeys = () => callApi<{ keys: ApiKeyInfo[] }>("/api/keys").then((r) => r.keys);

export const createKey = (name: string) => callApi<{ key: string; info: ApiKeyInfo }>("/api/keys", { name });

export const revokeKey = (id: string) => callApi(`/api/keys/${id}`, undefined, { method: "DELETE" });

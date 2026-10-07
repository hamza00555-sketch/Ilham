import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { HttpError } from "../auth";
import { admin } from "../firebase-admin";

/**
 * Agent API keys. The key itself is shown once and never stored: apiKeys/{sha256(key)} holds the
 * owner and metadata, so one read of the hash answers "whose key is this". Keys are server-only
 * (firestore.rules deny clients).
 */
const PREFIX = "ilham_sk_";
const MAX_KEYS = 10;

export interface ApiKeyInfo {
  id: string;
  name: string;
  /** First characters, enough to recognize a key in the list. */
  preview: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

const hash = (key: string) => createHash("sha256").update(key).digest("hex");
const iso = (t: unknown) => (t as Timestamp | undefined)?.toDate?.().toISOString() ?? null;

export async function createKey(uid: string, name: string): Promise<{ key: string; info: ApiKeyInfo }> {
  const { db } = admin();
  const existing = await db.collection("apiKeys").where("ownerId", "==", uid).count().get();
  if (existing.data().count >= MAX_KEYS) throw new HttpError(409, "too-many-keys");

  const key = PREFIX + randomBytes(24).toString("base64url");
  const id = hash(key);
  const clean = name.trim().slice(0, 40) || "Agent";
  await db.doc(`apiKeys/${id}`).create({
    ownerId: uid,
    name: clean,
    preview: key.slice(0, PREFIX.length + 4),
    scopes: ["read", "write"],
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
  });
  return { key, info: { id, name: clean, preview: key.slice(0, PREFIX.length + 4), createdAt: new Date().toISOString(), lastUsedAt: null } };
}

export async function listKeys(uid: string): Promise<ApiKeyInfo[]> {
  const snap = await admin().db.collection("apiKeys").where("ownerId", "==", uid).get();
  return snap.docs
    .map((d) => ({
      id: d.id,
      name: d.get("name") as string,
      preview: d.get("preview") as string,
      createdAt: iso(d.get("createdAt")),
      lastUsedAt: iso(d.get("lastUsedAt")),
    }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function revokeKey(uid: string, id: string) {
  const ref = admin().db.doc(`apiKeys/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get("ownerId") !== uid) throw new HttpError(404, "not-found");
  await ref.delete();
}

/** The owner behind an `ilham_sk_…` key, or null. Touches lastUsedAt at most once a minute. */
export interface KeyOwner {
  uid: string;
  keyId: string;
  /** The key's name ("Codex"…), shown on the agent's notes. */
  name: string;
}

export async function resolveKey(key: string | undefined | null): Promise<KeyOwner | null> {
  if (!key?.startsWith(PREFIX) || key.length > 80) return null;
  const id = hash(key);
  const ref = admin().db.doc(`apiKeys/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const last = (snap.get("lastUsedAt") as Timestamp | null)?.toMillis() ?? 0;
  if (Date.now() - last > 60_000) void ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
  return { uid: snap.get("ownerId") as string, keyId: id, name: (snap.get("name") as string | undefined) ?? "Agent" };
}

/** For REST v1: `Authorization: Bearer ilham_sk_…`. */
export async function requireAgent(request: Request): Promise<KeyOwner> {
  const key = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1]?.trim();
  const owner = await resolveKey(key);
  if (!owner) throw new HttpError(401, "invalid-key");
  return owner;
}

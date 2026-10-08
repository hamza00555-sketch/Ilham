import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { makeNote, MAX_NOTES } from "@/shared/items";
import type { Item, ItemNote, Project } from "@/shared/types";
import { admin } from "../firebase-admin";

// The per-reference chat: when you write a note on a reference, Claude answers in the same thread,
// knowing the work (its credits, the creator's words, the preview itself) and everything said
// about it so far. Needs ANTHROPIC_API_KEY on the server.

const MODEL = "claude-opus-5-5";
export const REPLY_AGENT_NAME = "Claude";
/** A reply still "thinking" after this long was abandoned (the function died), so it can be retried. */
const STALE_MS = 3 * 60_000;
const HISTORY = 30;
const MAX_CONTINUATIONS = 3;

export const replyConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const SYSTEM = `You are the research partner inside Ilham, a private board of visual references kept by a creative director who designs immersive experiences (AR/VR, motion, 3D, branding).

Each conversation is about one reference: a video, shot, or project the user saved. The first message describes it (title, creator, date, the creator's own description, how it was made, tools, tags, why it was picked) and shows its preview image. Talk about that work.

- Reply in the user's language and register: Saudi Arabic by default, with English terms where designers use them.
- Be brief and specific: usually 2-5 sentences. Longer only when they ask for a breakdown.
- When they ask a factual question you can't answer from what's here (who made it, software, lens, process, a making-of), search the web and prefer the creator's own pages. Put the source link at the end as a plain URL. Never invent credits.
- Plain text only: no markdown headings, bold, or tables. Short lines and plain URLs are fine.
- Earlier notes signed with another agent's name (e.g. [Codex]) came from that agent; you can build on them.`;

type Context = { item: Item; project: Pick<Project, "name" | "brief"> | null };

/** The request for one reply: the reference as the opening turn, then the notes as the conversation. */
export function buildReplyMessages({ item, project }: Context): Anthropic.Beta.BetaMessageParam[] {
  const lines = [
    `Reference: ${item.title ?? item.sourceUrl}`,
    `Link: ${item.sourceUrl} (${item.platform}, ${item.mediaType})`,
    item.authorName ? `Creator: ${item.authorName}${item.authorUrl ? ` (${item.authorUrl})` : ""}` : null,
    item.publishedAt ? `Published: ${item.publishedAt}` : null,
    item.tools?.length ? `Tools: ${item.tools.join(", ")}` : null,
    item.tags?.length ? `Tags: ${item.tags.join(", ")}` : null,
    item.reason ? `Why it was picked: ${item.reason}` : null,
    item.process ? `How it was made: ${item.process}` : null,
    item.description ? `The creator's description:\n${item.description}` : null,
    project ? `Project: ${project.name}${briefLine(project.brief)}` : null,
  ].filter(Boolean);

  const image = item.preview?.w1280;
  const opening: Anthropic.Beta.BetaContentBlockParam[] = [
    // Only images the API can fetch (local emulator previews are not reachable from outside).
    ...(image && /^https:\/\//.test(image) && !/localhost|127\.0\.0\.1/.test(image)
      ? [{ type: "image" as const, source: { type: "url" as const, url: image } }]
      : []),
    { type: "text", text: lines.join("\n") },
  ];

  const notes = (item.notes ?? []).slice(-HISTORY);
  return [
    { role: "user", content: opening },
    ...notes.map((note): Anthropic.Beta.BetaMessageParam =>
      note.by === "user"
        ? { role: "user", content: note.text }
        : {
            role: "assistant",
            content: note.name && note.name !== REPLY_AGENT_NAME ? `[${note.name}] ${note.text}` : note.text,
          },
    ),
  ];
}

function briefLine(brief: Record<string, unknown> | undefined): string {
  if (!brief || !Object.keys(brief).length) return "";
  return ` — brief: ${JSON.stringify(brief).slice(0, 800)}`;
}

/**
 * Answers the latest note on a reference, once: the claim is a transaction, so two triggers for the
 * same note can't both reply. The reply lands as an agent note; failures are recorded on the item
 * (`agentReply`) so the sheet can offer a retry.
 */
export async function replyToNotes(uid: string, itemId: string): Promise<"replied" | "skipped" | "failed"> {
  const { db } = admin();
  const ref = db.doc(`users/${uid}/items/${itemId}`);

  const item = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const data = snap.data() as Item;
    const last = data.notes?.at(-1);
    if (last?.by !== "user") return null;
    const busy = data.agentReply?.status === "thinking";
    const startedAt = (data.agentReply?.at as Timestamp | undefined)?.toMillis?.() ?? 0;
    if (busy && Date.now() - startedAt < STALE_MS) return null;
    tx.update(ref, { agentReply: { status: "thinking", at: FieldValue.serverTimestamp(), error: null } });
    return data;
  });
  if (!item) return "skipped";

  try {
    const projectSnap = await db.doc(`users/${uid}/projects/${item.projectId}`).get();
    const project = projectSnap.exists ? (projectSnap.data() as Project) : null;
    const text = await ask(buildReplyMessages({ item, project }));
    const note = makeNote("agent", text, REPLY_AGENT_NAME);
    if (!note) throw new Error("empty-reply");
    await db.runTransaction(async (tx) => {
      const notes = ((await tx.get(ref)).get("notes") as ItemNote[] | undefined) ?? [];
      tx.update(ref, { notes: [...notes, note].slice(-MAX_NOTES), agentReply: null });
    });
    return "replied";
  } catch (err) {
    console.error("agent reply failed", { itemId, err });
    const code = err instanceof Anthropic.APIError ? `api-${err.status ?? "error"}` : err instanceof Error ? err.message : "internal";
    await ref.update({ agentReply: { status: "failed", at: FieldValue.serverTimestamp(), error: code.slice(0, 60) } }).catch(() => undefined);
    return "failed";
  }
}

async function ask(messages: Anthropic.Beta.BetaMessageParam[]): Promise<string> {
  const client = new Anthropic();
  let history = messages;
  for (let turn = 0; ; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // A declined request is re-run on Anthropic's recommended fallback model instead of failing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      system: SYSTEM,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages: history,
    });

    if (response.stop_reason === "refusal") return "ما أقدر أساعد في هذا السؤال. جرّب تسأل عن جانب ثاني من العمل.";
    // Long web searches pause the server-side loop; sending the turn back resumes it.
    if (response.stop_reason === "pause_turn" && turn < MAX_CONTINUATIONS) {
      history = [...history, { role: "assistant", content: response.content }];
      continue;
    }
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    if (!text) throw new Error(response.stop_reason === "max_tokens" ? "too-long" : "empty-reply");
    return text;
  }
}

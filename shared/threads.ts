// A reference's conversation ("thread") is addressed by its sheet link: …/p/<project slug>?ref=<item id>.
// Any agent given that link can find the thread through the Ilham tools.

const ITEM_ID = /^[\w-]{1,64}__[a-f0-9]{64}$/;

/** The project slug and item id in a reference link, or null when it isn't one. */
export function parseThreadLink(link: string): { project: string; id: string } | null {
  try {
    const url = new URL(link.trim());
    const slug = url.pathname.match(/^\/p\/([^/]+)\/?$/)?.[1];
    const id = url.searchParams.get("ref");
    if (!slug || !id || !ITEM_ID.test(id)) return null;
    return { project: decodeURIComponent(slug), id };
  } catch {
    return null;
  }
}

/** What to paste to any agent connected to Ilham, to bring it into this thread. */
export function threadInvite(link: string): string {
  return [
    `Join my Ilham thread about this reference: ${link}`,
    `Use the "ilham" tools: open_thread with this link to read the work and our notes, then answer my latest note with add_note (short, in my language).`,
    `After each reply, call wait_for_reply and answer every new note of mine the same way, until I say we're done.`,
  ].join("\n");
}

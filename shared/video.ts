// Video sources for hover/in-view motion previews. Shared by the browser and the ingest server.

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

export function vimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)vimeo\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/\/(?:video\/)?(\d{5,})(?:\/|$)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export type MotionSource =
  | { kind: "file"; src: string }
  | { kind: "embed"; provider: "youtube" | "vimeo"; src: string };

/**
 * What can play when a card comes alive: our own stored loop first, otherwise the platform's
 * official muted, chrome-less embed (YouTube, Vimeo). Nothing is downloaded from those platforms.
 */
export function motionSource(item: {
  sourceUrl: string;
  platform: string;
  preview?: { video?: string | null } | null;
}): MotionSource | null {
  if (item.preview?.video) return { kind: "file", src: item.preview.video };
  if (item.platform === "youtube") {
    const id = youtubeId(item.sourceUrl);
    if (id) {
      const q = new URLSearchParams({
        autoplay: "1",
        mute: "1",
        controls: "0",
        loop: "1",
        playlist: id,
        playsinline: "1",
        rel: "0",
        disablekb: "1",
        iv_load_policy: "3",
      });
      return { kind: "embed", provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}?${q}` };
    }
  }
  if (item.platform === "vimeo") {
    const id = vimeoId(item.sourceUrl);
    if (id) {
      return {
        kind: "embed",
        provider: "vimeo",
        src: `https://player.vimeo.com/video/${id}?background=1&autoplay=1&muted=1&loop=1&dnt=1`,
      };
    }
  }
  return null;
}

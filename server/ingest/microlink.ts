import { safeFetch } from "./safeFetch";

// Microlink renders pages in a real browser: a fallback for pages we can't read directly,
// and the screenshot source for pages without an og:image. Free tier: 50 requests/day.
// Set MICROLINK_API_KEY for the Pro tier (higher limits + anti-bot proxy for sites like Dribbble).

export interface MicrolinkMeta {
  title?: string;
  author?: string;
  imageUrl?: string;
  screenshotUrl?: string;
}

export async function microlink(url: string, opts: { screenshot?: boolean } = {}): Promise<MicrolinkMeta | null> {
  const key = process.env.MICROLINK_API_KEY;
  const endpoint = new URL(key ? "https://pro.microlink.io" : "https://api.microlink.io");
  endpoint.searchParams.set("url", url);
  if (opts.screenshot) {
    endpoint.searchParams.set("screenshot", "true");
    endpoint.searchParams.set("viewport.width", "1440");
    endpoint.searchParams.set("viewport.height", "1080");
  }

  try {
    const res = await safeFetch(endpoint.toString(), {
      timeoutMs: 25_000,
      maxBytes: 1024 * 1024,
      headers: { accept: "application/json", ...(key ? { "x-api-key": key } : {}) },
    });
    const json = JSON.parse(res.body.toString("utf8"));
    if (json.status !== "success") return null;
    const data = json.data ?? {};
    return {
      title: data.title ?? undefined,
      author: data.author ?? undefined,
      imageUrl: data.image?.url ?? undefined,
      screenshotUrl: data.screenshot?.url ?? undefined,
    };
  } catch {
    return null;
  }
}

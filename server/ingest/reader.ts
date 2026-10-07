import { safeFetch } from "./safeFetch";

// Jina Reader (r.jina.ai) opens pages in a real browser and returns their metadata as JSON. It
// reaches sites that refuse our servers (Dribbble, Behance), so it is tried before Microlink, whose
// free tier is shared by every app on the same Vercel IPs and runs dry quickly.
// Free without a key (about 20 requests a minute); set JINA_API_KEY for more.

export interface ReaderMeta {
  title?: string;
  description?: string;
  author?: string;
  image?: string;
  video?: string;
  publishedAt?: string;
  keywords?: string;
}

export async function reader(url: string): Promise<ReaderMeta | null> {
  const key = process.env.JINA_API_KEY;
  try {
    const res = await safeFetch(`https://r.jina.ai/${url}`, {
      timeoutMs: 25_000,
      maxBytes: 3 * 1024 * 1024,
      headers: {
        // A browser user agent gets Reader's own web page instead of the API.
        "user-agent": "Ilham/1.0 (reference previews)",
        accept: "application/json",
        "x-retain-images": "none",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
    });
    if (res.status !== 200) return null;
    return parseReader(JSON.parse(res.body.toString("utf8")));
  } catch {
    return null;
  }
}

type Meta = Record<string, unknown>;

/** Reader JSON → page metadata. Meta values come as a string, or a list when a tag repeats. */
export function parseReader(json: unknown): ReaderMeta | null {
  const data = (json as { data?: Meta } | null)?.data;
  if (!data || typeof data !== "object") return null;
  const meta = (data.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Meta;
  const get = (...names: string[]) => {
    for (const name of names) {
      const raw = meta[name];
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return undefined;
  };
  const http = (v?: string) => (v && /^https?:\/\//i.test(v) ? v : undefined);
  const video = http(get("og:video:secure_url", "og:video:url", "og:video"));

  const result: ReaderMeta = {
    title: get("og:title", "twitter:title") ?? str(data.title),
    description: get("og:description", "twitter:description", "description") ?? str(data.description),
    author: get("author", "article:author") ?? creditFromAlt(get("og:image:alt", "twitter:image:alt")),
    image: http(get("og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src")),
    video: video && /\.(mp4|webm|mov)(\?|$)/i.test(video) ? video : undefined,
    publishedAt: get("article:published_time", "og:published_time", "datePublished") ?? str(data.publishedTime),
    keywords: get("keywords"),
  };
  return result.title || result.image ? result : null;
}

/** Dribbble names the designer in its image alt: `Dribbble shot titled "X" by Jane Doe`. */
function creditFromAlt(alt?: string): string | undefined {
  return alt?.match(/\s+by\s+(.+)$/i)?.[1]?.trim() || undefined;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

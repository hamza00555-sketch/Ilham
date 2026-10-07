import * as cheerio from "cheerio";

export interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
  video?: string;
  siteName?: string;
  author?: string;
  /** The creator's page (JSON-LD author.url, rel=author, article:author when it's a link). */
  authorUrl?: string;
  /** Raw publish date from meta tags or JSON-LD; normalize with normalizeDate(). */
  publishedAt?: string;
  /** meta keywords, article:tag and JSON-LD keywords: where tools are often named. */
  keywords?: string;
  oembedUrl?: string;
}

/** Reads OpenGraph / Twitter Card / plain HTML metadata from a page. Cheerio decodes entities. */
export function parseHtml(html: string, baseUrl: string): PageMeta {
  const $ = cheerio.load(html);

  const meta = (...names: string[]) => {
    for (const name of names) {
      const value =
        $(`meta[property="${name}"]`).attr("content") ?? $(`meta[name="${name}"]`).attr("content");
      if (value?.trim()) return value.trim();
    }
    return undefined;
  };

  const abs = (href?: string) => {
    if (!href) return undefined;
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return undefined;
    }
  };

  const video = abs(meta("og:video:secure_url", "og:video:url", "og:video"));
  const ld = readJsonLd($);
  const ldAuthor = person(ld.author ?? ld.creator);
  // article:author is a name on some sites and a profile link on others.
  const metaAuthor = meta("author", "article:author", "twitter:creator");
  const authorIsLink = !!metaAuthor && /^https?:\/\//i.test(metaAuthor);
  const metaDescription = meta("og:description", "twitter:description", "description");
  const ldDescription = typeof ld.description === "string" ? ld.description.trim() : undefined;
  const keywords = [
    meta("keywords"),
    ...$('meta[property="article:tag"]').map((_, el) => $(el).attr("content")).get(),
    Array.isArray(ld.keywords) ? ld.keywords.join(", ") : typeof ld.keywords === "string" ? ld.keywords : undefined,
  ].filter(Boolean);

  return {
    title: meta("og:title", "twitter:title") ?? ($("title").first().text().trim() || undefined),
    // og:description is often cut at ~300 characters; JSON-LD usually has the whole text.
    description: (ldDescription?.length ?? 0) > (metaDescription?.length ?? 0) ? ldDescription : metaDescription,
    image: abs(
      meta("og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src") ??
        $('link[rel="image_src"]').attr("href"),
    ),
    video: video && /\.(mp4|webm|mov)(\?|$)/i.test(video) ? video : undefined,
    siteName: meta("og:site_name", "application-name"),
    author: ldAuthor.name ?? (authorIsLink ? undefined : metaAuthor),
    authorUrl: abs(ldAuthor.url ?? $('link[rel="author"]').attr("href") ?? (authorIsLink ? metaAuthor : undefined)),
    publishedAt:
      meta("article:published_time", "og:published_time", "datePublished", "date", "dc.date", "pubdate") ??
      $('meta[itemprop="datePublished"], meta[itemprop="uploadDate"]').first().attr("content") ??
      str(ld.datePublished ?? ld.uploadDate ?? ld.dateCreated),
    keywords: keywords.length ? keywords.join(", ").slice(0, 2000) : undefined,
    oembedUrl: abs($('link[type="application/json+oembed"]').attr("href")),
  };
}

type LdNode = Record<string, unknown>;

/** The page's JSON-LD node that describes the work itself (the first one with an author or a date). */
function readJsonLd($: cheerio.CheerioAPI): LdNode {
  const nodes: LdNode[] = [];
  const collect = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") {
      nodes.push(value as LdNode);
      if ("@graph" in value) collect((value as LdNode)["@graph"]);
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collect(JSON.parse($(el).text()));
    } catch {
      // Broken JSON-LD is common; ignore it.
    }
  });
  return nodes.find((n) => n.author || n.creator || n.datePublished || n.uploadDate) ?? nodes[0] ?? {};
}

/** JSON-LD people come as a string, an object, or a list of either. */
function person(value: unknown): { name?: string; url?: string } {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "string") return { name: first.trim() || undefined };
  if (first && typeof first === "object") {
    const p = first as LdNode;
    return { name: str(p.name), url: str(p.url) ?? str(p.sameAs) };
  }
  return {};
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

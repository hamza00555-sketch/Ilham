import * as cheerio from "cheerio";

export interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
  video?: string;
  siteName?: string;
  author?: string;
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
  return {
    title: meta("og:title", "twitter:title") ?? ($("title").first().text().trim() || undefined),
    description: meta("og:description", "twitter:description", "description"),
    image: abs(
      meta("og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src") ??
        $('link[rel="image_src"]').attr("href"),
    ),
    video: video && /\.(mp4|webm|mov)(\?|$)/i.test(video) ? video : undefined,
    siteName: meta("og:site_name", "application-name"),
    author: meta("author", "article:author", "twitter:creator"),
    oembedUrl: abs($('link[type="application/json+oembed"]').attr("href")),
  };
}

import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

const MAX_REDIRECTS = 5;

export const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

export class FetchError extends Error {
  constructor(
    message: string,
    readonly code: "blocked-address" | "too-large" | "redirects" | "protocol" | "timeout" | "network",
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export interface FetchResult {
  url: string;
  status: number;
  contentType: string;
  headers: Headers;
  body: Buffer;
}

/** Rejects hosts that resolve to loopback, private, link-local or otherwise non-public ranges (SSRF guard). */
export async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new FetchError(`Blocked host ${host}`, "blocked-address");
  }
  const addresses = ipaddr.isValid(host)
    ? [host]
    : (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
  for (const address of addresses) {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    if (parsed.range() !== "unicast") {
      throw new FetchError(`Blocked address ${address} for ${host}`, "blocked-address");
    }
  }
}

/** fetch() with SSRF checks on every redirect hop, a timeout and a response size cap. */
export async function safeFetch(
  input: string,
  opts: { maxBytes?: number; timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<FetchResult> {
  const { maxBytes = 15 * 1024 * 1024, timeoutMs = 10_000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let current = new URL(input);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (current.protocol !== "https:" && current.protocol !== "http:") {
        throw new FetchError(`Unsupported protocol ${current.protocol}`, "protocol");
      }
      await assertPublicHost(current.hostname);

      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { ...BROWSER_HEADERS, ...opts.headers },
      });

      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        current = new URL(location, current);
        continue;
      }

      if (Number(res.headers.get("content-length") ?? 0) > maxBytes) {
        await res.body?.cancel();
        throw new FetchError(`Response larger than ${maxBytes} bytes`, "too-large");
      }
      return {
        url: current.toString(),
        status: res.status,
        contentType: (res.headers.get("content-type") ?? "").toLowerCase(),
        headers: res.headers,
        body: await readCapped(res, maxBytes),
      };
    }
    throw new FetchError("Too many redirects", "redirects");
  } catch (err) {
    if (err instanceof FetchError) throw err;
    if (controller.signal.aborted) throw new FetchError(`Timed out after ${timeoutMs}ms`, "timeout");
    throw new FetchError(err instanceof Error ? err.message : String(err), "network");
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new FetchError(`Response larger than ${maxBytes} bytes`, "too-large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Bot walls: 401/403/429/503, AWS WAF (Dribbble: 202 + x-amzn-waf-action), Cloudflare challenges.
 */
export function looksBlocked(res: FetchResult): boolean {
  if ([401, 403, 429, 503].includes(res.status)) return true;
  if (res.headers.get("x-amzn-waf-action") || res.headers.get("cf-mitigated")) return true;
  if (res.status === 202 && res.body.length < 16_384) return true;
  if (res.body.length < 16_384) {
    const head = res.body.toString("utf8", 0, 4096);
    return /awsWafCookie|challenge-platform|cf-chl-|<title>Just a moment/i.test(head);
  }
  return false;
}

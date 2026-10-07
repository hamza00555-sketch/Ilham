// Credits: who made a reference, when, and with what. Shared by ingest, the agent API and the UI.

/** Software we recognize in a creator's own words. Ambiguous names (Maya, Unity, Nuke…) match case-sensitively. */
const TOOLS: [name: string, pattern: RegExp][] = [
  ["Blender", /\bblender\b|بلندر/i],
  ["Cinema 4D", /\bcinema ?4d\b|\bc4d\b/i],
  ["Houdini", /\bhoudini\b|هوديني/i],
  ["Maya", /\bMaya\b|\bautodesk maya\b/],
  ["3ds Max", /\b3ds ?max\b/i],
  ["ZBrush", /\bz ?brush\b/i],
  ["Substance 3D", /\bsubstance (3d )?(painter|designer|sampler)\b/i],
  ["Marvelous Designer", /\bmarvelous designer\b/i],
  ["Unreal Engine", /\bunreal( engine)?\b|\bue[45]\b/i],
  ["Unity", /\bUnity\b/],
  ["Octane", /\boctane( ?render)?\b/i],
  ["Redshift", /\bredshift\b/i],
  ["Arnold", /\bArnold render(er)?\b/i],
  ["V-Ray", /\bv-?ray\b/i],
  ["Corona", /\bcorona render(er)?\b/i],
  ["KeyShot", /\bkeyshot\b/i],
  ["After Effects", /\bafter ?effects\b|(أ|ا)فتر (إ|ا)فكتس/i],
  ["Premiere Pro", /\bpremiere pro\b/i],
  ["DaVinci Resolve", /\bdavinci( resolve)?\b/i],
  ["Nuke", /\bNuke\b/],
  ["Photoshop", /\bphotoshop\b|فوتوشوب/i],
  ["Illustrator", /\badobe illustrator\b|\billustrator cc\b|اليستريتور/i],
  ["InDesign", /\bindesign\b/i],
  ["Lightroom", /\blightroom\b/i],
  ["Figma", /\bfigma\b|فيجما|فيغما/i],
  ["Framer", /\bframer\b/i],
  ["Webflow", /\bwebflow\b/i],
  ["Spline", /\bSpline\b/],
  ["Rive", /\bRive\b/],
  ["Lottie", /\blottie\b/i],
  ["ProtoPie", /\bprotopie\b/i],
  ["TouchDesigner", /\btouch ?designer\b/i],
  ["Notch", /\bNotch\b/],
  ["Three.js", /\bthree\.?js\b/i],
  ["WebGL", /\bwebgl\b/i],
  ["GSAP", /\bgsap\b/i],
  ["Midjourney", /\bmidjourney\b|ميدجورني/i],
  ["Stable Diffusion", /\bstable diffusion\b/i],
  ["Runway", /\brunway ?ml\b|\brunway gen-?\d\b/i],
  ["Sora", /\bSora\b/],
  ["Kling", /\bKling\b/],
  ["Higgsfield", /\bhiggsfield\b/i],
  ["Krea", /\bkrea( ai)?\b/i],
  ["Procreate", /\bprocreate\b/i],
  ["Nomad Sculpt", /\bnomad sculpt\b/i],
  ["SketchUp", /\bsketch ?up\b/i],
  ["Lens Studio", /\blens studio\b/i],
  ["Reality Composer", /\breality composer( pro)?\b/i],
  ["Gaussian Splatting", /\bgaussian splat/i],
];

const MAX_TOOLS = 12;

/** Tools named anywhere in the given texts (title, description, keywords), in a stable order. */
export function detectTools(...texts: (string | null | undefined)[]): string[] {
  const text = texts.filter(Boolean).join("\n");
  if (!text) return [];
  return TOOLS.filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name)
    .slice(0, MAX_TOOLS);
}

/**
 * Tools from an agent or the user: trimmed, deduped (case-insensitive), known ones under their
 * canonical name ("c4d" → "Cinema 4D"), at most 12 of 40 characters.
 */
export function cleanTools(tools?: unknown): string[] {
  if (!Array.isArray(tools)) return [];
  const out = new Map<string, string>();
  for (const raw of tools) {
    if (typeof raw !== "string") continue;
    const value = raw.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!value) continue;
    // "Adobe After Effects", "Maxon Cinema 4D" → the name everyone uses.
    const bare = value.replace(/^(adobe|autodesk|maxon|sidefx|epic games?)\s+/i, "");
    const known = TOOLS.find(
      ([name, pattern]) => name.toLowerCase() === bare.toLowerCase() || fullMatch(pattern, value) || fullMatch(pattern, bare),
    );
    const name = known?.[0] ?? value;
    if (!out.has(name.toLowerCase())) out.set(name.toLowerCase(), name);
    if (out.size === MAX_TOOLS) break;
  }
  return [...out.values()];
}

function fullMatch(pattern: RegExp, value: string) {
  const m = value.match(pattern);
  return !!m && m[0].length >= value.length - 1;
}

export const mergeTools = (...lists: (string[] | null | undefined)[]) => cleanTools(lists.flatMap((l) => l ?? []));

/**
 * A publish date as "YYYY-MM-DD", "YYYY-MM" or "YYYY" (as precise as the source is). Accepts
 * ISO strings, "2011-04-15 08:35:35", "March 5, 2023" and Unix seconds or milliseconds.
 */
export function normalizeDate(input: unknown): string | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    return validDay(new Date(input > 1e11 ? input : input * 1000));
  }
  if (typeof input !== "string") return null;
  const value = input.trim();
  const partial = value.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?(?=$|[T\s])/);
  if (partial) {
    const [, y, m, d] = partial;
    if (!plausibleYear(Number(y))) return null;
    if (m && (Number(m) < 1 || Number(m) > 12)) return null;
    if (d && (Number(d) < 1 || Number(d) > 31)) return null;
    return [y, m, m && d].filter(Boolean).join("-");
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : validDay(new Date(parsed));
}

function validDay(date: Date): string | null {
  if (Number.isNaN(date.getTime()) || !plausibleYear(date.getUTCFullYear())) return null;
  return date.toISOString().slice(0, 10);
}

const plausibleYear = (y: number) => y >= 1900 && y <= new Date().getUTCFullYear() + 1;

/** Platform taglines that some pages put in og:description instead of the work's own text. */
const GENERIC_DESCRIPTIONS = [
  /enjoy the videos and music you love/i,
  /world'?s (largest|leading) creative network/i,
  /discover the world'?s top designers/i,
  /is the leading destination to find & showcase creative work/i,
  /^explore .{0,40} on (dribbble|behance|pinterest)/i,
  /connect with them on dribbble/i,
];

/** The creator's own words about the work: whitespace tidied, taglines and title echoes dropped. */
export function cleanDescription(input: unknown, title?: string | null, max = 2000): string | null {
  if (typeof input !== "string") return null;
  const text = input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < 3) return null;
  if (title && text.toLowerCase() === title.trim().toLowerCase()) return null;
  if (GENERIC_DESCRIPTIONS.some((p) => p.test(text))) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Plain short text from an agent or the user (a name, a process note). */
export function cleanLine(input: unknown, max: number): string | null {
  if (typeof input !== "string") return null;
  const text = input.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text ? text.slice(0, max) : null;
}

export function cleanHttpUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const url = new URL(input.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * CJ variant lists (size / colour) for the storefront variant picker (2026-10-02).
 * pid -> every CJ variant with its own supplier cost. The cost stays server-side: /api/cj-variants returns only the
 * retail price (same rule as everything else, ./pricing) and an encrypted quote per variant (./quote), so checkout
 * recomputes the charged price from the cost of the variant the customer chose and sends its vid to CJ.
 * Cached in isolate memory and, best effort, in the Cloudflare Cache API (CJ allows ~1 request/second per account).
 */
import { cjToken, cjJson, validPid } from "./cj";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const TTL_SECONDS = 12 * 3600;
const MAX_VARIANTS = 80;

export type CjVariantRow = { vid: string; sku: string; key: string; values: string[]; image: string; costUsd: number };
export type CjVariantList = { pid: string; optionNames: string[]; variants: CjVariantRow[]; at: number };

const memory = new Map<string, CjVariantList>();
const inflight = new Map<string, Promise<CjVariantList | null>>();

function num(value: unknown): number {
  const n = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parse(pid: string, product: any, variants: any[]): CjVariantList {
  const optionNames = String(product?.productKeyEn || "").split("-").map((s) => s.trim()).filter(Boolean);
  const rows: CjVariantRow[] = [];
  const seen = new Set<string>();
  for (const v of Array.isArray(variants) ? variants : []) {
    const vid = String(v?.vid || "");
    const cost = num(v?.variantSellPrice);
    if (!validPid(vid) || !cost || seen.has(vid)) continue;
    seen.add(vid);
    const key = String(v?.variantKey || v?.variantNameEn || "").trim();
    rows.push({ vid, sku: String(v?.variantSku || ""), key, values: [], image: String(v?.variantImage || ""), costUsd: cost });
    if (rows.length >= MAX_VARIANTS) break;
  }
  // Split "Black-XL" into the product's option names ("Color-Size") when every variant splits cleanly.
  let names = optionNames;
  const split = rows.map((r) => r.key.split("-").map((s) => s.trim()));
  const clean = names.length > 1 && split.every((parts) => parts.length === names.length && parts.every(Boolean));
  if (clean) rows.forEach((r, i) => (r.values = split[i]));
  else {
    names = [names.length === 1 ? names[0] : "Variant"];
    rows.forEach((r) => (r.values = [r.key || r.sku || r.vid]));
  }
  return { pid, optionNames: names, variants: rows, at: Date.now() };
}

function cacheKey(pid: string) {
  return `https://cj-variant-list-cache.invalid/v1/${encodeURIComponent(pid)}`;
}

async function cacheGet(pid: string): Promise<CjVariantList | null> {
  try {
    const cache = (globalThis as any).caches?.default;
    const hit = cache ? await cache.match(cacheKey(pid)) : null;
    if (!hit) return null;
    const value = (await hit.json()) as CjVariantList;
    return value && Array.isArray(value.variants) ? value : null;
  } catch {
    return null;
  }
}

async function cachePut(value: CjVariantList) {
  try {
    const cache = (globalThis as any).caches?.default;
    if (!cache) return;
    await cache.put(cacheKey(value.pid), new Response(JSON.stringify(value), {
      headers: { "content-type": "application/json", "cache-control": `public, max-age=${TTL_SECONDS}` },
    }));
  } catch {
    /* best effort */
  }
}

async function fromCj(pid: string, apiKey: string): Promise<CjVariantList | null> {
  const token = await cjToken(apiKey);
  const detail = await cjJson(`${CJ_BASE}/product/query?pid=${encodeURIComponent(pid)}`, { headers: { "CJ-Access-Token": token } });
  const product = detail?.data;
  if (!product) return null;
  return parse(pid, product, product.variants);
}

/** Every CJ variant (with cost) for a product, or null when CJ can't be reached / no key is bound. Never throws. */
export async function listCjVariants(pid: string, env: any): Promise<CjVariantList | null> {
  if (!validPid(pid)) return null;
  const mem = memory.get(pid);
  if (mem && mem.at + TTL_SECONDS * 1000 > Date.now()) return mem;
  const running = inflight.get(pid);
  if (running) return running;
  const job = (async () => {
    let value = await cacheGet(pid);
    if (!value) {
      const apiKey = env && env.CJ_API_KEY ? String(env.CJ_API_KEY) : "";
      if (!apiKey) return null;
      try { value = await fromCj(pid, apiKey); } catch { value = null; }
      if (value && value.variants.length) await cachePut(value);
    }
    if (value && value.variants.length) memory.set(pid, value);
    return value;
  })().finally(() => inflight.delete(pid));
  inflight.set(pid, job);
  return job;
}

// ------------------------------------------------------------- Norwegian labels for option names and values

const OPTION_NB: Record<string, string> = {
  color: "Farge", colour: "Farge", size: "Størrelse", style: "Stil", model: "Modell", material: "Materiale",
  length: "Lengde", capacity: "Kapasitet", quantity: "Antall", pattern: "Mønster", shape: "Form", type: "Type",
  specification: "Variant", specifications: "Variant", spec: "Variant", variant: "Variant", power: "Effekt",
  plug: "Støpsel", "plug type": "Støpsel", width: "Bredde", height: "Høyde", weight: "Vekt", volume: "Volum",
  number: "Antall", package: "Pakke", "package size": "Pakke", age: "Alder", gender: "Kjønn", flavor: "Smak",
  scent: "Duft", fragrance: "Duft", voltage: "Spenning", wattage: "Effekt", diameter: "Diameter", thickness: "Tykkelse",
  "suitable height": "Størrelse", "suitable for height": "Størrelse", "child size": "Størrelse", "children size": "Størrelse",
  "kids size": "Størrelse", "shoe size": "Skostørrelse", "clothing size": "Størrelse", sizes: "Størrelse", colors: "Farge",
  colours: "Farge", "suitable age": "Alder", "applicable age": "Alder", "age range": "Alder", "suitable for age": "Alder",
  "applicable people": "For", "applicable crowd": "For", "suitable crowd": "For", "number of pieces": "Antall", set: "Sett",
};

const PHRASES: Array<[RegExp, string]> = [
  [/\b(picture|photo|image)\s*colou?rs?\b|\bas (shown|picture)\b|\bshown\b/gi, "Som bildet"],
  [/\bmulti\s*-?colou?r(ed)?\b|\bmixed colou?rs?\b|\bcolorful\b/gi, "Flerfarget"],
  [/\bnavy\s*blue\b|\bnavy\b/gi, "Marineblå"], [/\bdark\s*blue\b/gi, "Mørkeblå"], [/\blight\s*blue\b/gi, "Lyseblå"],
  [/\bsky\s*blue\b/gi, "Himmelblå"], [/\broyal\s*blue\b/gi, "Kongeblå"], [/\blake\s*blue\b/gi, "Sjøblå"],
  [/\bdark\s*gr[ae]y\b/gi, "Mørkegrå"], [/\blight\s*gr[ae]y\b/gi, "Lysegrå"], [/\bdark\s*green\b/gi, "Mørkegrønn"],
  [/\blight\s*green\b/gi, "Lysegrønn"], [/\barmy\s*green\b/gi, "Militærgrønn"], [/\bmint\s*green\b/gi, "Mintgrønn"],
  [/\bwine\s*red\b/gi, "Vinrød"], [/\brose\s*red\b/gi, "Rosenrød"], [/\bdark\s*red\b/gi, "Mørkerød"],
  [/\brose\s*gold\b/gi, "Roségull"], [/\blight\s*pink\b/gi, "Lyserosa"], [/\bdark\s*pink\b/gi, "Mørkerosa"],
  [/\blight\s*purple\b/gi, "Lyselilla"], [/\bdark\s*purple\b/gi, "Mørkelilla"], [/\bdark\s*brown\b/gi, "Mørkebrun"],
  [/\blight\s*brown\b/gi, "Lysebrun"], [/\boff\s*-?white\b/gi, "Offwhite"], [/\brice\s*white\b/gi, "Offwhite"],
  [/(\d+)\s*to\s*(\d+)/gi, "$1–$2"], [/(\d+)\s*-?\s*(years?\s*old|years?|yrs?|y)\b/gi, "$1 år"],
  [/(\d+)\s*-?\s*(months?\s*old|months?)\b/gi, "$1 mnd"],
];
const WORDS: Record<string, string> = {
  black: "Svart", white: "Hvit", red: "Rød", blue: "Blå", green: "Grønn", yellow: "Gul", pink: "Rosa", purple: "Lilla",
  violet: "Fiolett", grey: "Grå", gray: "Grå", brown: "Brun", orange: "Oransje", gold: "Gull", golden: "Gull",
  silver: "Sølv", coffee: "Kaffebrun", apricot: "Aprikos", camel: "Kamel", cream: "Krem", ivory: "Elfenben",
  transparent: "Gjennomsiktig", clear: "Klar", wine: "Vinrød", burgundy: "Burgunder", turquoise: "Turkis",
  cyan: "Cyan", rose: "Rose", champagne: "Champagne", colour: "farge", color: "farge", colors: "farger", colours: "farger",
  dad: "Pappa", father: "Pappa", mom: "Mamma", mother: "Mamma", kid: "Barn", kids: "Barn", child: "Barn",
  children: "Barn", women: "Dame", woman: "Dame", men: "Herre", man: "Herre", boy: "Gutt", boys: "Gutt",
  girl: "Jente", girls: "Jente", adult: "Voksen", style: "Stil", piece: "stk", pieces: "stk", random: "Tilfeldig",
  jacket: "Jakke", pants: "Bukse", trousers: "Bukse", top: "Topp", dress: "Kjole", skirt: "Skjørt", shorts: "Shorts",
  hat: "Lue", coat: "Kåpe", vest: "Vest", shirt: "Skjorte", suit: "Sett", old: "", year: "år", years: "år",
  month: "mnd", months: "mnd", to: "til", baby: "Baby", toddler: "Småbarn", unisex: "Unisex", left: "Venstre", right: "Høyre",
  pcs: "stk", pc: "stk", pair: "par", pairs: "par", large: "Stor", small: "Liten", medium: "Medium",
};

export function optionNameNb(name: string): string {
  const key = String(name || "").trim().toLowerCase();
  return OPTION_NB[key] || (name ? name.charAt(0).toUpperCase() + name.slice(1) : "Variant");
}

export function optionValueNb(value: string): string {
  let out = String(value || "").trim();
  for (const [re, nb] of PHRASES) out = out.replace(re, nb);
  out = out.replace(/[A-Za-z]+/g, (word) => {
    const nb = WORDS[word.toLowerCase()];
    return nb === undefined ? word : nb;
  });
  return out.replace(/\s+/g, " ").trim().slice(0, 60);
}

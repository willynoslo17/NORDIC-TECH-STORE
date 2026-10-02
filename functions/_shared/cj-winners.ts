/**
 * Extra CJ "winners" (2026-10-02): products picked from trend research, ADDED after the live curated CJ set.
 * Config (data only): ./catalog-data/cj-winners.json
 *   keywords  CJ search words from trend research; each is one CJ listV2 page (50 rows), cached per keyword.
 *   pids      vetted CJ product ids. Only these are shown on the storefront, in this order; everything else a
 *             keyword returns is visible only in the review list (/api/cj-products?winners=review).
 *   minUsd / maxUsd  band for the highest variant cost; include / exclude  name regexes (niche fit).
 *   onlyWinners      the storefront CJ set is the winners only (no generic sector set), e.g. Ludispel.
 * Name, image and cost always come live from CJ, so the price (functions/_shared/pricing.ts) and the checkout
 * quote use the real cost. Keywords are refreshed in the background a few at a time and never delay the grid.
 */
import CONFIG from "./catalog-data/cj-winners.json";

type WinnersConfig = {
  keywords?: string[];
  pids?: string[];
  minUsd?: number;
  maxUsd?: number;
  include?: string;
  exclude?: string;
  onlyWinners?: boolean;
};

export type WinnerDeps = {
  apiKey: string;
  origin: string;
  sector: string;
  getToken: (apiKey: string) => Promise<{ token: string; fresh: boolean }>;
  fetchPage: (token: string, keyword: string, page: number) => Promise<any>;
  flatten: (data: any) => any[];
  accept: (item: any) => boolean;
  toProduct: (item: any, index: number, sector: string) => any;
  waitUntil?: (promise: Promise<unknown>) => void;
};

const CFG = CONFIG as WinnersConfig;
export const WINNERS_ONLY = CFG.onlyWinners === true;
const KEYWORDS = Array.from(new Set((CFG.keywords || []).map((k) => String(k).trim().toLowerCase()).filter(Boolean)));
const PIDS = (CFG.pids || []).map(String);
const PID_SET = new Set(PIDS);
const MIN_USD = Number(CFG.minUsd) > 0 ? Number(CFG.minUsd) : 0;
const MAX_USD = Number(CFG.maxUsd) > 0 ? Number(CFG.maxUsd) : 1000;
const INCLUDE = CFG.include ? new RegExp(CFG.include, "i") : null;
const EXCLUDE = CFG.exclude ? new RegExp(CFG.exclude, "i") : null;
const FRESH_MS = 6 * 3600 * 1000;
const KEEP_SECONDS = 48 * 3600;
const KEYWORDS_PER_REFRESH = 6;
const CJ_GAP_MS = 1100;

type Entry = { at: number; rows: any[] };
const memory = new Map<string, Entry>();
let refreshing: Promise<void> | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function keyUrl(origin: string, sector: string, keyword: string) {
  return `${origin}/__cache/cj-winners/v1?sector=${encodeURIComponent(sector)}&kw=${encodeURIComponent(keyword)}`;
}

async function readEntry(key: string): Promise<Entry | null> {
  const mem = memory.get(key);
  if (mem) return mem;
  try {
    const cache = (globalThis as any).caches?.default;
    const hit = cache ? await cache.match(key) : null;
    if (!hit) return null;
    const value = (await hit.json()) as Entry;
    if (!value || typeof value.at !== "number" || !Array.isArray(value.rows)) return null;
    memory.set(key, value);
    return value;
  } catch {
    return null;
  }
}

async function writeEntry(key: string, rows: any[]) {
  const value: Entry = { at: Date.now(), rows };
  memory.set(key, value);
  try {
    const cache = (globalThis as any).caches?.default;
    if (cache) {
      await cache.put(key, new Response(JSON.stringify(value), {
        headers: { "content-type": "application/json", "cache-control": `public, max-age=${KEEP_SECONDS}` },
      }));
    }
  } catch {
    /* best effort */
  }
}

async function refresh(deps: WinnerDeps, keywords: string[]) {
  let auth = await deps.getToken(deps.apiKey);
  if (auth.fresh) await sleep(CJ_GAP_MS);
  for (let i = 0; i < keywords.length; i++) {
    if (i) await sleep(CJ_GAP_MS);
    const keyword = keywords[i];
    try {
      const data = await deps.fetchPage(auth.token, keyword, 1);
      const rows = deps.flatten(data)
        .filter((item) => item && item.id && item.bigImage && deps.accept(item))
        .map((item, index) => ({ ...deps.toProduct(item, index, deps.sector), keyword }));
      await writeEntry(keyUrl(deps.origin, deps.sector, keyword), rows);
    } catch {
      /* keep the previous copy; retried on a later request */
    }
  }
}

function eligible(product: any): boolean {
  const name = String(product?.name || "");
  const cost = Math.max(Number(product?.supplierPriceMaxUsd) || 0, Number(product?.supplierPriceUsd) || 0);
  if (!product?.image || !(cost > 0) || cost < MIN_USD || cost > MAX_USD) return false;
  if (INCLUDE && !INCLUDE.test(name)) return false;
  if (EXCLUDE && EXCLUDE.test(name)) return false;
  return true;
}

/**
 * grid: vetted winners (pids) not already in `skip`, in pid order, with live cost; review: every eligible candidate.
 * Starts a background refresh of stale keywords; returns whatever is cached now (never waits for CJ).
 */
export async function winnerRows(deps: WinnerDeps, mode: "grid" | "review", skip: Set<string> = new Set()): Promise<any[]> {
  if (!KEYWORDS.length || (mode === "grid" && !PID_SET.size)) return [];
  const byId = new Map<string, any>();
  const stale: string[] = [];
  for (const keyword of KEYWORDS) {
    const entry = await readEntry(keyUrl(deps.origin, deps.sector, keyword));
    if (!entry || Date.now() - entry.at > FRESH_MS) stale.push(keyword);
    for (const row of entry?.rows || []) {
      const id = String(row?.id || "");
      if (id && !byId.has(id)) byId.set(id, row);
    }
  }
  if (stale.length && !refreshing) {
    refreshing = refresh(deps, stale.slice(0, KEYWORDS_PER_REFRESH)).catch(() => {}).finally(() => { refreshing = null; });
    if (deps.waitUntil) deps.waitUntil(refreshing);
  }
  if (mode === "review") return Array.from(byId.values()).filter(eligible).map((row) => ({ ...row, vetted: PID_SET.has(String(row.id)) }));
  const out: any[] = [];
  for (const pid of PIDS) {
    const row = byId.get(pid);
    if (row && !skip.has(pid) && eligible(row)) out.push(row);
  }
  return out;
}

/** Keyword refresh status for the review list. */
export function winnersStatus() {
  return { keywords: KEYWORDS.length, vetted: PID_SET.size, refreshing: Boolean(refreshing) };
}

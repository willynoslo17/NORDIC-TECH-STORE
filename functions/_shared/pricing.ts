/**
 * Retail price rule (owner decision 2026-10-02), used for display AND for what Stripe charges:
 *   retail NOK = supplier cost of the variant actually sold, converted to NOK (USD 10.8 / EUR 11.7) x 2.5,
 *   at least 99 kr, rounded UP to the next amount ending in 9 (e.g. 137.3 -> 139, 140 -> 149).
 * Products with no cost at all get no price (not sellable); see costUsd for the cost basis per supplier.
 * supplier-bridge.js has the same rule for local fallback rows. Keep both in sync.
 */
export const NOK_PER = { USD: 10.8, EUR: 11.7 } as const;
export const MARKUP = 2.5;
export const MIN_NOK = 99;
/** NOK per EUR used to turn the NOK price into the EU (EUR) and Peru (PEN) market prices. */
export const NOK_PER_EUR = NOK_PER.EUR;

export function retailNokFromCost(cost: number, currency: keyof typeof NOK_PER = "USD"): number {
  const c = Number(cost);
  if (!Number.isFinite(c) || c <= 0) return 0;
  const raw = Math.round(c * NOK_PER[currency] * MARKUP * 100) / 100;
  const endsIn9 = Math.ceil((Math.ceil(raw) + 1) / 10) * 10 - 1;
  return Math.max(MIN_NOK, endsIn9);
}

function num(value: unknown): number {
  const n = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** [min, max] from 3.3, "3.30", "1.50 -- 12.12" or "5.67-5.97"; [0, 0] when unknown. */
export function priceRange(value: unknown): [number, number] {
  if (typeof value === "number") return value > 0 ? [value, value] : [0, 0];
  const parts = String(value ?? "").split(/\s*-+\s*/).map(num).filter((n) => n > 0);
  if (!parts.length) return [0, 0];
  return [Math.min(...parts), Math.max(...parts)];
}

/**
 * Supplier cost (USD) used as the price basis (owner decision 2026-10-02 03:51), or 0 when there is none:
 * - CJ: the HIGHEST variant cost of the listing (sellPrice "min -- max" / supplierPriceMaxUsd), so every variant is
 *   covered; single-price listings use that price.
 * - Printify: rows are linked to one real shop variant; supplierPriceUsd is that variant's cost.
 * - Gelato / Printful: supplierPriceUsd as set by their catalog functions = the real cost from the supplier API,
 *   or the supplier's listed price when no cost is available.
 */
export function costUsd(provider: string, product: any): number {
  const p = String(provider || product?.provider || "").toLowerCase();
  if (p === "cj") {
    const listed = priceRange(product?.sellPrice ?? product?.supplierPriceUsd);
    return Math.max(num(product?.supplierPriceMaxUsd), listed[1], listed[0]);
  }
  if (p === "printify") {
    const linked = /^[0-9a-f]{24}$/.test(String(product?.printifyProductId || "")) && /^\d+$/.test(String(product?.printifyVariantId || ""));
    return linked ? num(product?.supplierPriceUsd) : 0;
  }
  if (p === "gelato" || p === "printful") return num(product?.supplierPriceUsd);
  return 0;
}

export function retailNok(provider: string, product: any): number {
  const cost = costUsd(provider, product);
  return cost ? retailNokFromCost(cost) : 0;
}

/** Stripe unit_amount (minor units) for a NOK retail price in a market whose rate is "currency units per EUR". */
export function marketUnitAmount(nok: number, currency: string, ratePerEur: number): number {
  if (!(nok > 0)) return 0;
  if (currency.toLowerCase() === "nok") return Math.round(nok * 100);
  return Math.round((nok / NOK_PER_EUR) * ratePerEur * 100);
}

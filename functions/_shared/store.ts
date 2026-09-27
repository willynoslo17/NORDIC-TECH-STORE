/** Per-store identity. This is the only checkout/webhook file that differs between the NORDIC-* repos. */
export const STORE = {
  slug: "nordic-tech-store",
  brand: "Novverk",
  domain: "novverk.no",
  siteUrl: "https://novverk.no/",
  /** Catalog sector used by the Gelato/Printful endpoints (never taken from the query string). */
  sector: "electronics",
} as const;

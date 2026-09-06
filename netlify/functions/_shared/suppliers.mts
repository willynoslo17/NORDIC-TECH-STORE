export type Market = "NO" | "EU" | "PE";

export type SupplierOffer = {
  supplier: "dropi" | "bigbuy" | "cj" | "syncee" | "dsers";
  sku: string;
  market: Market;
  inStock: boolean;
  productCost: number;
  shippingCost: number;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  salePrice: number;
  currency: "NOK" | "EUR" | "PEN";
  tracking: boolean;
  warehouseRegion: "PE" | "EU" | "CN" | "OTHER";
};

const priority: Record<Market, SupplierOffer["supplier"][]> = {
  PE: ["dropi", "cj", "syncee", "bigbuy", "dsers"],
  NO: ["bigbuy", "syncee", "cj", "dsers", "dropi"],
  EU: ["bigbuy", "syncee", "cj", "dsers", "dropi"],
};

export function chooseOffer(market: Market, offers: SupplierOffer[]) {
  const eligible = offers.filter((offer) =>
    offer.market === market &&
    offer.inStock &&
    offer.tracking &&
    offer.salePrice > offer.productCost + offer.shippingCost
  );

  return eligible
    .map((offer) => {
      const margin = offer.salePrice - offer.productCost - offer.shippingCost;
      const marginRate = margin / offer.salePrice;
      const rank = priority[market].indexOf(offer.supplier);
      const regionalBonus =
        (market === "PE" && offer.warehouseRegion === "PE") ||
        ((market === "NO" || market === "EU") && offer.warehouseRegion === "EU")
          ? 25
          : 0;
      const score =
        regionalBonus +
        Math.max(0, 20 - offer.deliveryDaysMax) +
        marginRate * 50 +
        Math.max(0, 10 - Math.max(rank, 0) * 2);

      return { ...offer, margin, marginRate, score };
    })
    .sort((a, b) => b.score - a.score)[0] ?? null;
}

export function configuredSuppliers() {
  return {
    dropi: Boolean(Netlify.env.get("DROPI_API_TOKEN")),
    bigbuy: Boolean(Netlify.env.get("BIGBUY_API_TOKEN")),
    cj: Boolean(Netlify.env.get("CJ_API_KEY")),
    syncee: Boolean(Netlify.env.get("SYNCEE_API_KEY")),
    dsers: Boolean(Netlify.env.get("DSERS_API_KEY")),
  };
}


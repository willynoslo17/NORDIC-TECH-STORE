/* Nordic supplier bridge: CJ / Printify / Gelato / Printful catalogs load in parallel and are shown together as one
   storefront grid ("Alle produkter"). Each source is rendered as soon as it arrives; supplier data stays internal. */
(function () {
  "use strict";

  const ENDPOINTS = {
    cj: "/api/cj-products",
    printify: "/api/printify-products",
    gelato: "/api/gelato-products",
    printful: "/api/printful-products"
  };
  /** CJ search keywords → Printify/Gelato/Printful sector keys */
  const POD_QUERY_ALIAS = {
    "phone accessories": "electronics",
    "mobile accessories": "electronics",
    "computer accessories": "electronics",
    "smart home": "electronics",
    "wearable technology": "electronics",
    "wearables": "electronics",
    "educational toys": "toys",
    "montessori toys": "toys",
    "stem toys": "toys",
    "baby toys": "toys",
    "hair care": "beauty",
    "skincare": "beauty",
    "perfume": "beauty",
    "facial": "beauty",
    "cosmetic": "beauty"
  };
  function podQuery(q) {
    const key = String(q || "").toLowerCase();
    return POD_QUERY_ALIAS[key] || key;
  }
  /* Absolute paths so /pe/ (and other subfolders) resolve the same public catalog files. */
  const LOCAL_FILES = {
    cj: "/catalog/selected-products.json",
    printify: "/catalog/printify-selected.json",
    printifyFallback: "/catalog/printify-products.json",
    gelato: "/catalog/gelato-products.json",
    printful: "/catalog/printful-products.json"
  };
  const ID_BASE = { cj: 10001, printify: 20001, gelato: 30001, printful: 40001 };
  const LABELS = { cj: "CJ", printify: "Printify", gelato: "Gelato", printful: "Printful" };
  /** A slow supplier endpoint never blocks the grid: after this many ms its local fallback is used instead. */
  const SOURCE_TIMEOUT_MS = 8000;
  /** Gelato (live prices from the Gelato API) loads in the background and may take longer; it never delays readiness. */
  const BACKGROUND_TIMEOUT_MS = 30000;
  const BACKGROUND_SOURCES = ["gelato"];
  const SOURCE_ORDER = ["cj", "printify", "gelato", "printful"];
  /** Customer-facing (Norwegian) names for supplier category values. Per-store overrides: config.catMap. */
  const CAT_NB = {
    "apparel": "Klær",
    "kids apparel": "Barneklær",
    "baby apparel": "Babyklær",
    "mugs": "Krus",
    "posters": "Plakater",
    "canvas": "Lerretsbilder",
    "bags": "Vesker",
    "tote-bags": "Handlenett",
    "stationery": "Papirvarer",
    "accessories": "Tilbehør",
    "home": "Hjem",
    "phone-cases": "Mobildeksler"
  };
  const BRAND_COLORS = {
    cj: "#0f766e",
    printify: "#7c3aed",
    gelato: "#ea580c",
    printful: "#2563eb"
  };

  window.nordicCatalogs = { cj: [], printify: [], gelato: [], printful: [] };
  window.nordicActiveSupplier = "cj";

  /* Prices come only from the server: catalog APIs and the public /catalog fallback JSON carry the final NOK price
     (`priceNok`, rule in functions/_shared/pricing.ts) and never the supplier cost. Items without a price are hidden. */
  /** `base` stays EUR-denominated (pages show base x market rate); NOK 11.7 per EUR, same as markets.NO.rate. */
  const NOK_PER_EUR = 11.7;

  function priceNok(item) {
    const nok = Number(item && item.priceNok);
    return Number.isFinite(nok) && nok > 0 ? nok : 0;
  }

  /* Supplier/catalog status is internal: kept on <html data-catalog-status> for debugging, never shown to customers. */
  function setStatus(text, online) {
    document.documentElement.setAttribute("data-catalog-status", (online ? "online: " : "offline: ") + text);
  }

  function curated(item, index, category, provider) {
    const nok = priceNok(item);
    const baseId = ID_BASE[provider] || 90001;
    const rawId = item.id != null ? String(item.id) : "";
    /* UI ids must be exact numbers. Long supplier ids (19-digit CJ pids) are never rounded:
       the UI uses their last 15 digits and the full id stays a string in externalId / cjPid. */
    const tail = /^\d+$/.test(rawId) ? (Number.isSafeInteger(Number(rawId)) ? Number(rawId) : Number(rawId.slice(-15))) : 0;
    const numericId = tail > 0 ? tail : null;
    const out = {
      id: numericId != null ? numericId : baseId + index,
      externalId: String(item.id || item.gelatoProductUid || item.printfulProductId || item.printifyProductId || ""),
      name: item.name || (LABELS[provider] || "Supplier") + " product",
      cat: item.category || item.cat || category,
      base: nok > 0 ? nok / NOK_PER_EUR : 0,
      priceNok: nok,
      v: "v" + ((index % 4) + 1),
      tag: LABELS[provider] || provider,
      brand: item.brand || LABELS[provider] || provider,
      image: item.image || "",
      sku: item.sku || "",
      supplier: item.supplier || LABELS[provider] || provider,
      provider: provider,
      badgeColor: BRAND_COLORS[provider] || "#334155"
    };
    if (item.printifyProductId) out.printifyProductId = item.printifyProductId;
    if (item.printifyVariantId) out.printifyVariantId = item.printifyVariantId;
    if (item.printfulProductId) out.printfulProductId = item.printfulProductId;
    if (item.gelatoProductUid) out.gelatoProductUid = item.gelatoProductUid;
    if (item.printfulSyncVariantId) out.printfulSyncVariantId = String(item.printfulSyncVariantId);
    if (item.printfulVariantId) out.printfulVariantId = String(item.printfulVariantId);
    if (item.printfulSource) out.printfulSource = String(item.printfulSource);
    if (provider === "cj" && rawId) out.cjPid = rawId;
    if (item.quote) out.quote = String(item.quote);
    return out;
  }

  async function loadJson(url) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return [];
      const data = await response.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.products)) return data.products;
      return [];
    } catch (_) {
      return [];
    }
  }

  async function loadApiProducts(endpoint, ms) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), ms || SOURCE_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, { signal: timeout.signal, cache: "no-store" });
      if (!response.ok) return [];
      const payload = await response.json();
      if (Array.isArray(payload.products)) return payload.products;
      if (Array.isArray(payload)) return payload;
      return [];
    } catch (_) {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  /* Items whose name matches config.cjExclude are hidden unless CJ reports a CE certification (store setting). */
  function cjAllowed(config) {
    if (!config || !config.cjExclude) return () => true;
    const rx = new RegExp(config.cjExclude, "i");
    return item => !rx.test(String(item.name || item.nameEn || "")) || item.hasCECertification === true || item.hasCECertification === "true";
  }

  async function loadCjSelected(config) {
    const allowed = cjAllowed(config);
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), SOURCE_TIMEOUT_MS);
    try {
      const url = ENDPOINTS.cj + "?q=" + encodeURIComponent(config.query || "");
      const response = await fetch(url, { signal: timeout.signal, cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload.products) && payload.products.length) {
          return payload.products
            .filter(allowed)
            .map((item, index) => curated({ ...item, brand: item.brand || "CJ Dropshipping", supplier: item.supplier || "CJ Dropshipping" }, index, config.category, "cj"))
            .filter(item => item.base > 0)
            .slice(0, 600); // curated set (150) + trend winners
        }
      }
    } catch (_) {
      /* fall through to local */
    } finally {
      clearTimeout(timer);
    }
    if (config.cjLocalFallback === false) return []; // store sells CJ winners only (no generic local fallback)
    const localItems = await loadJson(LOCAL_FILES.cj);
    return localItems.filter(allowed).map((item, index) => curated(item, index, config.category, "cj")).filter(item => item.base > 0).slice(0, 150);
  }

  async function loadPodCatalog(provider, category, query) {
    const q = encodeURIComponent(podQuery(query || ""));
    const apiItems = await loadApiProducts(ENDPOINTS[provider] + "?q=" + q, BACKGROUND_SOURCES.includes(provider) ? BACKGROUND_TIMEOUT_MS : SOURCE_TIMEOUT_MS);
    if (apiItems.length) {
      return apiItems.map((item, index) => curated({ ...item, provider }, index, category, provider)).filter(item => item.base > 0).slice(0, 50);
    }
    // Printify may still use curated selected JSON. Gelato/Printful NEVER use *-selected clones.
    if (provider === "printify") {
      const selected = await loadJson(LOCAL_FILES.printify);
      if (selected.length) {
        return selected.map((item, index) => curated(item, index, category, provider)).filter(item => item.base > 0).slice(0, 50);
      }
      const fallback = await loadJson(LOCAL_FILES.printifyFallback);
      return fallback.map((item, index) => curated(item, index, category, provider)).filter(item => item.base > 0).slice(0, 50);
    }
    // Empty local fallback only (never gelato-selected / printful-selected)
    const localItems = await loadJson(LOCAL_FILES[provider]);
    return localItems.map((item, index) => curated(item, index, category, provider)).filter(item => item.base > 0).slice(0, 50);
  }

  /* Cart rendering looks items up with list.find(), so find() on the storefront list also searches every
     supplier catalog (e.g. items restored from a saved cart that are de-duplicated out of the grid). */
  /* Size/colour lines chosen in variant-picker.js: never in the grid, but found by the cart. */
  function variantPool(mapper) {
    const extra = typeof window.nordicVariantItems === "function" ? window.nordicVariantItems() : [];
    return mapper ? extra.map(mapper) : extra;
  }

  function withCrossCatalogFind(list, mapper) {
    const all = Object.keys(window.nordicCatalogs || {}).flatMap(k => Array.isArray(window.nordicCatalogs[k]) ? window.nordicCatalogs[k] : []);
    const pool = mapper ? all.map(mapper) : all;
    Object.defineProperty(list, "find", {
      value: function (predicate, thisArg) { return Array.prototype.find.call(this, predicate, thisArg) || pool.find(predicate, thisArg) || variantPool(mapper).find(predicate, thisArg); },
      configurable: true, writable: true, enumerable: false
    });
    return list;
  }

  /* Printful/Gelato categories are product-type names ("All-Over Print Tote Bag"): group them by keyword. */
  const POD_CAT_RULES = [
    [/\b(mugs?|cups?|tumblers?|bottles?)\b/i, "Krus"],
    [/\b(posters?|prints?|canvas|framed|wall art)\b/i, "Plakater"],
    [/\b(totes?|bags?|backpacks?|fanny|pouch)\b/i, "Vesker"],
    [/\b(t-?shirts?|tees?|hoodies?|sweatshirts?|crewnecks?|shirts?|tank|leggings|joggers|shorts|dress|onesie|bodysuit|apparel|socks)\b/i, "Klær"],
    [/\b(phone|iphone|samsung|case)\b/i, "Mobildeksler"],
    [/\b(notebooks?|journals?|stickers?|cards?|stationery)\b/i, "Papirvarer"],
    [/\b(hats?|caps?|beanies?|bucket)\b/i, "Tilbehør"],
    [/\b(pillows?|blankets?|towels?|mats?|aprons?|candles?|ornaments?)\b/i, "Hjem"]
  ];
  function podCategory(item) {
    const text = String(item.cat || "") + " " + String(item.name || "");
    const hit = POD_CAT_RULES.find(rule => rule[0].test(text));
    return hit ? hit[1] : "Tilbehør";
  }

  function catLabel(item, provider, cfg) {
    const raw = String(item.cat || "").trim();
    const key = raw.toLowerCase();
    if (cfg.catMap && cfg.catMap[key]) return cfg.catMap[key];
    /* CJ "category" is only the store sector / search word (e.g. "beauty"): use the store's own category name. */
    if (provider === "cj" || !key || key === String(cfg.query || "").toLowerCase() || key === podQuery(cfg.query)) return cfg.category || raw;
    if (CAT_NB[key]) return CAT_NB[key];
    if (provider === "printful" || provider === "gelato") return podCategory(item);
    return raw;
  }

  /* Storefront rule (owner, 2026-10-02): every product that has an image is shown. */
  function storefrontItem() {
    return item => Boolean(item && item.image);
  }

  /** One grid with every supplier (fixed order); only the very same product (supplier + id) is listed once. */
  function storefrontList() {
    const seen = new Set();
    const out = [];
    SOURCE_ORDER.forEach(key => {
      (window.nordicCatalogs[key] || []).forEach(item => {
        const k = key + "|" + String(item.externalId || item.id);
        if (seen.has(k)) return;
        seen.add(k);
        out.push(item);
      });
    });
    return out;
  }

  function applyStorefront() {
    const list = withCrossCatalogFind(storefrontList());
    window.nordicActiveSupplier = "all";
    if (typeof products !== "undefined") {
      try { products = list; } catch (_) { window.products = list; }
    } else {
      window.products = list;
    }
    if (typeof data !== "undefined") {
      try {
        const toData = x => ({ id: x.id, n: x.name, c: x.cat, p: x.base, image: x.image, sku: x.sku, provider: x.provider, brand: x.brand });
        data = withCrossCatalogFind(list.map(toData), toData);
      } catch (_) {}
    }
    /* Keep the customer's chosen category filter while more products arrive (reset only if it no longer exists). */
    const cats = new Set(list.map(x => x.cat));
    if (typeof filter !== "undefined") { try { if (filter !== "All" && filter !== "Todos" && !cats.has(filter)) filter = "All"; } catch (_) {} }
    if (typeof f !== "undefined") { try { if (f !== "All" && !cats.has(f)) f = "All"; } catch (_) {} }
    if (typeof renderFilters === "function") renderFilters();
    else if (typeof rf === "function") rf();
    if (typeof renderProducts === "function") renderProducts();
    else if (typeof rp === "function") rp();
    if (typeof renderCart === "function") renderCart();
    else if (typeof rc === "function") rc();
    /* Re-apply a chosen sort order (commerce-runtime.js) to the appended products. */
    const sort = document.getElementById("nordicProductSort");
    if (sort && sort.value && sort.value !== "featured") sort.dispatchEvent(new Event("change"));
    setStatus("all · " + list.length, list.length > 0);
    try { window.dispatchEvent(new Event("nordic:catalog-updated")); } catch (_) {}
    return list;
  }

  window.setNordicSupplier = function () { return applyStorefront(); };

  window.loadNordicCatalog = async function (config) {
    const cfg = config || {};
    const category = cfg.category || "General";
    const query = cfg.query || "";
    const keep = storefrontItem();
    const loaders = {
      cj: cfg.cj === false ? Promise.resolve([]) : loadCjSelected(cfg), // store opted out of CJ: no request
      printify: loadPodCatalog("printify", category, query),
      gelato: loadPodCatalog("gelato", category, query),
      printful: loadPodCatalog("printful", category, query)
    };
    window.nordicCatalogs = { cj: [], printify: [], gelato: [], printful: [] };
    /* Render each supplier as soon as it answers (or falls back after its timeout). */
    const settle = key => loaders[key]
      .catch(() => [])
      .then(list => {
        window.nordicCatalogs[key] = (Array.isArray(list) ? list : [])
          .map(item => { const cat = catLabel(item, key, cfg); return { ...item, cat, tag: cat }; })
          .filter(keep);
        applyStorefront();
      });
    const background = SOURCE_ORDER.filter(key => BACKGROUND_SOURCES.includes(key)).map(settle);
    /* Search, saved cart and checkout start once the fast sources are in; background sources are added later. */
    await Promise.allSettled(SOURCE_ORDER.filter(key => !BACKGROUND_SOURCES.includes(key)).map(settle));
    const active = applyStorefront();
    window.nordicCatalogReady = true;
    try { window.dispatchEvent(new Event("nordic:catalog-ready")); } catch (_) {}
    if (!active.length) setStatus("local catalog, suppliers pending", false);
    Promise.allSettled(background).then(() => {
      applyStorefront();
      window.nordicCatalogComplete = true;
      try { window.dispatchEvent(new Event("nordic:catalog-complete")); } catch (_) {}
    });
    return active;
  };

  /* Kept for compatibility with older pages; supplier sourcing status is internal and no longer shown. */
  window.showGermanDropStatus = function () {};
})();

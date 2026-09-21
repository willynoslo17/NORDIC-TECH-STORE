/* Nordic supplier bridge: separate CJ / Printify / Gelato / Printful catalogs (no blend). Sector query mirrors CJ. */
(function () {
  "use strict";

  const ENDPOINTS = {
    cj: "/api/cj-products",
    printify: "/api/printify-products",
    gelato: "/api/gelato-products",
    printful: "/api/printful-products"
  };
  const LOCAL_FILES = {
    cj: "catalog/selected-products.json",
    printify: "catalog/printify-selected.json",
    printifyFallback: "catalog/printify-products.json",
    gelato: "catalog/gelato-products.json",
    printful: "catalog/printful-products.json"
  };
  const ID_BASE = { cj: 10001, printify: 20001, gelato: 30001, printful: 40001 };
  const LABELS = { cj: "CJ", printify: "Printify", gelato: "Gelato", printful: "Printful" };
  const BRAND_COLORS = {
    cj: "#0f766e",
    printify: "#7c3aed",
    gelato: "#ea580c",
    printful: "#2563eb"
  };

  window.nordicCatalogs = { cj: [], printify: [], gelato: [], printful: [] };
  window.nordicActiveSupplier = "cj";

  function rows(payload) {
    const content = payload && payload.data && payload.data.content;
    if (!Array.isArray(content)) return [];
    return content.flatMap(group => Array.isArray(group.productList) ? group.productList : []);
  }

  function price(value) {
    const amount = Number.parseFloat(String(value || "").split("-")[0]);
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 2.2 * 100) / 100 : 0;
  }

  function setStatus(text, online) {
    let badge = document.querySelector("[data-supplier-status]");
    if (!badge) {
      badge = document.createElement("div");
      badge.dataset.supplierStatus = "";
      badge.style.cssText = "position:fixed;left:14px;bottom:14px;z-index:25;padding:8px 11px;border-radius:999px;background:#fff;border:1px solid #d8dee8;box-shadow:0 4px 18px #0002;font:700 11px/1.2 Inter,Arial,sans-serif;color:#334155";
      document.body.appendChild(badge);
    }
    badge.textContent = (online ? "● " : "○ ") + text;
    badge.style.color = online ? "#047857" : "#64748b";
  }

  function curated(item, index, category, provider) {
    const amount = Number(item.suggestedRetailUsd || item.supplierPriceUsd || item.base || 0);
    const baseId = ID_BASE[provider] || 90001;
    const numericId = item.id != null && Number.isFinite(Number(item.id)) ? Number(item.id) : null;
    const out = {
      id: numericId != null ? numericId : baseId + index,
      externalId: String(item.id || item.gelatoProductUid || item.printfulProductId || item.printifyProductId || ""),
      name: item.name || (LABELS[provider] || "Supplier") + " product",
      cat: item.category || item.cat || category,
      base: amount > 0 ? amount : 0,
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

  async function loadApiProducts(endpoint) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 20000);
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

  async function loadCjSelected(config) {
    const localItems = await loadJson(LOCAL_FILES.cj);
    if (localItems.length) {
      return localItems.map((item, index) => curated(item, index, config.category, "cj")).filter(item => item.base > 0).slice(0, 50);
    }
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 7000);
    try {
      const url = ENDPOINTS.cj + "?q=" + encodeURIComponent(config.query || "");
      const response = await fetch(url, { signal: timeout.signal });
      if (!response.ok) throw new Error("CJ unavailable");
      const payload = await response.json();
      return rows(payload)
        .filter(item => item.bigImage && price(item.sellPrice || item.nowPrice) > 0 && price(item.sellPrice || item.nowPrice) <= 1000)
        .sort((a, b) => ((b.listedNum || 0) + Math.min(b.warehouseInventoryNum || 0, 5000) / 10) - ((a.listedNum || 0) + Math.min(a.warehouseInventoryNum || 0, 5000) / 10))
        .map((item, index) => ({
          id: 10001 + index,
          name: item.nameEn || item.name || "CJ product",
          cat: config.category,
          base: price(item.sellPrice || item.nowPrice),
          v: "v" + ((index % 4) + 1),
          tag: "CJ",
          brand: "CJ Dropshipping",
          image: item.bigImage || item.image || "",
          sku: item.sku || "",
          supplier: "CJ Dropshipping",
          provider: "cj",
          badgeColor: BRAND_COLORS.cj
        })).filter(item => item.base > 0).slice(0, 50);
    } catch (_) {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadPodCatalog(provider, category, query) {
    const q = encodeURIComponent(query || "");
    const apiItems = await loadApiProducts(ENDPOINTS[provider] + "?q=" + q);
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

  function decorateProductCards(provider) {
    const color = BRAND_COLORS[provider] || "#334155";
    const label = LABELS[provider] || provider;
    document.querySelectorAll("[data-product-card], .product-card, .card, article.product").forEach((card) => {
      if (card.querySelector("[data-provider-badge]")) return;
      const badge = document.createElement("span");
      badge.dataset.providerBadge = provider;
      badge.textContent = label;
      badge.style.cssText = "display:inline-block;margin:6px 0 0;padding:3px 8px;border-radius:999px;font:700 10px/1 Inter,Arial,sans-serif;letter-spacing:.02em;color:#fff;background:" + color;
      const title = card.querySelector("h3,h4,.title,.name") || card;
      title.appendChild(badge);
    });
  }

  function applyActiveCatalog(supplier) {
    const key = LABELS[supplier] ? supplier : "cj";
    window.nordicActiveSupplier = key;
    const list = (window.nordicCatalogs[key] || []).slice();
    if (typeof products !== "undefined") {
      try { products = list; } catch (_) { window.products = list; }
    } else {
      window.products = list;
    }
    if (typeof data !== "undefined") {
      try {
        data = list.map(x => ({ id: x.id, n: x.name, c: x.cat, p: x.base, image: x.image, sku: x.sku, provider: x.provider || key, brand: x.brand || LABELS[key] }));
      } catch (_) {}
    }
    if (typeof filter !== "undefined") { try { filter = "All"; } catch (_) {} }
    if (typeof f !== "undefined") { try { f = "All"; } catch (_) {} }
    if (typeof renderFilters === "function") renderFilters();
    else if (typeof rf === "function") rf();
    if (typeof renderProducts === "function") renderProducts();
    else if (typeof rp === "function") rp();
    if (typeof renderCart === "function") renderCart();
    else if (typeof rc === "function") rc();
    document.querySelectorAll("[data-supplier-switch]").forEach(btn => {
      const active = btn.getAttribute("data-supplier-switch") === key;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      if (active) {
        btn.style.outline = "2px solid " + (BRAND_COLORS[key] || "#fff");
        btn.style.background = BRAND_COLORS[key] || "";
        btn.style.color = "#fff";
      } else {
        btn.style.outline = "";
        btn.style.background = "";
        btn.style.color = "";
      }
    });
    const count = list.length;
    setStatus(LABELS[key] + " · " + count + " productos", count > 0);
    setTimeout(() => decorateProductCards(key), 50);
    return list;
  }

  function mountSwitcher() {
    if (document.querySelector("[data-supplier-switcher]")) return;
    const bar = document.createElement("div");
    bar.dataset.supplierSwitcher = "";
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Supplier catalog");
    bar.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;padding:10px 5%;position:sticky;top:64px;z-index:20;background:rgba(7,9,13,.92);backdrop-filter:blur(10px);border-bottom:1px solid #1c2633";
    Object.keys(LABELS).forEach(key => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (key === "cj" ? " active" : "");
      btn.dataset.supplierSwitch = key;
      btn.textContent = LABELS[key];
      btn.title = LABELS[key] + " catalog";
      btn.setAttribute("aria-pressed", key === "cj" ? "true" : "false");
      btn.onclick = () => applyActiveCatalog(key);
      bar.appendChild(btn);
    });
    const shop = document.getElementById("shop") || document.getElementById("products");
    if (shop && shop.parentNode) shop.parentNode.insertBefore(bar, shop);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  window.setNordicSupplier = applyActiveCatalog;

  window.loadNordicCatalog = async function (config) {
    const cfg = config || {};
    const category = cfg.category || "General";
    const query = cfg.query || "";
    const [cj, printify, gelato, printful] = await Promise.all([
      loadCjSelected(cfg),
      loadPodCatalog("printify", category, query),
      loadPodCatalog("gelato", category, query),
      loadPodCatalog("printful", category, query)
    ]);
    window.nordicCatalogs = { cj, printify, gelato, printful };
    mountSwitcher();
    const active = applyActiveCatalog("cj");
    if (!cj.length && !printify.length && !gelato.length && !printful.length) {
      setStatus("Catálogo local · proveedores en espera", false);
      return [];
    }
    return active;
  };

  window.showGermanDropStatus = function (enabled) {
    if (!enabled) return;
    const note = document.createElement("meta");
    note.name = "nordic-german-drop";
    note.content = "authorized-manual-catalog";
    document.head.appendChild(note);
    const badge = document.createElement("div");
    badge.textContent = "German Drop · abastecimiento activo";
    badge.style.cssText = "position:fixed;left:14px;bottom:52px;z-index:25;padding:7px 11px;border-radius:999px;background:#fff;border:1px solid #d8dee8;box-shadow:0 4px 18px #0002;font:700 11px/1.2 Inter,Arial,sans-serif;color:#334155";
    document.body.appendChild(badge);
  };
})();

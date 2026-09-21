/* Nordic supplier bridge: CJ selected catalog + Printify selected catalog (merge). */
(function () {
  "use strict";

  const CJ_ENDPOINT = "/api/cj-products";

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

  function curatedCj(item, index, category) {
    const amount = Number(item.suggestedRetailUsd || item.supplierPriceUsd || 0);
    return {
      id: 10001 + index,
      name: item.name || "Selected product",
      cat: item.category || category,
      base: amount > 0 ? amount : 1,
      v: "v" + ((index % 4) + 1),
      tag: "CJ Selected",
      image: item.image || "",
      sku: item.sku || "",
      supplier: item.supplier || "CJ Dropshipping",
      provider: "cj"
    };
  }

  function curatedPrintify(item, index, category) {
    const amount = Number(item.suggestedRetailUsd || item.supplierPriceUsd || 0);
    return {
      id: 20001 + index,
      name: item.name || "Printify product",
      cat: item.category || category,
      base: amount > 0 ? amount : 1,
      v: "v" + ((index % 4) + 1),
      tag: "Printify",
      image: item.image || "",
      sku: item.sku || String(item.printifyVariantId || ""),
      supplier: "Printify",
      provider: "printify",
      printifyProductId: item.printifyProductId || "",
      printifyVariantId: item.printifyVariantId || ""
    };
  }

  async function loadJson(url) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  async function loadPrintifySelected(category) {
    const items = await loadJson("catalog/printify-products.json");
    return items.map((item, index) => curatedPrintify(item, index, category)).filter(item => item.base > 0);
  }

  async function loadCjSelected(config) {
    const localItems = await loadJson("catalog/selected-products.json");
    if (localItems.length) {
      return localItems.map((item, index) => curatedCj(item, index, config.category)).slice(0, 30);
    }
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 7000);
    try {
      const url = CJ_ENDPOINT + "?q=" + encodeURIComponent(config.query);
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
          tag: "CJ Selected",
          image: item.bigImage || item.image || "",
          sku: item.sku || "",
          supplier: "CJ Dropshipping",
          provider: "cj"
        })).filter(item => item.base > 0).slice(0, 30);
    } catch (_) {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  window.loadNordicCatalog = async function (config) {
    const [cj, printify] = await Promise.all([
      loadCjSelected(config || {}),
      loadPrintifySelected((config && config.category) || "General")
    ]);
    const merged = [...cj, ...printify];
    if (!merged.length) {
      setStatus("Catálogo local · proveedores en espera", false);
      return [];
    }
    const parts = [];
    if (cj.length) parts.push("CJ " + cj.length);
    if (printify.length) parts.push("Printify " + printify.length);
    setStatus(parts.join(" + ") + " · " + merged.length + " productos", true);
    return merged;
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

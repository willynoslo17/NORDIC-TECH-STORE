/* Nordic supplier bridge: CJ live catalog with an automatic local fallback. */
(function () {
  "use strict";

  const CJ_ENDPOINT = "https://nordic-beauty-perfumes.pages.dev/api/cj-products";

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

  function curated(item, index, category) {
    const amount = Number(item.suggestedRetailUsd || item.supplierPriceUsd || 0);
    return {
      id: 10001 + index,
      name: item.name || "Selected product",
      cat: item.category || category,
      base: amount > 0 ? amount : 1,
      v: "v" + ((index % 4) + 1),
      tag: "CJ Selected",
      image: item.image || "",
      sku: item.sku || ""
    };
  }

  window.loadNordicCatalog = async function (config) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 7000);
    try {
      const localResponse = await fetch("catalog/selected-products.json", { cache: "no-store" });
      if (localResponse.ok) {
        const localItems = await localResponse.json();
        if (Array.isArray(localItems) && localItems.length) {
          const selected = localItems.map((item, index) => curated(item, index, config.category)).slice(0, 30);
          setStatus("CJ catálogo seleccionado · " + selected.length + " productos", true);
          return selected;
        }
      }
      const url = CJ_ENDPOINT + "?q=" + encodeURIComponent(config.query);
      const response = await fetch(url, { signal: timeout.signal });
      if (!response.ok) throw new Error("CJ unavailable");
      const payload = await response.json();
      const products = rows(payload)
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
        sku: item.sku || ""
      })).filter(item => item.base > 0).slice(0, 30);
      if (!products.length) throw new Error("Empty CJ catalog");
      setStatus("CJ conectado · " + products.length + " productos", true);
      return products;
    } catch (_) {
      setStatus("Catálogo local · CJ en espera", false);
      return [];
    } finally {
      clearTimeout(timer);
    }
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

/* Novverk region switch: Europa ↔ Perú (localStorage + header). Norwegian storefront content stays unchanged. */
(function () {
  "use strict";

  const KEY = "novverk-region";
  const EUROPA = "europa";
  const PERU = "peru";
  const EUROPA_PATH = "/";
  const PERU_PATH = "/pe/";

  function read() {
    try {
      const v = String(localStorage.getItem(KEY) || "").toLowerCase();
      if (v === PERU || v === "pe") return PERU;
      if (v === EUROPA || v === "eu" || v === "europe") return EUROPA;
    } catch (_) {}
    return "";
  }

  function write(region) {
    try { localStorage.setItem(KEY, region); } catch (_) {}
  }

  function onPeruPath() {
    const p = location.pathname.replace(/\/+$/, "") || "/";
    return p === "/pe" || p.indexOf("/pe/") === 0;
  }

  function go(region) {
    write(region);
    const wantPeru = region === PERU;
    if (wantPeru && !onPeruPath()) {
      location.assign(PERU_PATH);
      return;
    }
    if (!wantPeru && onPeruPath()) {
      location.assign(EUROPA_PATH);
    }
  }

  function mountSelect(select) {
    if (!select || select.dataset.regionBound === "1") return;
    select.dataset.regionBound = "1";
    /* UI reflects the page you are on; localStorage is updated when the user switches. */
    const current = onPeruPath() ? PERU : EUROPA;
    if (!select.options.length) {
      select.innerHTML =
        '<option value="' + EUROPA + '">Europa</option>' +
        '<option value="' + PERU + '">Perú</option>';
    }
    select.value = current;
    select.addEventListener("change", function () {
      go(select.value === PERU ? PERU : EUROPA);
    });
  }

  function ensureHeaderSelect() {
    let select = document.getElementById("regionSwitch");
    if (select) {
      mountSelect(select);
      return select;
    }
    const nav = document.querySelector(".navright") || document.querySelector(".nav");
    if (!nav) return null;
    select = document.createElement("select");
    select.id = "regionSwitch";
    select.className = "control marketSel";
    select.setAttribute("aria-label", onPeruPath() ? "Región" : "Region / Región");
    select.innerHTML =
      '<option value="' + EUROPA + '">Europa</option>' +
      '<option value="' + PERU + '">Perú</option>';
    nav.insertBefore(select, nav.firstChild);
    mountSelect(select);
    return select;
  }

  function init() {
    /* Preference is stored and applied by the header switch only (no auto-redirect). */
    if (onPeruPath()) write(PERU);
    ensureHeaderSelect();
  }

  window.NovverkRegion = { KEY, read, write, go, init, onPeruPath };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

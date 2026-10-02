/* Size / colour picker for CJ products (2026-10-02).
 * "Legg i handlekurven" on a CJ product asks /api/cj-variants for its real CJ variants. One variant: the product is
 * added exactly as before. Several: the customer picks size / colour (with the price of that variant) and a cart line
 * for that variant is added. Each variant line carries its own server-signed quote, so checkout charges that variant's
 * price (cost x 2.5, min 99, ending in 9, recomputed server-side) and the order goes to the supplier with its vid.
 * Lines in the cart get an "Endre størrelse/farge" button. Variant lines never appear in the product grid.
 */
(function () {
  "use strict";
  const STORE = (document.title || "store").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const REG_KEY = "nordic-variants:" + STORE;
  const CART_KEY = "nordic-cart:" + STORE;
  const NOK_PER_EUR = 11.7;
  const REFRESH_AGE = 6 * 3600e3;
  const MAX_AGE = 40 * 3600e3;
  const ID_BASE = 8000000000000000;

  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  let registry = read(REG_KEY, {});
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) registry = {};
  const saveRegistry = () => write(REG_KEY, registry);

  window.nordicVariantItem = id => registry[String(id)] || null;
  window.nordicVariantItems = () => Object.keys(registry).map(k => registry[k]);

  function hash32(s, seed) {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  /* Numeric (safe-integer) id, so the stores' inline onclick="qty(id,1)" handlers keep working. */
  function variantId(vid) { return ID_BASE + hash32(String(vid), 2166136261) * 16384 + (hash32(String(vid), 33554467) & 16383); }

  function cartObject() {
    if (typeof cartState !== "undefined") return cartState;
    if (typeof cart !== "undefined" && !(cart instanceof Element)) return cart;
    return null;
  }
  function redrawCart() {
    if (typeof renderCart === "function") renderCart();
    else if (typeof rc === "function") rc();
  }
  function saveCart() {
    if (window.NordicCommerce && typeof window.NordicCommerce.saveCart === "function") return window.NordicCommerce.saveCart();
    const c = cartObject();
    if (c) setTimeout(() => write(CART_KEY, { ...read(CART_KEY, {}), ...c }), 0);
  }
  function formatNok(nok) {
    try { if (typeof money === "function") return money(nok / NOK_PER_EUR); } catch (_) {}
    return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(nok);
  }

  /* CJ product (with its signed quote) behind a grid id. */
  function parentById(id) {
    const list = (window.nordicCatalogs && window.nordicCatalogs.cj) || [];
    const hit = list.find(item => String(item.id) === String(id));
    return hit && hit.quote ? hit : null;
  }

  const lists = new Map();
  function fetchVariants(parent) {
    const key = String(parent.id);
    if (!lists.has(key)) {
      const job = fetch("/api/cj-variants?quote=" + encodeURIComponent(parent.quote), { headers: { accept: "application/json" } })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
        .then(d => { if (!d || !d.ok) lists.delete(key); return d && d.ok ? d : null; });
      lists.set(key, job);
    }
    return lists.get(key);
  }
  const multi = d => Boolean(d && !d.single && Array.isArray(d.variants) && d.variants.length > 1);

  function register(parent, v) {
    const id = variantId(v.vid);
    const base = parent.name ? String(parent.name).replace(/\s+–\s+.*$/, "") : "Produkt";
    registry[String(id)] = {
      ...parent,
      id,
      parentId: parent.id,
      cjVid: v.vid,
      variantLabel: v.label,
      name: base + " – " + v.label,
      base: v.priceNok / NOK_PER_EUR,
      priceNok: v.priceNok,
      image: v.image || parent.image || "",
      sku: "",
      quote: v.quote,
      t: Date.now()
    };
    saveRegistry();
    return registry[String(id)];
  }

  function nativeAdd(id) {
    if (typeof add === "function") add(id);
    saveCart();
  }

  // ------------------------------------------------------------------------------------------ modal
  let modal;
  function ensureModal() {
    if (modal) return modal;
    const style = document.createElement("style");
    style.textContent = ".nv-wrap{position:fixed;inset:0;z-index:95;background:#0009;display:none;place-items:center;padding:16px}.nv-wrap.open{display:grid}.nv-card{width:min(460px,100%);max-height:92vh;overflow:auto;background:#fff;color:#172033;border-radius:16px;padding:20px;box-shadow:0 30px 90px #0006;font-family:inherit}.nv-card img{width:100%;max-height:300px;object-fit:contain;border-radius:12px;background:#f3f5f8}.nv-card h3{margin:12px 0 4px;font-size:18px;line-height:1.3}.nv-card label{display:block;font-size:13px;font-weight:700;margin:12px 0 6px}.nv-card select{width:100%;padding:11px;border:1px solid #c5cdd8;border-radius:8px;background:#fff;color:#172033;font:inherit}.nv-price{font-size:22px;font-weight:800;margin:14px 0 4px}.nv-note{font-size:12px;color:#5b6678}.nv-actions{display:flex;gap:10px;margin-top:16px}.nv-actions button{flex:1;padding:13px;border-radius:10px;border:1px solid #172033;font-weight:800;cursor:pointer;font:inherit;font-weight:800}.nv-ok{background:#172033;color:#fff}.nv-ok[disabled]{opacity:.45;cursor:not-allowed}.nv-cancel{background:#fff;color:#172033}.nv-change{display:inline-block;margin-top:6px;padding:4px 9px;border:1px solid currentColor;border-radius:999px;background:none;color:inherit;font-size:12px;cursor:pointer;opacity:.85}";
    document.head.appendChild(style);
    modal = document.createElement("div");
    modal.className = "nv-wrap";
    modal.id = "nordicVariantPicker";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Velg variant");
    modal.innerHTML = '<section class="nv-card" id="nordicVariantBody"></section>';
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && modal.classList.contains("open")) close(); });
    document.body.appendChild(modal);
    return modal;
  }
  function close() { if (modal) modal.classList.remove("open"); }
  function body() { return document.getElementById("nordicVariantBody"); }

  function showLoading(parent) {
    ensureModal();
    body().innerHTML = (parent.image ? '<img src="' + esc(parent.image) + '" alt="">' : "") + "<h3>" + esc(parent.name) + '</h3><p class="nv-note">Henter størrelser og farger …</p>';
    modal.classList.add("open");
  }

  function showPicker(parent, d, opts) {
    ensureModal();
    const options = d.options || [];
    const variants = d.variants;
    let current = variants.find(v => v.vid === opts.preselect) || variants[0];
    const selects = options.map((o, i) => '<label for="nv-opt-' + i + '">' + esc(o.name) + '</label><select id="nv-opt-' + i + '" data-i="' + i + '">' + o.values.map(v => '<option value="' + esc(v) + '">' + esc(v) + "</option>").join("") + "</select>").join("");
    body().innerHTML = '<img id="nv-img" alt=""><h3>' + esc(String(parent.name || "").replace(/\s+–\s+.*$/, "")) + "</h3>" + selects +
      '<div class="nv-price" id="nv-price"></div><div class="nv-note" id="nv-note">Pris for valgt variant, inkl. 25 % MVA.</div>' +
      '<div class="nv-actions"><button type="button" class="nv-cancel" id="nv-cancel">Avbryt</button><button type="button" class="nv-ok" id="nv-ok">' + (opts.mode === "change" ? "OPPDATER" : "LEGG I HANDLEKURVEN") + "</button></div>";
    const sel = Array.from(body().querySelectorAll("select"));
    const img = document.getElementById("nv-img");
    function show() {
      sel.forEach((s, i) => { s.value = current.values[i] || ""; });
      const src = current.image || parent.image || "";
      if (src) { img.src = src; img.style.display = ""; } else img.style.display = "none";
      img.alt = parent.name + " – " + current.label;
      document.getElementById("nv-price").textContent = formatNok(current.priceNok);
    }
    sel.forEach(s => s.addEventListener("change", () => {
      const i = Number(s.dataset.i);
      const wanted = sel.map(x => x.value);
      current = variants.find(v => v.values.every((val, k) => val === wanted[k])) || variants.find(v => v.values[i] === s.value) || current;
      show();
    }));
    document.getElementById("nv-cancel").onclick = close;
    document.getElementById("nv-ok").onclick = () => {
      const item = register(parent, current);
      close();
      if (opts.mode === "change") replaceLine(opts.fromId, item.id);
      else nativeAdd(item.id);
    };
    show();
    modal.classList.add("open");
    setTimeout(() => { const first = sel[0] || document.getElementById("nv-ok"); if (first) first.focus(); }, 0);
  }

  function choose(parent, opts) {
    let shown = false;
    const timer = setTimeout(() => { shown = true; showLoading(parent); }, 200);
    fetchVariants(parent).then(d => {
      clearTimeout(timer);
      if (multi(d)) return showPicker(parent, d, opts);
      if (shown) close();
      if (opts.mode !== "change") nativeAdd(parent.id); /* single variant (or lookup failed): default behaviour */
    });
  }

  function replaceLine(fromId, toId) {
    const c = cartObject();
    if (!c) return;
    const q = Number(c[fromId]) || 1;
    if (String(fromId) !== String(toId)) delete c[fromId];
    c[toId] = String(fromId) === String(toId) ? q : (Number(c[toId]) || 0) + q;
    redrawCart();
    saveCart();
  }

  // Grid buttons: intercepted in the capture phase, before the inline onclick="add(id)".
  document.addEventListener("click", event => {
    const btn = event.target && event.target.closest ? event.target.closest(".add") : null;
    if (!btn) return;
    const m = /\badd\((\d+)\)/.exec(btn.getAttribute("onclick") || "");
    if (!m || Number(m[1]) >= ID_BASE) return;
    const parent = parentById(m[1]);
    if (!parent) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    choose(parent, { mode: "add" });
  }, true);

  // Cart lines: "Endre størrelse/farge" (variant lines) / "Velg størrelse/farge" (CJ products with several variants).
  function lineId(line) {
    if (line.dataset && line.dataset.id) return line.dataset.id;
    if (!line.parentElement || line.parentElement.id !== "cartItems") return "";
    const b = line.querySelector('[onclick^="qty("]');
    const m = b ? /qty\((\d+)\s*,/.exec(b.getAttribute("onclick")) : null;
    return m ? m[1] : "";
  }
  function addButton(line, label, onClick) {
    if (line.querySelector(".nv-change")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "nv-change";
    b.textContent = label;
    b.onclick = e => { e.stopPropagation(); onClick(); };
    const target = line.querySelector("strong,span") || line;
    target.insertAdjacentElement("afterend", b);
  }
  function decorateCart() {
    document.querySelectorAll("#cartItems > div, #cart > div").forEach(line => {
      const id = lineId(line);
      if (!id) return;
      const v = registry[id];
      if (v) {
        const parent = parentById(v.parentId);
        if (parent) addButton(line, "Endre størrelse/farge", () => choose(parent, { mode: "change", fromId: id, preselect: v.cjVid }));
        return;
      }
      const parent = parentById(id);
      if (!parent) return;
      fetchVariants(parent).then(d => { if (multi(d) && line.isConnected) addButton(line, "Velg størrelse/farge", () => choose(parent, { mode: "change", fromId: id })); });
    });
  }
  let pending = 0;
  const schedule = () => { clearTimeout(pending); pending = setTimeout(decorateCart, 30); };
  function watchCart() {
    ["cartItems", "cart"].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.dataset.nvWatch) { el.dataset.nvWatch = "1"; new MutationObserver(schedule).observe(el, { childList: true }); }
    });
    schedule();
  }

  // Keep saved variant lines priced with a fresh quote (quotes expire after 48 h).
  function refresh() {
    const now = Date.now();
    Object.keys(registry).forEach(id => {
      const entry = registry[id];
      if (!entry || now - (entry.t || 0) < REFRESH_AGE) return;
      const parent = parentById(entry.parentId);
      const expire = () => {
        if (now - (entry.t || 0) < MAX_AGE) return;
        const c = cartObject();
        if (c && c[id] != null && parent) replaceLine(id, parent.id);
        delete registry[id];
        saveRegistry();
      };
      if (!parent) return expire();
      fetchVariants(parent).then(d => {
        const v = d && Array.isArray(d.variants) ? d.variants.find(x => x.vid === entry.cjVid) : null;
        if (v) { register(parent, v); redrawCart(); } else expire();
      });
    });
  }

  function start() { watchCart(); refresh(); }
  if (window.nordicCatalogReady) setTimeout(start, 0);
  else window.addEventListener("nordic:catalog-ready", () => setTimeout(start, 50), { once: true });
  window.addEventListener("nordic:catalog-updated", watchCart);
  if (document.readyState !== "loading") watchCart(); else document.addEventListener("DOMContentLoaded", watchCart);
})();

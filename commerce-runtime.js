/* Nordic Commerce runtime: persistent cart, local order drafts and customer information. */
(function () {
  "use strict";

  const BRAND = "Novverk";
  const SITE_URL = "https://novverk.no/";
  const STORE = (document.title || BRAND).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const CART_KEY = "nordic-cart:" + STORE;
  const ORDER_KEY = "nordic-orders:" + STORE;
  const CONTACT_EMAILS = {
    info: "kontakt@novverk.no",
    support: "support@novverk.no",
    orders: "orders@novverk.no",
    marketing: "kontakt@novverk.no"
  };
  let started = false;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function currentProducts() {
    if (typeof products !== "undefined" && Array.isArray(products)) return products;
    if (typeof data !== "undefined" && Array.isArray(data)) return data.map(x => ({id:x.id,name:x.n,base:x.p,sku:x.sku || "",provider:x.provider || ""}));
    return [];
  }

  function cartObject() {
    if (typeof cartState !== "undefined") return cartState;
    if (typeof cart !== "undefined" && !(cart instanceof Element)) return cart;
    return {};
  }

  function setCartObject(next) {
    if (typeof cartState !== "undefined") cartState = next;
    else cart = next;
  }

  function redrawCart() {
    if (typeof renderCart === "function") renderCart();
    else if (typeof rc === "function") rc();
  }

  function productById(id) {
    return currentProducts().find(item => String(item.id) === String(id));
  }

  /* Full product record (incl. server-signed quote and supplier refs) from any supplier catalog. */
  function catalogProductById(id) {
    const catalogs = window.nordicCatalogs || {};
    for (const key of Object.keys(catalogs)) {
      const list = Array.isArray(catalogs[key]) ? catalogs[key] : [];
      const hit = list.find(item => String(item.id) === String(id));
      if (hit) return hit;
    }
    return productById(id);
  }

  /* Saved cart lines whose product has not loaded yet (background suppliers such as Gelato). */
  let pendingCart = {};

  function saveCartSoon() {
    setTimeout(() => {
      write(CART_KEY, { ...pendingCart, ...cartObject() });
    }, 0);
  }

  function addPolicies() {
    if (document.getElementById("nordicInfo")) return;
    const style = document.createElement("style");
    style.textContent = ".nordic-info-links{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px}.nordic-info-links button{border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0}.nordic-info{position:fixed;inset:0;z-index:90;background:#000a;display:none;place-items:center;padding:18px}.nordic-info.open{display:grid}.nordic-info-card{width:min(680px,100%);max-height:88vh;overflow:auto;background:#fff;color:#172033;border-radius:16px;padding:24px;box-shadow:0 30px 90px #0006}.nordic-info-card>button{float:right;border:1px solid #ccd3dd;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}.nordic-info-card h2{margin-top:8px}.nordic-info-card p,.nordic-info-card li{line-height:1.6}.nordic-info-card form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.nordic-info-card input,.nordic-info-card select{border:1px solid #ccd3dd;border-radius:8px;padding:12px;width:100%}.nordic-info-card .full{grid-column:1/-1}.nordic-info-card form .checkout{float:none}.nordic-consent{font-size:12px;line-height:1.45;display:flex;gap:8px;align-items:flex-start}.nordic-consent input{width:auto!important;margin-top:3px}.nordic-consent a,.nordic-precontract a,#nordicPriceNotice a{color:inherit;text-decoration:underline}.nordic-precontract{font-size:12px;line-height:1.5;opacity:.85}.nordic-order-id{font:800 22px/1.3 ui-monospace,monospace;letter-spacing:1px}@media(max-width:560px){.nordic-info-card form{grid-template-columns:1fr}.nordic-info-card .full{grid-column:auto}}";
    document.head.appendChild(style);
    document.body.insertAdjacentHTML("beforeend", '<div class="nordic-info" id="nordicInfo"><section class="nordic-info-card"><button type="button" id="nordicInfoClose">Lukk</button><div id="nordicInfoBody"></div></section></div>');
    /* Legal links, seller identity and address are rendered statically in the footer (see /kjopsvilkar etc.). */
    const footer = document.querySelector("footer") || document.body;
    footer.insertAdjacentHTML("beforeend", '<div class="nordic-info-links"><button type="button" data-info="orders">Ordrestatus</button></div>');
    document.getElementById("nordicInfoClose").onclick = closeInfo;
    document.getElementById("nordicInfo").onclick = event => { if (event.target.id === "nordicInfo") closeInfo(); };
  }

  function addCatalogTools() {
    const grid = document.getElementById("products");
    if (!grid || document.getElementById("nordicCatalogTools")) return;
    const tools = document.createElement("div");
    tools.id = "nordicCatalogTools";
    tools.setAttribute("role", "search");
    tools.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin:0 0 20px";
    tools.innerHTML = '<input id="nordicProductSearch" type="search" autocomplete="off" aria-label="Søk i produktene" placeholder="Søk i produktene" style="flex:1;min-width:210px;padding:12px;border:1px solid #94a3b8;border-radius:8px"><select id="nordicProductSort" aria-label="Sorter produktene" style="padding:12px;border:1px solid #94a3b8;border-radius:8px"><option value="featured">Anbefalt</option><option value="price-asc">Pris: lav til høy</option><option value="price-desc">Pris: høy til lav</option><option value="name">Navn</option></select><span id="nordicResultCount" aria-live="polite" style="align-self:center;font-size:13px;opacity:.75"></span>';
    grid.parentNode.insertBefore(tools, grid);
    const search = document.getElementById("nordicProductSearch");
    const count = document.getElementById("nordicResultCount");
    const applySearch = () => {
      const query = search.value.trim().toLowerCase();
      let visible = 0;
      Array.from(grid.children).forEach(card => {
        const show = !query || card.textContent.toLowerCase().includes(query);
        card.style.display = show ? "" : "none";
        if (show) visible++;
      });
      count.textContent = visible + " produkter";
    };
    search.addEventListener("input", applySearch);
    document.getElementById("nordicProductSort").addEventListener("change", event => {
      const list = typeof products !== "undefined" && Array.isArray(products) ? products : (typeof data !== "undefined" ? data : []);
      const priceOf = item => Number(item.base != null ? item.base : item.p || 0);
      if (event.target.value === "price-asc") list.sort((a,b) => priceOf(a)-priceOf(b));
      if (event.target.value === "price-desc") list.sort((a,b) => priceOf(b)-priceOf(a));
      if (event.target.value === "name") list.sort((a,b) => String(a.name || a.n).localeCompare(String(b.name || b.n)));
      if (typeof renderProducts === "function") renderProducts(); else if (typeof rp === "function") rp();
      applySearch();
    });
    const observer = new MutationObserver(applySearch);
    observer.observe(grid, { childList:true });
    applySearch();
  }

  function addTrustAndSeo() {
    if (!document.querySelector('meta[name="theme-color"]')) {
      const theme = document.createElement("meta");
      theme.name = "theme-color";
      theme.content = "#111827";
      document.head.appendChild(theme);
    }
    const grid = document.getElementById("products");
    if (grid && !document.getElementById("nordicPriceNotice")) {
      const notice = document.createElement("p");
      notice.id = "nordicPriceNotice";
      notice.style.cssText = "font-size:12px;line-height:1.5;opacity:.72;margin:0 0 14px";
      notice.innerHTML = 'Alle priser i NOK er inkl. 25 % MVA. Frakt 79 kr per ordre (Norge) · €7,90 (EU) · S/ 14 (Peru). Totalpris vises før betaling. <a href="/frakt-og-levering">Leveringstid</a> · <a href="/angrerett">14 dagers angrerett</a>.';
      grid.parentNode.insertBefore(notice, grid);
    }
    const schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify({"@context":"https://schema.org","@type":"OnlineStore","name":BRAND,"url":SITE_URL,"areaServed":["NO","EU","PE"],"currenciesAccepted":["NOK","EUR","PEN"]});
    document.head.appendChild(schema);
    const count = document.getElementById("count");
    if (count) count.setAttribute("aria-live", "polite");
  }

  const LEGAL_LINKS = '<p><a href="/kjopsvilkar">Kjøpsvilkår</a> · <a href="/angrerett">Angrerett</a> · <a href="/frakt-og-levering">Frakt og levering</a> · <a href="/reklamasjon">Reklamasjon</a> · <a href="/personvern">Personvern</a> · <a href="/kontakt">Kontakt</a></p>';
  const pages = { terms: '<h2>Kundeinformasjon</h2>' + LEGAL_LINKS, orders: "" };

  function openInfo(type) {
    const modal = document.getElementById("nordicInfo");
    const body = document.getElementById("nordicInfoBody");
    if (type === "orders") {
      const orders = read(ORDER_KEY, []);
      body.innerHTML = '<h2>Ordrestatus</h2>' + (orders.length ? orders.map(order => '<p><strong>'+esc(order.id)+'</strong><br>'+esc(order.date)+' · '+esc(order.market)+' · '+order.items.length+' vare(r)<br><span>Status: '+esc(order.status || "checkout-created")+'</span></p>').join("") : '<p>Ingen bestillinger er lagret på denne enheten. Spørsmål om en ordre? Skriv til '+esc(CONTACT_EMAILS.orders)+'.</p>');
    } else body.innerHTML = pages[type] || pages.terms;
    modal.classList.add("open");
  }

  function closeInfo() { document.getElementById("nordicInfo").classList.remove("open"); }

  function enhanceCheckout() {
    let form = document.getElementById("checkoutForm");
    if (!form) {
      document.body.insertAdjacentHTML("beforeend", '<div class="nordic-info" id="checkoutModal"><section class="nordic-info-card"><button type="button" id="checkoutClose">Lukk</button><h2>Leveringsopplysninger</h2><form id="checkoutForm" class="formgrid"><input required name="name" placeholder="Fullt navn"><input required type="email" name="email" placeholder="E-post"><input required name="phone" placeholder="Telefon"><input required name="city" placeholder="Sted"><input required class="full" name="address" placeholder="Adresse"><select required name="country" class="full"><option value="Norway">Norge</option><option value="Europe">Europa</option><option value="Peru">Peru</option></select><button class="checkout full" type="submit">GÅ TIL BETALING <span lang="es">/ IR AL PAGO</span></button></form><div id="success" style="display:none"></div></section></div>');
      form = document.getElementById("checkoutForm");
      document.getElementById("checkoutClose").onclick = () => document.getElementById("checkoutModal").classList.remove("open");
    }
    const trigger = document.querySelector(".drawer .checkout");
    if (trigger) trigger.onclick = () => {
      if (!Object.keys(cartObject()).length) return;
      const modal = document.getElementById("checkoutModal") || document.getElementById("modal");
      if (!modal) return;
      document.getElementById("drawer")?.classList.remove("open");
      modal.classList.add("open", "show");
      document.getElementById("overlay")?.classList.add("show");
    };
    if (form.dataset.enhanced) return;
    form.dataset.enhanced = "true";
    const button = form.querySelector('[type="submit"]');
    button.textContent = "BETAL SIKKERT MED STRIPE";
    const summary = '<div class="full notice nordic-precontract">Du sendes til Stripe Checkout for sikker betaling. Selger: '+BRAND+' (Martinez Lozano Internasjonal Handel, org.nr 935 407 095 MVA). Totalpris inkl. 25 % MVA og frakt (79 kr i Norge) vises før du betaler. Estimert levering 5–20 virkedager. 14 dagers angrerett – du betaler selv returfrakten.<br><span lang="es">Serás redirigido a Stripe Checkout para pagar de forma segura. Vendedor: '+BRAND+' (Martinez Lozano Internasjonal Handel, org.nr 935 407 095 MVA). El precio total con 25 % de IVA y envío (79 kr en Noruega) se muestra antes de pagar. Entrega estimada: 5–20 días hábiles. Derecho de desistimiento de 14 días; los gastos de devolución corren por tu cuenta.</span></div>';
    const oldNotice = form.querySelector(".notice");
    if (oldNotice) oldNotice.outerHTML = summary; else button.insertAdjacentHTML("beforebegin", summary);
    const L = (href, text) => '<a href="'+href+'" target="_blank" rel="noopener">'+text+'</a>';
    button.insertAdjacentHTML("beforebegin", '<label class="full nordic-consent"><input required type="checkbox" name="terms"> <span>Jeg godtar '+L("/kjopsvilkar","kjøpsvilkårene")+' og har lest informasjonen om '+L("/angrerett","angrerett")+' (med '+L("/angreskjema","angreskjema")+') og '+L("/personvern","personvern")+'. <span lang="es">Acepto las '+L("/kjopsvilkar","condiciones de compra")+' y he leído la información sobre el '+L("/angrerett","derecho de desistimiento")+' (con el '+L("/angreskjema","formulario de desistimiento")+') y la '+L("/personvern","política de privacidad")+'.</span></span></label>');
    form.onsubmit = async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const items = Object.entries(cartObject()).map(([id, quantity]) => {
        const item = catalogProductById(id) || {};
        /* No prices are sent: the server prices each line from its signed quote or its own catalog. */
        return { id, ref: String(item.externalId || ""), sku: item.sku || "", name: item.name || item.n || "Product", quantity, provider: item.provider || "", quote: item.quote || "" };
      });
      if (!items.length) return;
      const id = "NORD-" + Date.now().toString(36).toUpperCase();
      const orders = read(ORDER_KEY, []);
      const activeMarket = typeof marketCode !== "undefined" ? marketCode : (typeof market === "string" ? market : "NO");
      const customer = Object.fromEntries(new FormData(form).entries());
      const order = { id, date: new Date().toISOString(), market: activeMarket, store: STORE, items: items.map(({ id, name, quantity, provider }) => ({ id, name, quantity, provider })), status: "checkout-started" };
      orders.unshift(order);
      write(ORDER_KEY, orders.slice(0, 20));
      button.disabled = true;
      button.textContent = "ÅPNER STRIPE…";
      try {
        const response = await fetch("/api/create-checkout-session", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            order_id:id, market:activeMarket, email:customer.email || "", items
          })
        });
        const checkout = await response.json();
        if (!response.ok || !checkout.url) throw new Error(checkout.error || "Betaling er ikke tilgjengelig akkurat nå");
        window.location.assign(checkout.url);
      } catch (error) {
        button.disabled = false;
        button.textContent = "PRØV Å BETALE IGJEN";
        alert((error && error.message ? error.message : "Stripe Checkout er midlertidig utilgjengelig") + ". Kontakt " + CONTACT_EMAILS.orders + ".");
        return;
      }
    };
  }

  function restoreCart() {
    const saved = read(CART_KEY, {});
    /* Products now appear before this runs, so keep anything already added in this visit. */
    const valid = { ...cartObject() };
    pendingCart = {};
    Object.entries(saved).forEach(([id, quantity]) => {
      if (valid[id] != null || !(Number(quantity) > 0)) return;
      if (productById(id)) valid[id] = Math.min(99, Number(quantity));
      else pendingCart[id] = Math.min(99, Number(quantity));
    });
    setCartObject(valid);
    redrawCart();
    write(CART_KEY, { ...pendingCart, ...valid });
  }

  /* A background supplier answered: put saved lines for its products back into the cart. */
  function restorePending() {
    if (!started || !Object.keys(pendingCart).length) return;
    const current = { ...cartObject() };
    let changed = false;
    Object.keys(pendingCart).forEach(id => {
      if (!productById(id)) return;
      if (current[id] == null) current[id] = pendingCart[id];
      delete pendingCart[id];
      changed = true;
    });
    if (changed) { setCartObject(current); redrawCart(); }
  }
  window.addEventListener("nordic:catalog-updated", restorePending);
  window.addEventListener("nordic:catalog-complete", () => { restorePending(); pendingCart = {}; if (started) saveCartSoon(); });

  function init() {
    if (started) return;
    started = true;
    addPolicies();
    addCatalogTools();
    addTrustAndSeo();
    enhanceCheckout();
    restoreCart();
    document.addEventListener("click", event => {
      const info = event.target.closest("[data-info]");
      if (info) openInfo(info.dataset.info);
      if (event.target.closest(".add,.qty button")) saveCartSoon();
    });
    const marketSelect = document.getElementById("market");
    if (marketSelect) marketSelect.addEventListener("change", saveCartSoon);
  }

  window.NordicCommerce = { init };
  /* Start once every supplier catalog has answered or timed out (supplier-bridge.js), at the latest after 12 s. */
  if (window.nordicCatalogReady) setTimeout(init, 0);
  else {
    window.addEventListener("nordic:catalog-ready", () => setTimeout(init, 0), { once: true });
    setTimeout(init, 12000);
  }
})();

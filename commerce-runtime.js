/* Nordic Commerce runtime: persistent cart, local order drafts and customer information. */
(function () {
  "use strict";

  const STORE = (document.title || "Nordic Store").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const CART_KEY = "nordic-cart:" + STORE;
  const ORDER_KEY = "nordic-orders:" + STORE;
  const CONTACT_EMAILS = {
    info: "info@mlinternasjonal.no",
    support: "support@mlinternasjonal.no",
    orders: "orders@mlinternasjonal.no",
    marketing: "marketing@mlinternasjonal.no"
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
    if (typeof data !== "undefined" && Array.isArray(data)) return data.map(x => ({id:x.id,name:x.n,base:x.p,sku:x.sku || ""}));
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

  function saveCartSoon() {
    setTimeout(() => {
      write(CART_KEY, cartObject());
    }, 0);
  }

  function addPolicies() {
    if (document.getElementById("nordicInfo")) return;
    const style = document.createElement("style");
    style.textContent = ".nordic-info-links{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px}.nordic-info-links button{border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0}.nordic-info{position:fixed;inset:0;z-index:90;background:#000a;display:none;place-items:center;padding:18px}.nordic-info.open{display:grid}.nordic-info-card{width:min(680px,100%);max-height:88vh;overflow:auto;background:#fff;color:#172033;border-radius:16px;padding:24px;box-shadow:0 30px 90px #0006}.nordic-info-card>button{float:right;border:1px solid #ccd3dd;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}.nordic-info-card h2{margin-top:8px}.nordic-info-card p,.nordic-info-card li{line-height:1.6}.nordic-info-card form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.nordic-info-card input,.nordic-info-card select{border:1px solid #ccd3dd;border-radius:8px;padding:12px;width:100%}.nordic-info-card .full{grid-column:1/-1}.nordic-info-card form .checkout{float:none}.nordic-consent{font-size:12px;line-height:1.45;display:flex;gap:8px;align-items:flex-start}.nordic-consent input{width:auto!important;margin-top:3px}.nordic-order-id{font:800 22px/1.3 ui-monospace,monospace;letter-spacing:1px}@media(max-width:560px){.nordic-info-card form{grid-template-columns:1fr}.nordic-info-card .full{grid-column:auto}}";
    document.head.appendChild(style);
    document.body.insertAdjacentHTML("beforeend", '<div class="nordic-info" id="nordicInfo"><section class="nordic-info-card"><button type="button" id="nordicInfoClose">Close</button><div id="nordicInfoBody"></div></section></div>');
    const footer = document.querySelector("footer") || document.body;
    footer.insertAdjacentHTML("beforeend", '<div class="nordic-info-links"><button type="button" data-info="shipping">Shipping</button><button type="button" data-info="returns">Returns</button><button type="button" data-info="privacy">Privacy</button><button type="button" data-info="terms">Terms</button><button type="button" data-info="orders">Order status</button><a href="mailto:'+CONTACT_EMAILS.info+'">'+CONTACT_EMAILS.info+'</a><a href="mailto:'+CONTACT_EMAILS.support+'">Support</a></div>');
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
    tools.innerHTML = '<input id="nordicProductSearch" type="search" autocomplete="off" aria-label="Search products" placeholder="Search products" style="flex:1;min-width:210px;padding:12px;border:1px solid #94a3b8;border-radius:8px"><select id="nordicProductSort" aria-label="Sort products" style="padding:12px;border:1px solid #94a3b8;border-radius:8px"><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name</option></select><span id="nordicResultCount" aria-live="polite" style="align-self:center;font-size:13px;opacity:.75"></span>';
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
      count.textContent = visible + " products";
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
      notice.textContent = "Prices and standard shipping are confirmed in secure Stripe Checkout. Supplier stock and delivery remain subject to final availability.";
      grid.parentNode.insertBefore(notice, grid);
    }
    const schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify({"@context":"https://schema.org","@type":"OnlineStore","name":document.title,"areaServed":["NO","EU","PE"],"currenciesAccepted":["NOK","EUR","PEN"]});
    document.head.appendChild(schema);
    const count = document.getElementById("count");
    if (count) count.setAttribute("aria-live", "polite");
  }

  const pages = {
    shipping: '<h2>Shipping</h2><p>Delivery estimates and prices are shown in the cart for the selected market. Final availability depends on supplier stock and destination. Tracking is provided after supplier fulfilment.</p><p>Norway and European orders may be subject to VAT or customs rules. DDP will be preferred when the supplier confirms it.</p>',
    returns: '<h2>Returns and refunds</h2><p>Contact support within 14 days of delivery before returning an item. Products must be unused and in their original packaging. Faulty or incorrect products require photos and the order number.</p><p>Return eligibility, address and refund timing must be confirmed before shipment because products may come from different suppliers.</p>',
    privacy: '<h2>Privacy</h2><p>Contact and delivery details are used to process your order. Card information is collected and processed securely by Stripe and is not stored by this storefront.</p><p>Data controller: Martinez Lozano Internasjonal Handel (ENK), Org. No. NO935407095MVA. Privacy enquiries: '+CONTACT_EMAILS.info+'.</p>',
    terms: '<h2>Terms</h2><p>The final amount and currency are displayed by Stripe before payment. An order is accepted only after successful payment and supplier availability confirmation.</p>',
    orders: ""
  };

  function openInfo(type) {
    const modal = document.getElementById("nordicInfo");
    const body = document.getElementById("nordicInfoBody");
    if (type === "orders") {
      const orders = read(ORDER_KEY, []);
      body.innerHTML = '<h2>Recent checkout attempts</h2>' + (orders.length ? orders.map(order => '<p><strong>'+esc(order.id)+'</strong><br>'+esc(order.date)+' · '+esc(order.market)+' · '+order.items.length+' item(s)<br><span>Status: '+esc(order.status || "checkout-created")+'</span></p>').join("") : '<p>No recent checkout attempts saved on this device.</p>');
    } else body.innerHTML = pages[type] || pages.terms;
    modal.classList.add("open");
  }

  function closeInfo() { document.getElementById("nordicInfo").classList.remove("open"); }

  function enhanceCheckout() {
    let form = document.getElementById("checkoutForm");
    if (!form) {
      document.body.insertAdjacentHTML("beforeend", '<div class="nordic-info" id="checkoutModal"><section class="nordic-info-card"><button type="button" id="checkoutClose">Close</button><h2>Delivery details</h2><form id="checkoutForm" class="formgrid"><input required name="name" placeholder="Full name"><input required type="email" name="email" placeholder="Email"><input required name="phone" placeholder="Phone"><input required name="city" placeholder="City"><input required class="full" name="address" placeholder="Address"><select required name="country" class="full"><option value="Norway">Norway</option><option value="Europe">Europe</option><option value="Peru">Peru</option></select><button class="checkout full" type="submit">CREATE SECURE ORDER DRAFT</button></form><div id="success" style="display:none"></div></section></div>');
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
    button.textContent = "PAY SECURELY WITH STRIPE";
    button.insertAdjacentHTML("beforebegin", '<label class="full nordic-consent"><input required type="checkbox" name="terms"> <span>I accept the terms, privacy information and return conditions.</span></label>');
    form.onsubmit = async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const items = Object.entries(cartObject()).map(([id, quantity]) => {
        const item = productById(id) || {};
        return { id, sku: item.sku || "", name: item.name || "Product", quantity };
      });
      if (!items.length) return;
      const id = "NORD-" + Date.now().toString(36).toUpperCase();
      const orders = read(ORDER_KEY, []);
      const activeMarket = typeof marketCode !== "undefined" ? marketCode : (typeof market === "string" ? market : "NO");
      const customer = Object.fromEntries(new FormData(form).entries());
      const order = { id, date: new Date().toISOString(), market: activeMarket, store: STORE, items, customer, status: "checkout-started" };
      orders.unshift(order);
      write(ORDER_KEY, orders.slice(0, 20));
      button.disabled = true;
      button.textContent = "OPENING STRIPE…";
      try {
        const response = await fetch("/api/create-checkout-session", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            order_id:id, market:activeMarket, email:customer.email || "", items
          })
        });
        const checkout = await response.json();
        if (!response.ok || !checkout.url) throw new Error(checkout.error || "Payment unavailable");
        window.location.assign(checkout.url);
      } catch (error) {
        button.disabled = false;
        button.textContent = "TRY PAYMENT AGAIN";
        alert((error && error.message ? error.message : "Stripe Checkout is temporarily unavailable") + ". Please contact " + CONTACT_EMAILS.orders + ".");
        return;
      }
    };
  }

  function ensureNetlifyForm() {
    if (document.querySelector('form[name="nordic-order"]')) return;
    document.body.insertAdjacentHTML("beforeend", '<form name="nordic-order" data-netlify="true" netlify-honeypot="bot-field" hidden><input name="bot-field"><input name="store"><input name="order_id"><input name="market"><input name="name"><input name="email"><input name="phone"><input name="city"><input name="address"><input name="country"><textarea name="items"></textarea><input name="consent"></form>');
  }

  function restoreCart() {
    const saved = read(CART_KEY, {});
    const valid = {};
    Object.entries(saved).forEach(([id, quantity]) => {
      if (productById(id) && Number(quantity) > 0) valid[id] = Math.min(99, Number(quantity));
    });
    setCartObject(valid);
    redrawCart();
  }

  function init() {
    if (started) return;
    started = true;
    addPolicies();
    addCatalogTools();
    addTrustAndSeo();
    ensureNetlifyForm();
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
  setTimeout(init, 8000);
})();

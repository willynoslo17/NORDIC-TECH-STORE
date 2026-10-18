/* Meta Pixel + samtykke (lastes kun etter "Godta") */
(function(){
  var PID="2045832722789814",K="mp-consent";
  function load(){
    if(window.fbq)return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init',PID);fbq('track','PageView');
    if(/\/(produkt|product|p)\//.test(location.pathname))fbq('track','ViewContent');
    if(/payment=success/.test(location.search))fbq('track','Purchase',{currency:'NOK'});
  }
  function ev(n){if(window.fbq)fbq('track',n,{currency:'NOK'})}
  document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('.add,[data-add-to-cart]');if(t)ev('AddToCart')},true);
  document.addEventListener('submit',function(e){if(e.target&&e.target.id==='checkoutForm')ev('InitiateCheckout')},true);
  function banner(){
    var d=document.createElement('div');d.id='ckb';
    d.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:#111;color:#fff;padding:12px 16px;border-radius:10px;font:14px/1.4 system-ui,sans-serif;display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;box-shadow:0 10px 30px #0004';
    var b='border:0;border-radius:8px;padding:8px 14px;cursor:pointer;font:600 14px system-ui,sans-serif;';
    d.innerHTML='<span>Vi bruker informasjonskapsler for å måle og forbedre annonser (Meta). Nødvendige informasjonskapsler brukes alltid. <a href="/personvern.html" style="color:#9cf">Personvern</a></span><span style="display:flex;gap:8px"><button type="button" data-v="yes" style="'+b+'background:#fff;color:#111">Godta</button><button type="button" data-v="no" style="'+b+'background:#333;color:#fff">Avvis</button></span>';
    d.onclick=function(e){var v=e.target.getAttribute('data-v');if(!v)return;localStorage.setItem(K,v);d.remove();if(v==='yes')load()};
    document.body.appendChild(d);
  }
  var c=localStorage.getItem(K);
  if(c==='yes')load();else if(!c){if(document.body)banner();else document.addEventListener('DOMContentLoaded',banner)}
})();

/* Footer newsletter signup (double opt-in via /api/newsletter). The consent box is optional, unchecked by default
   and has nothing to do with buying. The form stays disabled until the server reports that sending is configured. */
(function () {
  "use strict";
  const form = document.getElementById("mlNewsletter");
  if (!form) return;
  const fields = form.querySelector("fieldset");
  const status = form.querySelector(".ml-nl-status");
  function say(nb, es) {
    status.innerHTML = "";
    status.appendChild(document.createTextNode(nb + " "));
    if (es) { const span = document.createElement("span"); span.lang = "es"; span.textContent = es; status.appendChild(span); }
  }
  function disable() {
    fields.disabled = true;
    form.dataset.state = "disabled";
    say("Påmelding til nyhetsbrevet åpner snart.", "La suscripción al boletín abrirá pronto.");
  }
  fetch("/api/newsletter", { cache: "no-store" })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (d && d.enabled === true) { fields.disabled = false; form.dataset.state = "ready"; status.textContent = ""; }
      else disable();
    })
    .catch(disable);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (form.dataset.state !== "ready") return;
    const email = String(form.elements.email.value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("Skriv inn en gyldig e-postadresse.", "Escribe una dirección de correo válida."); return; }
    if (!form.elements.consent.checked) { say("Kryss av i samtykkefeltet for å melde deg på.", "Marca la casilla de consentimiento para suscribirte."); return; }
    fields.disabled = true;
    say("Sender …", "Enviando…");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, consent: true, lang: "nb", source: "footer", website: form.elements.website.value })
      });
      if (response.ok) {
        form.reset();
        say("Takk! Sjekk e-posten din og bekreft påmeldingen. Du blir ikke lagt til før du har bekreftet.",
            "¡Gracias! Revisa tu correo y confirma la suscripción. No te añadiremos hasta que la confirmes.");
      } else if (response.status === 400) {
        say("Sjekk e-postadressen og samtykket.", "Revisa la dirección de correo y el consentimiento.");
      } else {
        say("Påmeldingen er ikke tilgjengelig akkurat nå. Prøv igjen senere.", "La suscripción no está disponible ahora mismo. Inténtalo más tarde.");
      }
    } catch (_) {
      say("Påmeldingen er ikke tilgjengelig akkurat nå. Prøv igjen senere.", "La suscripción no está disponible ahora mismo. Inténtalo más tarde.");
    }
    fields.disabled = false;
  });
})();

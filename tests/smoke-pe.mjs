#!/usr/bin/env node
/**
 * Smoke checks for Novverk /pe/ (Peru) and safety invariants.
 * Run: node tests/smoke-pe.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = [];
const ok = [];

function read(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    fail.push("missing file: " + rel);
    return "";
  }
  return readFileSync(p, "utf8");
}

function assert(cond, msg) {
  if (cond) ok.push(msg);
  else fail.push(msg);
}

const pe = read("pe/index.html");
const region = read("region-switch.js");
const bridge = read("supplier-bridge.js");
const runtime = read("commerce-runtime.js");
const checkout = read("functions/api/create-checkout-session.ts");
const index = read("index.html");
const winners = read("functions/_shared/catalog-data/cj-winners.json");
const peCatalog = read("catalog/pe-cj-winners.json");

assert(pe.includes('lang="es-PE"'), "pe/index.html is Spanish (es-PE)");
assert(/IGV|igv/.test(pe) && pe.includes("18"), "pe page mentions IGV 18%");
assert(pe.includes("PEN") || pe.includes("currency:'PEN'"), "pe page uses PEN");
assert(pe.includes('id="regionSwitch"'), "pe header has region switch");
assert(pe.includes("/region-switch.js"), "pe loads region-switch.js");
assert(pe.includes("/commerce-runtime.js"), "pe loads commerce-runtime with absolute path");
assert(!pe.includes("loadNordicCatalog"), "pe does not call loadNordicCatalog (no live API)");
assert(pe.includes("/catalog/pe-cj-winners.json"), "pe loads static pe-cj-winners catalog");
assert(!/CHECKOUT_ENABLED\s*=\s*true/.test(pe), "pe page does not enable checkout locally");
assert(pe.includes('disabled') && /CAJA PRONTO|PAGO PRONTO/.test(pe), "pe checkout controls stay disabled");

assert(region.includes("novverk-region"), "region-switch uses localStorage key novverk-region");
assert(region.includes("/pe/"), "region-switch knows /pe/ path");
assert(region.includes("europa") && region.includes("peru"), "region-switch has Europa/Perú");

assert(bridge.includes("/catalog/selected-products.json"), "supplier-bridge uses absolute catalog paths");
assert(/const CHECKOUT_ENABLED = false/.test(runtime), "commerce-runtime CHECKOUT_ENABLED=false");
assert(/const CHECKOUT_ENABLED = false/.test(checkout), "create-checkout-session CHECKOUT_ENABLED=false");

assert(index.includes('id="regionSwitch"') || index.includes("region-switch.js"), "Norwegian index wires region switch");
assert(index.includes('lang="nb"'), "Norwegian store html lang unchanged");
assert(/Teknologi for hjemmet og hverdagen/.test(index), "Norwegian hero copy unchanged");
assert(!index.includes("lima.css"), "Norwegian store does not load lima.css");

const legalPages = [
  ["pe/terminos.html", "Términos", "IGV"],
  ["pe/privacidad.html", "MARTINEZ LOZANO INTERNASJONAL HANDEL", "responsable"],
  ["pe/envios.html", "Envío a todo el Perú", "S/ 14"],
  ["pe/cambios.html", "devoluciones", "support@novverk.no"],
  ["pe/libro-reclamaciones.html", "Libro de Reclamaciones", "mailto:support@novverk.no"],
];
for (const [file, a, b] of legalPages) {
  const text = read(file);
  assert(text.includes(a) && text.includes(b), file + " has required legal content");
  assert(text.includes("regionSwitch") || text.includes("region-switch.js"), file + " has region switch");
}
assert(existsSync(join(root, "pe/legal.css")), "pe/legal.css exists");
assert(pe.includes("/pe/libro-reclamaciones"), "pe homepage links Libro de Reclamaciones");

const lima = read("pe/lima.css");
assert(lima.includes("--sun") && lima.includes("Archivo Black"), "lima.css defines Lima palette/fonts");
assert(pe.includes("/pe/lima.css"), "pe storefront loads lima.css");
assert(pe.includes("Yape") && pe.includes("Plin") && /pr[oó]ximamente/i.test(pe), "pe shows Yape/Plin próximamente");
assert(pe.includes("badge stock") && pe.includes("Envío a todo el Perú"), "pe products show stock and Peru shipping badges");
assert(pe.includes("reseñas") || pe.includes("reviews"), "pe products show reviews");

let winnersJson;
try {
  winnersJson = JSON.parse(winners);
  assert(winnersJson.onlyWinners === true, "cj-winners.json onlyWinners remains true");
  assert(Array.isArray(winnersJson.pids) && winnersJson.pids.length >= 40, "cj-winners has vetted pids");
  assert(Array.isArray(winnersJson.products) && winnersJson.products.length === winnersJson.pids.length, "every winner pid has a snapshot product");
  const blob = JSON.stringify(winnersJson).toLowerCase();
  assert(blob.includes("headphone") || blob.includes("phone") || blob.includes("cable") || blob.includes("stand"), "cj-winners includes tech accessory keywords");
  assert(!blob.includes("cj_api_key") && !blob.includes("sk_live"), "winners file has no secrets");
} catch (e) {
  fail.push("cj-winners.json parse: " + e.message);
}

try {
  const peJson = JSON.parse(peCatalog);
  assert(peJson.onlyWinners === true, "pe-cj-winners.json onlyWinners true");
  assert(Array.isArray(peJson.products) && peJson.products.length >= 20, "pe static catalog has products");
  const cats = new Set(peJson.products.map((p) => p.category));
  assert(cats.has("Accesorios"), "pe catalog has Accesorios");
  assert(cats.has("Audífonos") || cats.has("Cargadores"), "pe catalog has Audífonos or Cargadores");
  assert(peJson.products.every((p) => p.image && p.priceNok > 0 && p.vetted === true), "pe products have image, price, vetted");
  assert(!peCatalog.includes("cj_api_key") && !peCatalog.includes("/api/cj-products"), "pe catalog is static snapshot only");
} catch (e) {
  fail.push("pe-cj-winners.json parse: " + e.message);
}

console.log("PASS " + ok.length);
ok.forEach((m) => console.log("  ✓ " + m));
if (fail.length) {
  console.log("FAIL " + fail.length);
  fail.forEach((m) => console.log("  ✗ " + m));
  process.exit(1);
}
console.log("All smoke checks passed.");

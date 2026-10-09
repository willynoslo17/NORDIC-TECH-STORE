# Novverk — SKUs que no se pueden cobrar

Store: **Novverk** · https://novverk.no/ · repo `NORDIC-TECH-STORE` only.

Checkout stays **off** until each SKU below clears stock, landed cost and fulfillment. Do not invent or commit `CJ_API_KEY`, `DROPI_API_TOKEN`, `BIGBUY_API_TOKEN`, `SYNCEE_API_KEY` or `DSERS_API_KEY`.

## Global gate (all SKUs)

| Control | Status |
| --- | --- |
| `CHECKOUT_ENABLED` in `functions/api/create-checkout-session.ts` | `false` → HTTP **503** «Nettbutikken åpner snart…» (opens soon) |
| `CHECKOUT_ENABLED` in `commerce-runtime.js` | `false` → cart pay button disabled |
| Supplier bridge tokens (`CJ_API_KEY`, `DROPI_*`, `BIGBUY_*`, `SYNCEE_*`, `DSERS_*`) | Not invented; set only in host env when the owner issues them |

Until the global gate is opened **and** a SKU row below is cleared, that SKU must not be charged.

## Charge criteria (per SKU)

A SKU may be charged only when all three are recorded for the sold variant and destination:

1. **Stock** — live supplier stock &gt; 0 (or confirmed POD make-to-order capacity).
2. **Landed cost** — supplier unit cost **plus** current shipping quote to the destination (NO / EU / PE), so retail (cost × 2.5, min 99, ends in 9) still covers duty/VAT/fulfillment.
3. **Fulfillment** — supplier order IDs that Make can submit automatically:
   - CJ: `cj_pid` + `cj_vid`
   - Printify: `printify_product_id` + `printify_variant_id`
   - Gelato: `gelato_product_uid` + print file URL
   - Printful: `printful_sync_variant_id`

Also required before payment (see README): manufacturer, responsible economic operator, safety warnings, destination availability, VAT treatment, return address.

## Summary

| Source | SKUs | Chargeable now? | Main blockers |
| --- | ---: | --- | --- |
| CJ winners (live storefront grid) | 59 | **No** | Stock/cost live-only; no landed-cost quote stored; no bundled `cj_vid`; GPSR incomplete; checkout off |
| CJ selected (`catalog/selected-products.json`) | 30 | **No** | Stock + supplier cost present, but **no shipping quote → no landed cost**; no bundled `cj_vid`; status `candidate-for-review`; GPSR incomplete; checkout off |
| Printify selected | 16 | **No** | Cost + NO shipping + fulfill IDs present, but GPSR manufacturer/REO not recorded per SKU; checkout off |
| Gelato / Printful | 0 | n/a | Empty catalogs (`[]`); no SKUs to charge |

**Chargeable SKU count today: 0.**

---

## A. CJ winners — not chargeable (live grid)

Source: `functions/_shared/catalog-data/cj-winners.json` (`onlyWinners` storefront path).

Name/image/cost come from the live CJ API when a real `CJ_API_KEY` is configured in host env. Without that key there is no verified live stock/cost. Even with live cost, there is **no destination freight quote stored**, so landed cost is incomplete, and checkout resolves `cj_vid` only at pay time.

| SKU | Name (NO) | Blockers |
| --- | --- | --- |
| CJJSPBPB00082 | Gaming-musematte | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJSPBBJ00089 | Vanntett laptopveske i oxfordstoff | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJSPBBJ00098 | Laptopveske for 15,6 tommer | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJBJ1092649 | Støtsikker laptopveske med skulderreim | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJSBJYX00036 | Vanntett skrivebordsmatte | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJT1094030 | Laptopstativ i aluminium | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJSJSJSJ00869 | Bærbart laptopstativ i aluminium | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJT1550529 | Hodetelefonstativ i stilig design | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT17599 | Solid laptopstativ i aluminium | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJSJSJSJ00190 | Nettbrettstativ i aluminium for skrivebordet | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJBJ1404078 | Laptopveske i matt kunstskinn | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJSJSJSJ00813 | Universal mobilholder med fingerring og ventilfeste | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJSJ1682294 | Sammenleggbart metallstativ for mobil og nettbrett | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJSBGBG00621 | Pennholder i nordisk stil | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT02023 | Musematte | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJT1390358 | Stor vanntett skrivebordsmatte i kunstskinn | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJYD2046638 | Vanntett laptophylse i to farger | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJSJBHQB00030 | Mobillommebok med glidelås | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT20606 | Kabelholder for mus | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJSJSJSJ02266 | Mobilholder for baksetet i bilen | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJT1398975 | Laptophylse i kunstskinn | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT18536 | Ultratynt bærbart laptopstativ | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJT1686513 | Sammenleggbart og høydejusterbart laptopstativ | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJYD2447099 | Laptopveske i kunstskinn | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJSJSJSJ01581 | Diskret sammenleggbart mobilstativ | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJSJ1042347 | Fleksibel mobil- og nettbrettholder for seng og bord | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJSM1573070 | Laptophylse med glidelås og skulderreim | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT05827 | Pennholder i tre med kalender | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJQC1030224 | Universalt nettbrettstativ | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJT1001733 | Håndleddsstøtte i tre for mekanisk tastatur | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT17317 | Håndleddsstøtte for tastatur og mus | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJYD2199812 | Håndleddsstøtte i tre for tastatur og mus | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT23595 | Stativ i aluminium for laptop og nettbrett | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJT1674204 | Magnetisk mobilring og holder | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJYD2406035 | Myk og luftig laptophylse, 13–15,6 tommer | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJSJ1966981 | Magnetisk mobilring i sinklegering | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJT1641721 | Sammenleggbart multistativ for laptop | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJYD2348964 | Sammenleggbart laptopstativ i aluminium | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJSPBBJ00176 | Laptopveske i svart og hvitt | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJSPBBJ00017 | Minimalistisk laptophylse med musematte | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJBJ1755674 | Laptopbord og stativ | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJSPBPB00712 | Vanntett laptophylse | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJPB1650708 | Støvdeksel for tastatur og laptopskjerm | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJYD2338274 | Polstret laptopveske | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT13032 | Musematte med håndleddsstøtte | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT12595 | Kabelholder for skrivebordet | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJSPBPB00137 | Musematte i kork | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJSPBPB00193 | Dobbeltsidig musematte i aluminium | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJSBGBG02335 | Håndleddsstøtte for tastatur | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJYD1883323 | Brodert hylse for laptop og nettbrett | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJT1347346 | Hard musematte i resin | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT38970 | Pennholder i bambus | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJSJSJSJ02517 | Justerbart mobilstativ med kaninmotiv | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT17822 | Ergonomisk laptopstativ i aluminium | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJXFLPSM00044 | Selvklebende kabelklips | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJT1548882 | Hodetelefonholder med klemme for skrivebordet | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJJJJTJT18876 | Høyt laptopstativ | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJYD2250370 | Luftig, polstret laptophylse | stock*, landed cost, fulfillment (`cj_vid`), GPSR |
| CJPB2261165 | Beskyttende laptophylse | stock*, landed cost, fulfillment (`cj_vid`), GPSR |

\*Stock is only trustworthy from a live CJ inventory response with a real host `CJ_API_KEY`. Snapshot fields alone are not enough to open charging.

---

## B. CJ selected snapshot — not chargeable

Source: `functions/_shared/catalog-data/cj-selected.json` / public `catalog/selected-products.json`.

These rows have warehouse inventory and a supplier unit cost, but **no destination freight → landed cost incomplete**, no bundled `cj_vid`, and status is still `candidate-for-review`.

| SKU | Supplier cost (USD) | Snapshot stock | Missing for charge |
| --- | ---: | ---: | --- |
| CJSJ1352992 | 22.97 | 37713 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSJSJSJ00567 | 0.33 | 13299 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJXFZNZN00127 | 4.70 | 14774 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSM1849178 | 11.98 | 3746 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSJ1148731 | 15.96 | 28407 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJTA1314287 | 1.10 | 3175020 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSJ1064851 | 5.65 | 40000 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJZN1230879 | 4.07 | 708119 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSJ1245515 | 8.39 | 89856 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSJ1083251 | 0.49 | 120000 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSJSJSJ01409 | 4.62 | 13342 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJYD1817972 | 22.39 | 46561 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJQC1146209 | 5.51 | 88929 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJGJ1184814 | 0.90 | 186030 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJXFZNZN00726 | 1.90 | 133363 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSJ1685991 | 2.11 | 37106 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSJ1611767 | 2.85 | 10493 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJJT1949202 | 0.80 | 79656 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJXFZNZN00066 | 3.39 | 366650 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJGJ1606278 | 2.71 | 980274 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJYD2017067 | 9.46 | 75567 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJYZ1651390 | 1.29 | 220548 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSJ1177112 | 22.89 | 108216 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJXFLPSM00039 | 2.35 | 288751 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJZN1039807 | 19.13 | 40000 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJZN1310469 | 12.90 | 228962 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJXFZNZN01930 | 4.84 | 66803 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSJ2089722 | 0.14 | 13580 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJSJ1663512 | 1.25 | 34672 | landed cost (freight), `cj_vid`, GPSR, review status |
| CJXFZNZN00893 | 40.88 | 11816 | landed cost (freight), `cj_vid`, GPSR, review status |

---

## C. Printify — not chargeable yet

Source: `functions/_shared/catalog-data/printify-selected.json`.

Closer: unit cost, `shippingNoUsd` (NO), and Printify product/variant IDs exist (POD fulfillment path). Still blocked by missing per-SKU GPSR manufacturer / responsible economic operator records and by the global checkout pause.

| SKU | Name | Cost USD | Ship NO USD | Missing for charge |
| --- | --- | ---: | ---: | --- |
| 23188691364212653570 | Novverk Circuit Logo Mug 11oz | 5.91 | 10.39 | GPSR manufacturer/REO; checkout off |
| 31917238739564631369 | Novverk Circuit Pattern Mug 11oz | 5.88 | 10.39 | GPSR manufacturer/REO; checkout off |
| 23613070819989847894 | Novverk Organic Cotton Tote | 13.00 | 7.29 | GPSR manufacturer/REO; checkout off |
| 14232655638286743019 | Novverk Circuit Art Poster A3 | 7.09 | 8.49 | GPSR manufacturer/REO; checkout off |
| 11186452768273668294 | Novverk "Build. Ship. Repeat." Poster A3 | 7.09 | 8.49 | GPSR manufacturer/REO; checkout off |
| 13525578223055726242 | Novverk Dot-Grid Notebook | 8.82 | 8.79 | GPSR manufacturer/REO; checkout off |
| 32843226751265071548 | Novverk Circuit Vinyl Sticker | 3.89 | 5.59 | GPSR manufacturer/REO; checkout off |
| 31456056178503076610 | Novverk Circuit Mouse Pad | 8.26 | 8.79 | GPSR manufacturer/REO; checkout off |
| 29484817235865519671 | Novverk Circuit Tee – Black · S | 9.28 | 7.29 | GPSR manufacturer/REO; checkout off |
| 11002410588108765740 | Novverk Circuit Tee – Black · M | 9.28 | 7.29 | GPSR manufacturer/REO; checkout off |
| 13781180658643453021 | Novverk Circuit Tee – Black · L | 9.28 | 7.29 | GPSR manufacturer/REO; checkout off |
| 21056283340527231646 | Novverk Circuit Tee – Black · XL | 9.28 | 7.29 | GPSR manufacturer/REO; checkout off |
| 78813005650432844542 | Novverk Circuit Hoodie – Black · S | 25.48 | 10.89 | GPSR manufacturer/REO; checkout off |
| 18477715762860002185 | Novverk Circuit Hoodie – Black · M | 25.48 | 10.89 | GPSR manufacturer/REO; checkout off |
| 66238162800540527650 | Novverk Circuit Hoodie – Black · L | 25.48 | 10.89 | GPSR manufacturer/REO; checkout off |
| 25310878194442993243 | Novverk Circuit Hoodie – Black · XL | 25.48 | 10.89 | GPSR manufacturer/REO; checkout off |

---

## D. Gelato / Printful / German Drop / Dropi / BigBuy / Syncee / DSers

| Provider | Catalog SKUs | Notes |
| --- | ---: | --- |
| Gelato | 0 | `catalog/gelato-products.json` = `[]` — nothing to charge |
| Printful | 0 | `catalog/printful-products.json` = `[]` — nothing to charge |
| German Drop | — | Authorized-manual / shared-account only; no fake DE catalog |
| Dropi / BigBuy / Syncee / DSers | — | Router-ready names only; **do not invent** API tokens |

---

## How to clear a SKU (checklist)

Before flipping `CHECKOUT_ENABLED` to `true` for any SKU:

1. Confirm live **stock** (or POD capacity) for the exact variant.
2. Record **landed cost** = supplier cost + freight quote for NO (and EU/PE if those markets stay open).
3. Confirm **fulfillment** IDs (`cj_vid` / Printify variant / etc.) and a Make path that can place the order.
4. Record manufacturer, responsible economic operator, safety warnings, VAT, return address.
5. Keep supplier secrets in host env only — never commit placeholders for `CJ_API_KEY`, `DROPI_API_TOKEN`, `BIGBUY_API_TOKEN`, `SYNCEE_API_KEY`, `DSERS_API_KEY`.

Until then, every SKU in this file remains **not chargeable**.

# CURSOR-PENDIENTES — novverk-no

Auditoría 2026-10-23. Rama `cursor/novverk-no-auditoria-2026-10` desde `main`, PR contra `main`. Nada fusionado, nada desplegado, ningún producto borrado. PRs abiertos () no se han tocado.

## Hecho en esta rama

- Sin nombres de proveedor en el texto que ve el cliente: `personvern.html` (tabla de encargados agrupada como «Ordreoppfyllelse og lager» / «Trykk og produksjon», con los lugares que ya estaban), `frakt-og-levering.html` y `slik-handler-du.html` (mismos plazos, sin nombres). Fecha de las páginas legales sin cambiar.
- `supplier-bridge.js`: la etiqueta de la ficha (`tag`) muestra la categoría en lugar del proveedor, y el nombre del producto pasa por `stripSupplierWords`. Los campos internos `brand`/`supplier`/`provider` se mantienen porque el checkout y el pedido a Make los usan.
- Notas de `supplier-config.json` sin nombres de marca ni nombres de variables. Claves y flags sin cambios.
- `docs/ordrebekreftelse-mal.md` (bokmål, enlaza kjopsvilkar/angrerett/angreskjema de novverk-no.no.) y `docs/voec-mva-sjekkliste.md`.
- Búsqueda (sin distinguir mayúsculas) de la app de mensajería prohibida en tiendas nórdicas: sin resultados.
- Búsqueda de claves `sk_live_`/`sk_test_`/`ghp_`/`EAA`: vacía. `functions/api/create-checkout-session.ts` sin cambios (comprobación pasada a `sk_test_` con OK del dueño, 2026-10-23). `CHECKOUT_ENABLED = false` sin tocar.

## Por confirmar — no se ha hecho

1. **Rentabilidad y certificación de cada producto.** El catálogo público solo trae `priceNok`, sin coste ni margen ni certificado claro. No se ha ocultado ni borrado ninguno.
2. **Stripe → modo prueba:** hecho con OK del dueño (2026-10-23); el código exige `sk_test_`.
3. **VOEC / MVA:** régimen (MVA ordinaria vs VOEC), umbral, número VOEC, si el 25 % vale para todo el catálogo. Ver `docs/voec-mva-sjekkliste.md`.
4. **Despliegue:** nombre del proyecto Cloudflare Pages e integración Git vs subida directa. `netlify.toml`, `_redirects` y `functions/` sin tocar.
5. **`functions/`** (respuesta del catálogo y resumen interno a Make) sigue nombrando proveedores; `printful-products.ts` devuelve `brand` con el nombre del proveedor como valor por defecto. La tienda ya no lo pinta, pero cambiar `functions/` queda pendiente.
6. **Archivos públicos de operación:** `README.md`, `STRIPE-SETUP.md` y `supplier-config.json` se sirven desde la raíz y nombran proveedores (claves/README). No reescritos.
7. **Fotos y SKU:** las URL de imagen apuntan al host del proveedor y varios SKU llevan su prefijo. No se cambian (imágenes del dueño con SuperGrok; el SKU lo usa el checkout).
8. **Comentarios JS** que nombran el origen (no se renderizan) y rutas `/api/cj-*`: sin renombrar.
9. **¿Basta el texto genérico de encargados en `personvern.html`** para el deber de información (GDPR)? Por confirmar con el dueño.

## Verificación local (2026-10-23)

- Enlaces internos de todos los `.html`: comprobados con script, 0 rotos.
- `index.html` cargado en Chrome headless con servidor estático: sin errores de JavaScript. Solo 404 de `/api/cj-products` y `/api/newsletter`, que son Pages Functions y no existen en un servidor estático local (esperado).
- `node --check` en todos los `.js` de la raíz: OK. No hay `package.json` ni build.

## SuperGrok

Ninguno pedido (verificado 2026-10-22).

import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Locale = 'en' | 'nb' | 'es';

const translations = {
  en: {
  "tab_home": "Home",
  "tab_modules": "Modules",
  "tab_subscribe": "Subscribe",
  "tab_settings": "Settings",
  "home_tagline": "Think a cross-border deal through before you commit.",
  "home_lead": "Quotes, landed cost and trade finance — in one app.",
  "home_cta": "Open a module",
  "home_how": "How it works",
  "home_how_1": "Describe your case in plain language — no forms, no account.",
  "home_how_2": "Live AI when online; on-device analysis as fallback.",
  "home_how_3": "Get a confidence score, short assessment and next steps.",
  "modules_title": "Modules",
  "modules_subtitle": "Pick a tool and describe your case.",
  "analyze_placeholder": "Describe your case…",
  "analyze_run": "Analyze",
  "analyze_running": "Analyzing…",
  "analyze_confidence": "Confidence",
  "analyze_assessment": "Assessment",
  "analyze_steps": "Next steps",
  "analyze_source_live": "Live AI",
  "analyze_source_local": "On-device fallback",
  "analyze_disclaimer": "Indicative decision support — not legal, customs, tax, financial or investment advice.",
  "subscribe_title": "Subscribe",
  "subscribe_lead": "Subscriptions are sold on the web via ML-TRADE-PAYMENTS. The app download is free.",
  "subscribe_monthly": "Monthly",
  "subscribe_yearly": "Yearly",
  "subscribe_price_monthly": "€19.99 / month",
  "subscribe_price_yearly": "€199.99 / year",
  "subscribe_save": "Save 17% vs monthly",
  "subscribe_cta": "Continue to checkout",
  "subscribe_email_fallback": "Request access by email",
  "subscribe_missing_payments": "ML-TRADE-PAYMENTS URL is not configured yet. Use email or set EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL.",
  "subscribe_includes": "All modules · Live AI · Email support · Cancel anytime",
  "settings_title": "Settings",
  "settings_language": "Language",
  "settings_appearance": "Appearance",
  "settings_system": "System",
  "settings_light": "Light",
  "settings_dark": "Dark",
  "settings_privacy": "Privacy policy",
  "settings_terms": "Terms",
  "settings_support": "Support",
  "settings_version": "Version",
  "lang_en": "English",
  "lang_nb": "Norsk",
  "lang_es": "Español",
  "mod_quoteflow_name": "QuoteFlow",
  "mod_quoteflow_blurb": "Turn buyer, product, quantity, Incoterm and validity into a structured quotation brief.",
  "mod_quoteflow_hint": "Buyer in Hamburg needs 2×20ft containers of frozen salmon, CIF Hamburg, 30-day validity…",
  "mod_landed-cost_name": "Landed Cost AI",
  "mod_landed-cost_blurb": "Indicative landed-cost items: HS code, customs value, freight, duty, VAT and fees.",
  "mod_landed-cost_hint": "Importing ceramic tiles from Foshan to Oslo, FOB Qingdao, 18 pallets…",
  "mod_trade-finance_name": "Trade Finance AI",
  "mod_trade-finance_blurb": "Screen payment risk and safer structures: LCs, collections, insured receivables.",
  "mod_trade-finance_hint": "New buyer in Peru, first order €85k machinery, open account 60 days requested…"
},
  nb: {
  "tab_home": "Hjem",
  "tab_modules": "Moduler",
  "tab_subscribe": "Abonner",
  "tab_settings": "Innstillinger",
  "home_tagline": "Tenk gjennom en internasjonal handel før du forplikter deg.",
  "home_lead": "Tilbud, landkostnad og handelsfinans — i én app.",
  "home_cta": "Åpne en modul",
  "home_how": "Slik fungerer det",
  "home_how_1": "Beskriv saken med egne ord – ingen skjemaer, ingen konto.",
  "home_how_2": "AI når du er på nett; analyse på enheten som reserve.",
  "home_how_3": "Få score, kort vurdering og neste steg.",
  "modules_title": "Moduler",
  "modules_subtitle": "Velg et verktøy og beskriv saken.",
  "analyze_placeholder": "Beskriv saken…",
  "analyze_run": "Analyser",
  "analyze_running": "Analyserer…",
  "analyze_confidence": "Sikkerhet",
  "analyze_assessment": "Vurdering",
  "analyze_steps": "Neste steg",
  "analyze_source_live": "Live AI",
  "analyze_source_local": "Lokal reserve",
  "analyze_disclaimer": "Veiledende beslutningsstøtte — ikke juridisk, toll-, skatte-, finansiell eller investeringsrådgivning.",
  "subscribe_title": "Abonner",
  "subscribe_lead": "Abonnement selges på nett via ML-TRADE-PAYMENTS. Appen er gratis å laste ned.",
  "subscribe_monthly": "Månedlig",
  "subscribe_yearly": "Årlig",
  "subscribe_price_monthly": "€19.99 / mnd",
  "subscribe_price_yearly": "€199.99 / år",
  "subscribe_save": "Spar 17% vs månedlig",
  "subscribe_cta": "Gå til betaling",
  "subscribe_email_fallback": "Be om tilgang på e-post",
  "subscribe_missing_payments": "ML-TRADE-PAYMENTS-URL er ikke satt. Bruk e-post eller sett EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL.",
  "subscribe_includes": "Alle moduler · Live AI · E-poststøtte · Si opp når som helst",
  "settings_title": "Innstillinger",
  "settings_language": "Språk",
  "settings_appearance": "Utseende",
  "settings_system": "System",
  "settings_light": "Lyst",
  "settings_dark": "Mørkt",
  "settings_privacy": "Personvern",
  "settings_terms": "Vilkår",
  "settings_support": "Kundestøtte",
  "settings_version": "Versjon",
  "lang_en": "English",
  "lang_nb": "Norsk",
  "lang_es": "Español",
  "mod_quoteflow_name": "QuoteFlow",
  "mod_quoteflow_blurb": "Gjør kjøper, produkt, mengde, Incoterm og gyldighet om til et strukturert tilbudsutkast.",
  "mod_quoteflow_hint": "Kjøper i Hamburg trenger 2×20ft containere med frossen laks, CIF Hamburg, 30 dagers gyldighet…",
  "mod_landed-cost_name": "Landkostnad AI",
  "mod_landed-cost_blurb": "Veiledende landkostnad: HS-kode, tollverdi, frakt, toll, mva og avgifter.",
  "mod_landed-cost_hint": "Importerer keramiske fliser fra Foshan til Oslo, FOB Qingdao, 18 paller…",
  "mod_trade-finance_name": "Handelsfinans AI",
  "mod_trade-finance_blurb": "Vurder betalingsrisiko og tryggere løsninger: remburs, inkasso, kredittforsikring.",
  "mod_trade-finance_hint": "Ny kjøper i Peru, første ordre €85k maskiner, åpen konto 60 dager forespurt…"
},
  es: {
  "tab_home": "Inicio",
  "tab_modules": "Módulos",
  "tab_subscribe": "Suscribirse",
  "tab_settings": "Ajustes",
  "home_tagline": "Piensa el negocio internacional antes de comprometerte.",
  "home_lead": "Cotizaciones, coste en destino y financiación comercial — en una app.",
  "home_cta": "Abrir un módulo",
  "home_how": "Cómo funciona",
  "home_how_1": "Describe el caso en lenguaje natural — sin formularios ni cuenta.",
  "home_how_2": "IA en vivo si hay red; análisis en el dispositivo como respaldo.",
  "home_how_3": "Obtén puntuación, evaluación breve y siguientes pasos.",
  "modules_title": "Módulos",
  "modules_subtitle": "Elige una herramienta y describe tu caso.",
  "analyze_placeholder": "Describe tu caso…",
  "analyze_run": "Analizar",
  "analyze_running": "Analizando…",
  "analyze_confidence": "Confianza",
  "analyze_assessment": "Evaluación",
  "analyze_steps": "Siguientes pasos",
  "analyze_source_live": "IA en vivo",
  "analyze_source_local": "Respaldo en dispositivo",
  "analyze_disclaimer": "Apoyo orientativo — no es asesoría legal, aduanera, fiscal, financiera ni de inversión.",
  "subscribe_title": "Suscribirse",
  "subscribe_lead": "Las suscripciones se venden en la web vía ML-TRADE-PAYMENTS. La app es gratis.",
  "subscribe_monthly": "Mensual",
  "subscribe_yearly": "Anual",
  "subscribe_price_monthly": "€19.99 / mes",
  "subscribe_price_yearly": "€199.99 / año",
  "subscribe_save": "Ahorra 17% vs mensual",
  "subscribe_cta": "Ir al checkout",
  "subscribe_email_fallback": "Solicitar acceso por email",
  "subscribe_missing_payments": "Falta la URL de ML-TRADE-PAYMENTS. Usa el email o define EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL.",
  "subscribe_includes": "Todos los módulos · IA en vivo · Soporte email · Cancela cuando quieras",
  "settings_title": "Ajustes",
  "settings_language": "Idioma",
  "settings_appearance": "Apariencia",
  "settings_system": "Sistema",
  "settings_light": "Claro",
  "settings_dark": "Oscuro",
  "settings_privacy": "Privacidad",
  "settings_terms": "Términos",
  "settings_support": "Soporte",
  "settings_version": "Versión",
  "lang_en": "English",
  "lang_nb": "Norsk",
  "lang_es": "Español",
  "mod_quoteflow_name": "QuoteFlow",
  "mod_quoteflow_blurb": "Convierte comprador, producto, cantidad, Incoterm y validez en un briefing de cotización.",
  "mod_quoteflow_hint": "Comprador en Hamburgo necesita 2×20ft de salmón congelado, CIF Hamburgo, validez 30 días…",
  "mod_landed-cost_name": "Coste en destino AI",
  "mod_landed-cost_blurb": "Partidas orientativas: código HS, valor en aduana, flete, arancel, IVA y tasas.",
  "mod_landed-cost_hint": "Importación de azulejos de Foshan a Oslo, FOB Qingdao, 18 palés…",
  "mod_trade-finance_name": "Financiación comercial AI",
  "mod_trade-finance_blurb": "Evalúa riesgo de pago y estructuras más seguras: créditos documentarios, cobranzas, seguros.",
  "mod_trade-finance_hint": "Nuevo comprador en Perú, primer pedido €85k maquinaria, pide cuenta abierta 60 días…"
},
} as const;

export const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

const KEY = 'tollvik.locale';

export function deviceLocale(): Locale {
  const code = (Localization.getLocales()[0]?.languageCode || 'en').toLowerCase();
  if (code === 'nb' || code === 'nn' || code === 'no') return 'nb';
  if (code === 'es') return 'es';
  return 'en';
}

export async function loadLocale(): Promise<Locale> {
  const saved = await AsyncStorage.getItem(KEY);
  const loc = (saved as Locale) || deviceLocale();
  i18n.locale = loc;
  return loc;
}

export async function setLocale(loc: Locale) {
  i18n.locale = loc;
  await AsyncStorage.setItem(KEY, loc);
}

export function t(key: string, opts?: Record<string, unknown>) {
  return i18n.t(key, opts);
}

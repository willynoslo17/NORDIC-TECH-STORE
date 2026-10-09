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
  "home_tagline": "Discipline for two big decisions: where to invest and where to go next.",
  "home_lead": "Disciplined investment research and smarter trips.",
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
  "subscribe_price_monthly": "€7.99 / month",
  "subscribe_price_yearly": "€59.99 / year",
  "subscribe_save": "Save 37% vs monthly",
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
  "mod_alphayield_name": "AlphaYield",
  "mod_alphayield_blurb": "Structured research brief: thesis, downside, invalidation, liquidity and concentration.",
  "mod_alphayield_hint": "Thesis: Nordic renewable ETF, 5-year horizon, moderate risk, 15% portfolio…",
  "mod_willyverse-travel_name": "WillyVerse Travel AI",
  "mod_willyverse-travel_blurb": "Day-by-day route, budget split and local tips from experience in 87 countries.",
  "mod_willyverse-travel_hint": "Oslo → Lisbon, 6 days, 2 adults, €1800 total, food and walking focus…"
},
  nb: {
  "tab_home": "Hjem",
  "tab_modules": "Moduler",
  "tab_subscribe": "Abonner",
  "tab_settings": "Innstillinger",
  "home_tagline": "Struktur for to store beslutninger: hvor du investerer og hvor du reiser.",
  "home_lead": "Disiplinert investeringsresearch og smartere reiser.",
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
  "subscribe_price_monthly": "€7.99 / mnd",
  "subscribe_price_yearly": "€59.99 / år",
  "subscribe_save": "Spar 37% vs månedlig",
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
  "mod_alphayield_name": "AlphaYield",
  "mod_alphayield_blurb": "Strukturert research: tese, nedside, invalidering, likviditet og konsentrasjon.",
  "mod_alphayield_hint": "Tese: nordisk fornybar ETF, 5 års horisont, moderat risiko, 15 % portefølje…",
  "mod_willyverse-travel_name": "WillyVerse Reise-AI",
  "mod_willyverse-travel_blurb": "Dag-for-dag-rute, budsjettfordeling og lokale tips fra erfaring i 87 land.",
  "mod_willyverse-travel_hint": "Oslo → Lisboa, 6 dager, 2 voksne, €1800 totalt, mat og gåing…"
},
  es: {
  "tab_home": "Inicio",
  "tab_modules": "Módulos",
  "tab_subscribe": "Suscribirse",
  "tab_settings": "Ajustes",
  "home_tagline": "Disciplina para dos grandes decisiones: dónde invertir y a dónde ir.",
  "home_lead": "Investigación de inversión disciplinada y viajes más inteligentes.",
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
  "subscribe_price_monthly": "€7.99 / mes",
  "subscribe_price_yearly": "€59.99 / año",
  "subscribe_save": "Ahorra 37% vs mensual",
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
  "mod_alphayield_name": "AlphaYield",
  "mod_alphayield_blurb": "Briefing estructurado: tesis, downside, invalidación, liquidez y concentración.",
  "mod_alphayield_hint": "Tesis: ETF renovable nórdico, horizonte 5 años, riesgo moderado, 15% cartera…",
  "mod_willyverse-travel_name": "WillyVerse Travel AI",
  "mod_willyverse-travel_blurb": "Ruta día a día, reparto de presupuesto y tips locales de 87 países.",
  "mod_willyverse-travel_hint": "Oslo → Lisboa, 6 días, 2 adultos, €1800 total, foco comida y caminar…"
},
} as const;

export const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

const KEY = 'kursvik.locale';

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

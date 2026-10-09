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
  "home_tagline": "Check who you buy from and which rules apply — before you sign.",
  "home_lead": "Suppliers, compliance and economic radar — before you sign.",
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
  "subscribe_price_monthly": "€24.99 / month",
  "subscribe_price_yearly": "€249.99 / year",
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
  "mod_supplier-intelligence_name": "Supplier Intelligence",
  "mod_supplier-intelligence_blurb": "Organize identity and capacity evidence, risk score and due-diligence checklist.",
  "mod_supplier-intelligence_hint": "Factory in Dongguan offering LED drivers, claims ISO 9001, no site visit yet…",
  "mod_trade-compliance_name": "Trade Compliance",
  "mod_trade-compliance_blurb": "Destination rules, controlled goods flags and documents to prepare.",
  "mod_trade-compliance_hint": "Shipping lithium batteries and power tools from China to Norway for retail…",
  "mod_economic-radar_name": "Economic Radar",
  "mod_economic-radar_blurb": "Country and sector briefs: growth, inflation, rates, currency and exposure.",
  "mod_economic-radar_hint": "Should we expand seafood exports to Mexico this year given FX and rates?"
},
  nb: {
  "tab_home": "Hjem",
  "tab_modules": "Moduler",
  "tab_subscribe": "Abonner",
  "tab_settings": "Innstillinger",
  "home_tagline": "Sjekk hvem du kjøper fra og hvilke regler som gjelder – før du signerer.",
  "home_lead": "Leverandører, etterlevelse og økonomisk radar – før du signerer.",
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
  "subscribe_price_monthly": "€24.99 / mnd",
  "subscribe_price_yearly": "€249.99 / år",
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
  "mod_supplier-intelligence_name": "Leverandørinnsikt",
  "mod_supplier-intelligence_blurb": "Organiser identitets- og kapasitetsbevis, risikoscore og due diligence-sjekkliste.",
  "mod_supplier-intelligence_hint": "Fabrikk i Dongguan tilbyr LED-drivere, hevder ISO 9001, ingen fabrikkbesøk ennå…",
  "mod_trade-compliance_name": "Handelsregelverk",
  "mod_trade-compliance_blurb": "Destinasjonskrav, kontrollerte varer og dokumenter du må forberede.",
  "mod_trade-compliance_hint": "Sender litiumbatterier og elektroverktøy fra Kina til Norge for detaljhandel…",
  "mod_economic-radar_name": "Økonomisk radar",
  "mod_economic-radar_blurb": "Land- og sektorrapporter: vekst, inflasjon, renter, valuta og eksponering.",
  "mod_economic-radar_hint": "Bør vi ekspandere sjømateksport til Mexico i år gitt valuta og renter?"
},
  es: {
  "tab_home": "Inicio",
  "tab_modules": "Módulos",
  "tab_subscribe": "Suscribirse",
  "tab_settings": "Ajustes",
  "home_tagline": "Comprueba de quién compras y qué normas aplican — antes de firmar.",
  "home_lead": "Proveedores, cumplimiento y radar económico — antes de firmar.",
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
  "subscribe_price_monthly": "€24.99 / mes",
  "subscribe_price_yearly": "€249.99 / año",
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
  "mod_supplier-intelligence_name": "Inteligencia de proveedores",
  "mod_supplier-intelligence_blurb": "Organiza evidencia de identidad y capacidad, puntuación de riesgo y checklist.",
  "mod_supplier-intelligence_hint": "Fábrica en Dongguan ofrece drivers LED, dice ISO 9001, aún sin visita…",
  "mod_trade-compliance_name": "Cumplimiento comercial",
  "mod_trade-compliance_blurb": "Normas de destino, bienes controlados y documentos a preparar.",
  "mod_trade-compliance_hint": "Envío de baterías de litio y herramientas de China a Noruega para retail…",
  "mod_economic-radar_name": "Radar económico",
  "mod_economic-radar_blurb": "Informes de país y sector: crecimiento, inflación, tipos, divisa y exposición.",
  "mod_economic-radar_hint": "¿Debemos ampliar exportación de mariscos a México este año con FX y tipos?"
},
} as const;

export const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

const KEY = 'kildevik.locale';

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

#!/usr/bin/env node
/**
 * Scaffolds Tollvik, Kildevik and Kursvik Expo apps with distinct branding.
 * Run: node scripts/scaffold-expo-apps.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPS = path.join(ROOT, 'apps');

const SPECS = [
  {
    id: 'tollvik',
    name: 'Tollvik',
    slug: 'tollvik',
    scheme: 'tollvik',
    bundleId: 'no.mlinternasjonal.tollvik',
    package: 'no.mlinternasjonal.tollvik',
    tagline: {
      en: 'Think a cross-border deal through before you commit.',
      nb: 'Tenk gjennom en internasjonal handel før du forplikter deg.',
      es: 'Piensa el negocio internacional antes de comprometerte.',
    },
    description: {
      en: 'Quotes, landed cost and trade finance — in one app.',
      nb: 'Tilbud, landkostnad og handelsfinans — i én app.',
      es: 'Cotizaciones, coste en destino y financiación comercial — en una app.',
    },
    prices: { monthly: '€19.99', yearly: '€199.99', monthlySave: null, yearlySave: '17%' },
    colors: {
      light: {
        bg: '#F3F6FA',
        surface: '#FFFFFF',
        ink: '#0A1628',
        muted: '#5A6B7D',
        line: '#D5DEE8',
        primary: '#0B2748',
        accent: '#1D6B9F',
        success: '#1F7A4D',
        warning: '#B86A1A',
        danger: '#B42318',
        tabInactive: '#8A9AAB',
      },
      dark: {
        bg: '#061018',
        surface: '#0E1A28',
        ink: '#E8EEF5',
        muted: '#8FA0B3',
        line: '#1E2E40',
        primary: '#6EB0E0',
        accent: '#3D8FC4',
        success: '#3DB87A',
        warning: '#E0A04A',
        danger: '#F07060',
        tabInactive: '#6A7A8C',
      },
    },
    fonts: {
      display: 'Fraunces_700Bold',
      displayFamily: 'Fraunces',
      body: 'SourceSans3_400Regular',
      bodyFamily: 'SourceSans3',
      bodyBold: 'SourceSans3_700Bold',
    },
    radius: 20,
    modules: [
      {
        id: 'quoteflow',
        icon: 'document-text-outline',
        name: { en: 'QuoteFlow', nb: 'QuoteFlow', es: 'QuoteFlow' },
        blurb: {
          en: 'Turn buyer, product, quantity, Incoterm and validity into a structured quotation brief.',
          nb: 'Gjør kjøper, produkt, mengde, Incoterm og gyldighet om til et strukturert tilbudsutkast.',
          es: 'Convierte comprador, producto, cantidad, Incoterm y validez en un briefing de cotización.',
        },
        promptHint: {
          en: 'Buyer in Hamburg needs 2×20ft containers of frozen salmon, CIF Hamburg, 30-day validity…',
          nb: 'Kjøper i Hamburg trenger 2×20ft containere med frossen laks, CIF Hamburg, 30 dagers gyldighet…',
          es: 'Comprador en Hamburgo necesita 2×20ft de salmón congelado, CIF Hamburgo, validez 30 días…',
        },
      },
      {
        id: 'landed-cost',
        icon: 'calculator-outline',
        name: { en: 'Landed Cost AI', nb: 'Landkostnad AI', es: 'Coste en destino AI' },
        blurb: {
          en: 'Indicative landed-cost items: HS code, customs value, freight, duty, VAT and fees.',
          nb: 'Veiledende landkostnad: HS-kode, tollverdi, frakt, toll, mva og avgifter.',
          es: 'Partidas orientativas: código HS, valor en aduana, flete, arancel, IVA y tasas.',
        },
        promptHint: {
          en: 'Importing ceramic tiles from Foshan to Oslo, FOB Qingdao, 18 pallets…',
          nb: 'Importerer keramiske fliser fra Foshan til Oslo, FOB Qingdao, 18 paller…',
          es: 'Importación de azulejos de Foshan a Oslo, FOB Qingdao, 18 palés…',
        },
      },
      {
        id: 'trade-finance',
        icon: 'shield-checkmark-outline',
        name: { en: 'Trade Finance AI', nb: 'Handelsfinans AI', es: 'Financiación comercial AI' },
        blurb: {
          en: 'Screen payment risk and safer structures: LCs, collections, insured receivables.',
          nb: 'Vurder betalingsrisiko og tryggere løsninger: remburs, inkasso, kredittforsikring.',
          es: 'Evalúa riesgo de pago y estructuras más seguras: créditos documentarios, cobranzas, seguros.',
        },
        promptHint: {
          en: 'New buyer in Peru, first order €85k machinery, open account 60 days requested…',
          nb: 'Ny kjøper i Peru, første ordre €85k maskiner, åpen konto 60 dager forespurt…',
          es: 'Nuevo comprador en Perú, primer pedido €85k maquinaria, pide cuenta abierta 60 días…',
        },
      },
    ],
  },
  {
    id: 'kildevik',
    name: 'Kildevik',
    slug: 'kildevik',
    scheme: 'kildevik',
    bundleId: 'no.mlinternasjonal.kildevik',
    package: 'no.mlinternasjonal.kildevik',
    tagline: {
      en: 'Check who you buy from and which rules apply — before you sign.',
      nb: 'Sjekk hvem du kjøper fra og hvilke regler som gjelder – før du signerer.',
      es: 'Comprueba de quién compras y qué normas aplican — antes de firmar.',
    },
    description: {
      en: 'Suppliers, compliance and economic radar — before you sign.',
      nb: 'Leverandører, etterlevelse og økonomisk radar – før du signerer.',
      es: 'Proveedores, cumplimiento y radar económico — antes de firmar.',
    },
    prices: { monthly: '€24.99', yearly: '€249.99', monthlySave: null, yearlySave: '17%' },
    colors: {
      light: {
        bg: '#F2F7F4',
        surface: '#FFFFFF',
        ink: '#0F241C',
        muted: '#4F675C',
        line: '#C9D9D0',
        primary: '#194F3D',
        accent: '#2A7A5C',
        success: '#1F7A4D',
        warning: '#A86B1A',
        danger: '#A33A2C',
        tabInactive: '#7A9186',
      },
      dark: {
        bg: '#071410',
        surface: '#0E221A',
        ink: '#E6F2EC',
        muted: '#8AABA0',
        line: '#1A3328',
        primary: '#5ECF9A',
        accent: '#3DA87A',
        success: '#4AD090',
        warning: '#E0A84A',
        danger: '#E07868',
        tabInactive: '#6A8578',
      },
    },
    fonts: {
      display: 'LibreBaskerville_700Bold',
      displayFamily: 'LibreBaskerville',
      body: 'DMSans_400Regular',
      bodyFamily: 'DMSans',
      bodyBold: 'DMSans_700Bold',
    },
    radius: 16,
    modules: [
      {
        id: 'supplier-intelligence',
        icon: 'people-outline',
        name: { en: 'Supplier Intelligence', nb: 'Leverandørinnsikt', es: 'Inteligencia de proveedores' },
        blurb: {
          en: 'Organize identity and capacity evidence, risk score and due-diligence checklist.',
          nb: 'Organiser identitets- og kapasitetsbevis, risikoscore og due diligence-sjekkliste.',
          es: 'Organiza evidencia de identidad y capacidad, puntuación de riesgo y checklist.',
        },
        promptHint: {
          en: 'Factory in Dongguan offering LED drivers, claims ISO 9001, no site visit yet…',
          nb: 'Fabrikk i Dongguan tilbyr LED-drivere, hevder ISO 9001, ingen fabrikkbesøk ennå…',
          es: 'Fábrica en Dongguan ofrece drivers LED, dice ISO 9001, aún sin visita…',
        },
      },
      {
        id: 'trade-compliance',
        icon: 'clipboard-outline',
        name: { en: 'Trade Compliance', nb: 'Handelsregelverk', es: 'Cumplimiento comercial' },
        blurb: {
          en: 'Destination rules, controlled goods flags and documents to prepare.',
          nb: 'Destinasjonskrav, kontrollerte varer og dokumenter du må forberede.',
          es: 'Normas de destino, bienes controlados y documentos a preparar.',
        },
        promptHint: {
          en: 'Shipping lithium batteries and power tools from China to Norway for retail…',
          nb: 'Sender litiumbatterier og elektroverktøy fra Kina til Norge for detaljhandel…',
          es: 'Envío de baterías de litio y herramientas de China a Noruega para retail…',
        },
      },
      {
        id: 'economic-radar',
        icon: 'pulse-outline',
        name: { en: 'Economic Radar', nb: 'Økonomisk radar', es: 'Radar económico' },
        blurb: {
          en: 'Country and sector briefs: growth, inflation, rates, currency and exposure.',
          nb: 'Land- og sektorrapporter: vekst, inflasjon, renter, valuta og eksponering.',
          es: 'Informes de país y sector: crecimiento, inflación, tipos, divisa y exposición.',
        },
        promptHint: {
          en: 'Should we expand seafood exports to Mexico this year given FX and rates?',
          nb: 'Bør vi ekspandere sjømateksport til Mexico i år gitt valuta og renter?',
          es: '¿Debemos ampliar exportación de mariscos a México este año con FX y tipos?',
        },
      },
    ],
  },
  {
    id: 'kursvik',
    name: 'Kursvik',
    slug: 'kursvik',
    scheme: 'kursvik',
    bundleId: 'no.mlinternasjonal.kursvik',
    package: 'no.mlinternasjonal.kursvik',
    tagline: {
      en: 'Discipline for two big decisions: where to invest and where to go next.',
      nb: 'Struktur for to store beslutninger: hvor du investerer og hvor du reiser.',
      es: 'Disciplina para dos grandes decisiones: dónde invertir y a dónde ir.',
    },
    description: {
      en: 'Disciplined investment research and smarter trips.',
      nb: 'Disiplinert investeringsresearch og smartere reiser.',
      es: 'Investigación de inversión disciplinada y viajes más inteligentes.',
    },
    prices: { monthly: '€7.99', yearly: '€59.99', monthlySave: null, yearlySave: '37%' },
    colors: {
      light: {
        bg: '#FAF6F0',
        surface: '#FFFCF7',
        ink: '#2A1F12',
        muted: '#7A6A55',
        line: '#E5D8C4',
        primary: '#6D5225',
        accent: '#A67C3A',
        success: '#3D7A4A',
        warning: '#B86A1A',
        danger: '#A33A2C',
        tabInactive: '#A09078',
      },
      dark: {
        bg: '#120E08',
        surface: '#1C1610',
        ink: '#F5ECDC',
        muted: '#B0A08A',
        line: '#332820',
        primary: '#D4B06A',
        accent: '#C49A4A',
        success: '#6AD090',
        warning: '#E0A84A',
        danger: '#E07868',
        tabInactive: '#8A7A65',
      },
    },
    fonts: {
      display: 'PlayfairDisplay_700Bold',
      displayFamily: 'PlayfairDisplay',
      body: 'NunitoSans_400Regular',
      bodyFamily: 'NunitoSans',
      bodyBold: 'NunitoSans_700Bold',
    },
    radius: 24,
    modules: [
      {
        id: 'alphayield',
        icon: 'trending-up-outline',
        name: { en: 'AlphaYield', nb: 'AlphaYield', es: 'AlphaYield' },
        blurb: {
          en: 'Structured research brief: thesis, downside, invalidation, liquidity and concentration.',
          nb: 'Strukturert research: tese, nedside, invalidering, likviditet og konsentrasjon.',
          es: 'Briefing estructurado: tesis, downside, invalidación, liquidez y concentración.',
        },
        promptHint: {
          en: 'Thesis: Nordic renewable ETF, 5-year horizon, moderate risk, 15% portfolio…',
          nb: 'Tese: nordisk fornybar ETF, 5 års horisont, moderat risiko, 15 % portefølje…',
          es: 'Tesis: ETF renovable nórdico, horizonte 5 años, riesgo moderado, 15% cartera…',
        },
      },
      {
        id: 'willyverse-travel',
        icon: 'airplane-outline',
        name: { en: 'WillyVerse Travel AI', nb: 'WillyVerse Reise-AI', es: 'WillyVerse Travel AI' },
        blurb: {
          en: 'Day-by-day route, budget split and local tips from experience in 87 countries.',
          nb: 'Dag-for-dag-rute, budsjettfordeling og lokale tips fra erfaring i 87 land.',
          es: 'Ruta día a día, reparto de presupuesto y tips locales de 87 países.',
        },
        promptHint: {
          en: 'Oslo → Lisbon, 6 days, 2 adults, €1800 total, food and walking focus…',
          nb: 'Oslo → Lisboa, 6 dager, 2 voksne, €1800 totalt, mat og gåing…',
          es: 'Oslo → Lisboa, 6 días, 2 adultos, €1800 total, foco comida y caminar…',
        },
      },
    ],
  },
];

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function packageJson(spec) {
  return JSON.stringify(
    {
      name: spec.id,
      version: '1.0.0',
      private: true,
      main: 'expo-router/entry',
      scripts: {
        start: 'expo start',
        android: 'expo start --android',
        ios: 'expo start --ios',
        web: 'expo start --web',
        lint: 'expo lint',
        typecheck: 'tsc --noEmit',
        'eas:build:ios': 'eas build --platform ios --profile production',
        'eas:build:android': 'eas build --platform android --profile production',
        'eas:submit:ios': 'eas submit --platform ios --profile production',
        'eas:submit:android': 'eas submit --platform android --profile production',
      },
      dependencies: {
        expo: '~52.0.46',
        'expo-router': '~4.0.20',
        'expo-status-bar': '~2.0.1',
        'expo-system-ui': '~4.0.9',
        'expo-splash-screen': '~0.29.24',
        'expo-font': '~13.0.4',
        'expo-linking': '~7.0.5',
        'expo-constants': '~17.0.8',
        'expo-localization': '~16.0.1',
        'expo-secure-store': '~14.0.1',
        'expo-web-browser': '~14.0.2',
        'expo-haptics': '~14.0.1',
        'expo-linear-gradient': '~14.0.2',
        react: '18.3.1',
        'react-dom': '18.3.1',
        'react-native': '0.76.9',
        'react-native-safe-area-context': '4.12.0',
        'react-native-screens': '~4.4.0',
        'react-native-gesture-handler': '~2.20.2',
        'react-native-reanimated': '~3.16.7',
        'react-native-svg': '15.8.0',
        '@expo/vector-icons': '^14.0.4',
        '@expo-google-fonts/fraunces': '^0.2.3',
        '@expo-google-fonts/source-sans-3': '^0.2.3',
        '@expo-google-fonts/libre-baskerville': '^0.2.3',
        '@expo-google-fonts/dm-sans': '^0.2.3',
        '@expo-google-fonts/playfair-display': '^0.2.3',
        '@expo-google-fonts/nunito-sans': '^0.2.3',
        'i18n-js': '^4.5.1',
        '@react-native-async-storage/async-storage': '1.23.1',
      },
      devDependencies: {
        '@babel/core': '^7.25.2',
        '@types/react': '~18.3.12',
        typescript: '~5.3.3',
        'eas-cli': '^16.3.0',
      },
      expo: {
        doctor: {
          reactNativeDirectoryCheck: {
            listUnknownPackages: 'off',
          },
        },
      },
    },
    null,
    2,
  );
}

function appJson(spec) {
  return JSON.stringify(
    {
      expo: {
        name: spec.name,
        slug: spec.slug,
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        scheme: spec.scheme,
        userInterfaceStyle: 'automatic',
        newArchEnabled: true,
        splash: {
          image: './assets/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: spec.colors.light.primary,
        },
        ios: {
          supportsTablet: true,
          bundleIdentifier: spec.bundleId,
          buildNumber: '1',
          infoPlist: {
            CFBundleAllowMixedLocalizations: true,
            ITSAppUsesNonExemptEncryption: false,
          },
          privacyManifests: {
            NSPrivacyAccessedAPITypes: [
              {
                NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
                NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
              },
            ],
          },
        },
        android: {
          adaptiveIcon: {
            foregroundImage: './assets/adaptive-icon.png',
            backgroundColor: spec.colors.light.primary,
          },
          package: spec.package,
          versionCode: 1,
          permissions: [],
          edgeToEdgeEnabled: true,
        },
        web: {
          bundler: 'metro',
          output: 'static',
          favicon: './assets/favicon.png',
        },
        plugins: [
          'expo-router',
          'expo-localization',
          'expo-secure-store',
          [
            'expo-splash-screen',
            {
              image: './assets/splash-icon.png',
              backgroundColor: spec.colors.light.primary,
              imageWidth: 200,
            },
          ],
        ],
        experiments: { typedRoutes: true },
        extra: {
          eas: {
            // Fill after `eas init` / `eas project:info` — do not invent IDs.
            projectId: '',
          },
          appId: spec.id,
          paymentsBaseUrl: process.env.EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL || '',
          aiWebhookUrl: process.env.EXPO_PUBLIC_AI_WEBHOOK_URL || '',
          privacyUrl: `https://apps.mlinternasjonal.no/${spec.id}/privacy/`,
          supportUrl: 'https://apps.mlinternasjonal.no/',
          termsUrl: `https://apps.mlinternasjonal.no/${spec.id}/terms/`,
          pricingUrl: `https://apps.mlinternasjonal.no/${spec.id}/#pricing`,
        },
        owner: '',
        runtimeVersion: { policy: 'appVersion' },
        updates: {
          url: '',
        },
      },
    },
    null,
    2,
  );
}

function easJson() {
  return JSON.stringify(
    {
      cli: { version: '>= 16.0.0', appVersionSource: 'remote' },
      build: {
        development: {
          developmentClient: true,
          distribution: 'internal',
          ios: { simulator: true },
        },
        preview: {
          distribution: 'internal',
          android: { buildType: 'apk' },
          ios: { simulator: false },
        },
        production: {
          autoIncrement: true,
          android: { buildType: 'app-bundle' },
          ios: {},
        },
      },
      submit: {
        production: {
          ios: {
            // Fill from App Store Connect — do not invent.
            appleId: '',
            ascAppId: '',
            appleTeamId: '',
          },
          android: {
            serviceAccountKeyPath: './secrets/google-play-service-account.json',
            track: 'internal',
          },
        },
      },
    },
    null,
    2,
  );
}

function tsconfig() {
  return JSON.stringify(
    {
      extends: 'expo/tsconfig.base',
      compilerOptions: {
        strict: true,
        paths: { '@/*': ['./src/*'] },
      },
      include: ['**/*.ts', '**/*.tsx', '.expo/types/**/*.ts', 'expo-env.d.ts'],
    },
    null,
    2,
  );
}

function babelConfig() {
  return `module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
`;
}

function envExample(spec) {
  return `# Public runtime (safe to embed in the app binary — never put private keys here)
EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL=
EXPO_PUBLIC_AI_WEBHOOK_URL=
EXPO_PUBLIC_SUPPORT_EMAIL=kontakt@mlinternasjonal.no

# EAS / store credentials — set via \`eas secret:create\` or local secrets/, never commit values
# EAS_PROJECT_ID=
# EXPO_TOKEN=
# APPLE_ID=
# APPLE_TEAM_ID=
# ASC_APP_ID=
# GOOGLE_SERVICE_ACCOUNT_KEY=./secrets/google-play-service-account.json
`;
}

function readme(spec) {
  const mods = spec.modules.map((m) => `- **${m.name.en}** (\`${m.id}\`)`).join('\n');
  return `# ${spec.name}

Expo (React Native) app for iOS and Android — ML Internasjonal Handel.

${spec.tagline.en}

## Modules

${mods}

## Design

- Light and dark mode (\`userInterfaceStyle: automatic\`)
- Large display typography + readable body text
- Rounded cards, bottom tabs, Reanimated transitions
- Brand palette unique to ${spec.name} (not shared across the sister apps)

## Languages

Norwegian (\`nb\`), English (\`en\`), Spanish (\`es\`). Change in **Settings**.

## Payments (ML-TRADE-PAYMENTS)

In-app purchases are **not** used. Subscriptions are sold on the web via **ML-TRADE-PAYMENTS**.

1. Set \`EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL\` to the ML-TRADE-PAYMENTS API base (e.g. \`https://payments.example/api\`).
2. The app calls \`POST {base}/checkout/session\` with \`{ app, plan: "monthly"|"yearly" }\` and opens the returned \`url\` in the system browser.
3. Until the URL is configured, the Subscribe screen falls back to \`mailto:kontakt@mlinternasjonal.no\`.

Do **not** put Stripe secret keys in this app.

## AI analysis

- Live path: \`EXPO_PUBLIC_AI_WEBHOOK_URL\` (Make → model), HTTPS POST with \`{ app, module, locale, text }\`.
- Fallback: on-device heuristic brief (confidence + assessment + next steps) when the webhook is missing or offline.

## Run locally

\`\`\`bash
cd apps/${spec.id}
cp .env.example .env
npm install
npx expo start
\`\`\`

## EAS build (ready, credentials missing)

\`\`\`bash
npm i -g eas-cli
eas login
eas init          # creates real projectId — paste into app.json extra.eas.projectId
eas build --platform ios --profile production
eas build --platform android --profile production
\`\`\`

### Missing credentials (do not invent — fill before store submit)

| Item | Where | Status |
|------|--------|--------|
| Expo account / \`EXPO_TOKEN\` | expo.dev | **Missing** |
| EAS \`projectId\` | \`eas init\` → \`app.json\` \`extra.eas.projectId\` | **Missing** (empty placeholder) |
| \`owner\` in app.json | Expo org/user | **Missing** |
| Apple Developer Program membership | developer.apple.com | **Missing** |
| Apple Team ID | App Store Connect / Membership | **Missing** |
| Apple ID (for submit) | ASC | **Missing** |
| ASC App ID (numeric) | App Store Connect → App Information | **Missing** (create app record first) |
| iOS distribution cert + provisioning | managed by EAS after Apple login | **Missing** |
| Google Play Console developer account | play.google.com/console | **Missing** |
| Google Play app listing | Console → Create app | **Missing** |
| Google service account JSON | Console → API access | **Missing** (\`secrets/google-play-service-account.json\`) |
| \`EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL\` | env / EAS secret | **Missing** |
| \`EXPO_PUBLIC_AI_WEBHOOK_URL\` | env / EAS secret | **Missing** |
| Privacy / Support URLs verified in ASC & Play | apps.mlinternasjonal.no | Public pages exist; confirm before review |

Pricing (web only): monthly **${spec.prices.monthly}**, yearly **${spec.prices.yearly}**.

## Legal

Seller: Martinez Lozano Internasjonal Handel (ENK), org. no. 935 407 095, Oslo, Norway.  
Privacy: https://apps.mlinternasjonal.no/${spec.id}/privacy/  
Support: kontakt@mlinternasjonal.no

Decision-support software only — not legal, customs, tax, financial or investment advice.
`;
}

function themeTs(spec) {
  return `export type ThemeColors = {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  tabInactive: string;
};

export const light: ThemeColors = ${JSON.stringify(spec.colors.light, null, 2)};

export const dark: ThemeColors = ${JSON.stringify(spec.colors.dark, null, 2)};

export const fonts = {
  display: '${spec.fonts.display}',
  body: '${spec.fonts.body}',
  bodyBold: '${spec.fonts.bodyBold}',
  displayFamily: '${spec.fonts.displayFamily}',
  bodyFamily: '${spec.fonts.bodyFamily}',
} as const;

export const radius = ${spec.radius};
export const appName = '${spec.name}';
export const appId = '${spec.id}';
`;
}

function i18nTs(spec) {
  const moduleStrings = {};
  for (const lang of ['en', 'nb', 'es']) {
    moduleStrings[lang] = {};
    for (const m of spec.modules) {
      moduleStrings[lang][`mod_${m.id}_name`] = m.name[lang];
      moduleStrings[lang][`mod_${m.id}_blurb`] = m.blurb[lang];
      moduleStrings[lang][`mod_${m.id}_hint`] = m.promptHint[lang];
    }
  }

  const en = {
    tab_home: 'Home',
    tab_modules: 'Modules',
    tab_subscribe: 'Subscribe',
    tab_settings: 'Settings',
    home_tagline: spec.tagline.en,
    home_lead: spec.description.en,
    home_cta: 'Open a module',
    home_how: 'How it works',
    home_how_1: 'Describe your case in plain language — no forms, no account.',
    home_how_2: 'Live AI when online; on-device analysis as fallback.',
    home_how_3: 'Get a confidence score, short assessment and next steps.',
    modules_title: 'Modules',
    modules_subtitle: 'Pick a tool and describe your case.',
    analyze_placeholder: 'Describe your case…',
    analyze_run: 'Analyze',
    analyze_running: 'Analyzing…',
    analyze_confidence: 'Confidence',
    analyze_assessment: 'Assessment',
    analyze_steps: 'Next steps',
    analyze_source_live: 'Live AI',
    analyze_source_local: 'On-device fallback',
    analyze_disclaimer:
      'Indicative decision support — not legal, customs, tax, financial or investment advice.',
    subscribe_title: 'Subscribe',
    subscribe_lead: 'Subscriptions are sold on the web via ML-TRADE-PAYMENTS. The app download is free.',
    subscribe_monthly: 'Monthly',
    subscribe_yearly: 'Yearly',
    subscribe_price_monthly: spec.prices.monthly + ' / month',
    subscribe_price_yearly: spec.prices.yearly + ' / year',
    subscribe_save: spec.prices.yearlySave
      ? `Save ${spec.prices.yearlySave} vs monthly`
      : '',
    subscribe_cta: 'Continue to checkout',
    subscribe_email_fallback: 'Request access by email',
    subscribe_missing_payments:
      'ML-TRADE-PAYMENTS URL is not configured yet. Use email or set EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL.',
    subscribe_includes: 'All modules · Live AI · Email support · Cancel anytime',
    settings_title: 'Settings',
    settings_language: 'Language',
    settings_appearance: 'Appearance',
    settings_system: 'System',
    settings_light: 'Light',
    settings_dark: 'Dark',
    settings_privacy: 'Privacy policy',
    settings_terms: 'Terms',
    settings_support: 'Support',
    settings_version: 'Version',
    lang_en: 'English',
    lang_nb: 'Norsk',
    lang_es: 'Español',
    ...moduleStrings.en,
  };

  const nb = {
    ...en,
    tab_home: 'Hjem',
    tab_modules: 'Moduler',
    tab_subscribe: 'Abonner',
    tab_settings: 'Innstillinger',
    home_tagline: spec.tagline.nb,
    home_lead: spec.description.nb,
    home_cta: 'Åpne en modul',
    home_how: 'Slik fungerer det',
    home_how_1: 'Beskriv saken med egne ord – ingen skjemaer, ingen konto.',
    home_how_2: 'AI når du er på nett; analyse på enheten som reserve.',
    home_how_3: 'Få score, kort vurdering og neste steg.',
    modules_title: 'Moduler',
    modules_subtitle: 'Velg et verktøy og beskriv saken.',
    analyze_placeholder: 'Beskriv saken…',
    analyze_run: 'Analyser',
    analyze_running: 'Analyserer…',
    analyze_confidence: 'Sikkerhet',
    analyze_assessment: 'Vurdering',
    analyze_steps: 'Neste steg',
    analyze_source_live: 'Live AI',
    analyze_source_local: 'Lokal reserve',
    analyze_disclaimer:
      'Veiledende beslutningsstøtte — ikke juridisk, toll-, skatte-, finansiell eller investeringsrådgivning.',
    subscribe_title: 'Abonner',
    subscribe_lead: 'Abonnement selges på nett via ML-TRADE-PAYMENTS. Appen er gratis å laste ned.',
    subscribe_monthly: 'Månedlig',
    subscribe_yearly: 'Årlig',
    subscribe_price_monthly: spec.prices.monthly + ' / mnd',
    subscribe_price_yearly: spec.prices.yearly + ' / år',
    subscribe_save: spec.prices.yearlySave
      ? `Spar ${spec.prices.yearlySave} vs månedlig`
      : '',
    subscribe_cta: 'Gå til betaling',
    subscribe_email_fallback: 'Be om tilgang på e-post',
    subscribe_missing_payments:
      'ML-TRADE-PAYMENTS-URL er ikke satt. Bruk e-post eller sett EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL.',
    subscribe_includes: 'Alle moduler · Live AI · E-poststøtte · Si opp når som helst',
    settings_title: 'Innstillinger',
    settings_language: 'Språk',
    settings_appearance: 'Utseende',
    settings_system: 'System',
    settings_light: 'Lyst',
    settings_dark: 'Mørkt',
    settings_privacy: 'Personvern',
    settings_terms: 'Vilkår',
    settings_support: 'Kundestøtte',
    settings_version: 'Versjon',
    lang_en: 'English',
    lang_nb: 'Norsk',
    lang_es: 'Español',
    ...moduleStrings.nb,
  };

  const es = {
    ...en,
    tab_home: 'Inicio',
    tab_modules: 'Módulos',
    tab_subscribe: 'Suscribirse',
    tab_settings: 'Ajustes',
    home_tagline: spec.tagline.es,
    home_lead: spec.description.es,
    home_cta: 'Abrir un módulo',
    home_how: 'Cómo funciona',
    home_how_1: 'Describe el caso en lenguaje natural — sin formularios ni cuenta.',
    home_how_2: 'IA en vivo si hay red; análisis en el dispositivo como respaldo.',
    home_how_3: 'Obtén puntuación, evaluación breve y siguientes pasos.',
    modules_title: 'Módulos',
    modules_subtitle: 'Elige una herramienta y describe tu caso.',
    analyze_placeholder: 'Describe tu caso…',
    analyze_run: 'Analizar',
    analyze_running: 'Analizando…',
    analyze_confidence: 'Confianza',
    analyze_assessment: 'Evaluación',
    analyze_steps: 'Siguientes pasos',
    analyze_source_live: 'IA en vivo',
    analyze_source_local: 'Respaldo en dispositivo',
    analyze_disclaimer:
      'Apoyo orientativo — no es asesoría legal, aduanera, fiscal, financiera ni de inversión.',
    subscribe_title: 'Suscribirse',
    subscribe_lead:
      'Las suscripciones se venden en la web vía ML-TRADE-PAYMENTS. La app es gratis.',
    subscribe_monthly: 'Mensual',
    subscribe_yearly: 'Anual',
    subscribe_price_monthly: spec.prices.monthly + ' / mes',
    subscribe_price_yearly: spec.prices.yearly + ' / año',
    subscribe_save: spec.prices.yearlySave
      ? `Ahorra ${spec.prices.yearlySave} vs mensual`
      : '',
    subscribe_cta: 'Ir al checkout',
    subscribe_email_fallback: 'Solicitar acceso por email',
    subscribe_missing_payments:
      'Falta la URL de ML-TRADE-PAYMENTS. Usa el email o define EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL.',
    subscribe_includes: 'Todos los módulos · IA en vivo · Soporte email · Cancela cuando quieras',
    settings_title: 'Ajustes',
    settings_language: 'Idioma',
    settings_appearance: 'Apariencia',
    settings_system: 'Sistema',
    settings_light: 'Claro',
    settings_dark: 'Oscuro',
    settings_privacy: 'Privacidad',
    settings_terms: 'Términos',
    settings_support: 'Soporte',
    settings_version: 'Versión',
    lang_en: 'English',
    lang_nb: 'Norsk',
    lang_es: 'Español',
    ...moduleStrings.es,
  };

  return `import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Locale = 'en' | 'nb' | 'es';

const translations = {
  en: ${JSON.stringify(en, null, 2)},
  nb: ${JSON.stringify(nb, null, 2)},
  es: ${JSON.stringify(es, null, 2)},
} as const;

export const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

const KEY = '${spec.id}.locale';

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
`;
}

function modulesTs(spec) {
  return `export type ModuleDef = {
  id: string;
  icon: string;
};

export const MODULES: ModuleDef[] = ${JSON.stringify(
    spec.modules.map((m) => ({ id: m.id, icon: m.icon })),
    null,
    2,
  )};
`;
}

function paymentsTs() {
  return `import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

export type Plan = 'monthly' | 'yearly';

type CheckoutResponse = { url?: string; checkoutUrl?: string; error?: string };

function paymentsBase(): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  return (
    process.env.EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL ||
    extra?.paymentsBaseUrl ||
    ''
  ).replace(/\\/$/, '');
}

export function paymentsConfigured(): boolean {
  return Boolean(paymentsBase());
}

/**
 * Opens ML-TRADE-PAYMENTS checkout. Never embeds Stripe secrets in the client.
 * Expected API: POST {base}/checkout/session  body { app, plan } → { url }
 */
export async function startCheckout(appId: string, plan: Plan): Promise<{ ok: boolean; reason?: string }> {
  const base = paymentsBase();
  if (!base) {
    return { ok: false, reason: 'missing_payments_url' };
  }
  try {
    const res = await fetch(\`\${base}/checkout/session\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ app: appId, plan, source: 'expo-app' }),
    });
    const data = (await res.json().catch(() => ({}))) as CheckoutResponse;
    const url = data.url || data.checkoutUrl;
    if (!res.ok || !url) {
      return { ok: false, reason: data.error || \`http_\${res.status}\` };
    }
    await WebBrowser.openBrowserAsync(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'network_error' };
  }
}

export async function openEmailSubscribe(appName: string, plan: Plan) {
  const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'kontakt@mlinternasjonal.no';
  const subject = encodeURIComponent(\`\${appName} – \${plan}\`);
  await Linking.openURL(\`mailto:\${email}?subject=\${subject}\`);
}
`;
}

function aiTs(spec) {
  return `import Constants from 'expo-constants';

export type AnalysisResult = {
  confidence: number;
  assessment: string;
  nextSteps: string[];
  source: 'live' | 'local';
};

function webhookUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  return process.env.EXPO_PUBLIC_AI_WEBHOOK_URL || extra?.aiWebhookUrl || '';
}

function localFallback(moduleId: string, text: string, locale: string): AnalysisResult {
  const words = text.trim().split(/\\s+/).filter(Boolean).length;
  const confidence = Math.max(42, Math.min(88, 55 + Math.min(words, 40) - 5));
  const heads: Record<string, Record<string, string>> = {
    en: {
      default: 'Structured brief from your description (on-device fallback).',
      assessment:
        'Key commercial points were extracted. Confirm figures, counterparties and destination rules with primary sources before committing.',
    },
    nb: {
      default: 'Strukturert brief ut fra beskrivelsen (lokal reserve).',
      assessment:
        'Viktige kommersielle punkter er trukket ut. Bekreft tall, motparter og destinasjonsregler med primærkilder før du forplikter deg.',
    },
    es: {
      default: 'Brief estructurado a partir de tu descripción (respaldo local).',
      assessment:
        'Se extrajeron puntos comerciales clave. Confirma cifras, contrapartes y normas de destino con fuentes primarias antes de comprometerte.',
    },
  };
  const L = heads[locale] || heads.en;
  const stepsEn = [
    'List unknowns that still need a quote or official check.',
    'Verify Incoterms, currency and payment structure with the counterparty.',
    'Document assumptions separately from confirmed facts.',
  ];
  const stepsNb = [
    'List ukjente som fortsatt trenger tilbud eller offisiell sjekk.',
    'Bekreft Incoterms, valuta og betalingsstruktur med motparten.',
    'Skill antagelser fra bekreftede fakta i dokumentasjonen.',
  ];
  const stepsEs = [
    'Lista lo desconocido que aún requiere cotización o verificación oficial.',
    'Verifica Incoterms, moneda y estructura de pago con la contraparte.',
    'Separa supuestos de hechos confirmados en la documentación.',
  ];
  const steps = locale === 'nb' ? stepsNb : locale === 'es' ? stepsEs : stepsEn;
  return {
    confidence,
    assessment: \`\${L.default} Module: \${moduleId}. \${L.assessment}\`,
    nextSteps: steps,
    source: 'local',
  };
}

export async function analyzeCase(opts: {
  moduleId: string;
  text: string;
  locale: string;
}): Promise<AnalysisResult> {
  const url = webhookUrl();
  if (!url) return localFallback(opts.moduleId, opts.text, opts.locale);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        app: '${spec.id}',
        module: opts.moduleId,
        locale: opts.locale,
        text: opts.text,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return localFallback(opts.moduleId, opts.text, opts.locale);
    const data = (await res.json()) as Partial<AnalysisResult> & {
      score?: number;
      summary?: string;
      steps?: string[];
    };
    const confidence = Number(data.confidence ?? data.score ?? 70);
    const assessment = String(data.assessment ?? data.summary ?? '');
    const nextSteps = (data.nextSteps ?? data.steps ?? []).map(String);
    if (!assessment || nextSteps.length === 0) {
      return localFallback(opts.moduleId, opts.text, opts.locale);
    }
    return {
      confidence: Math.max(0, Math.min(100, confidence)),
      assessment,
      nextSteps,
      source: 'live',
    };
  } catch {
    return localFallback(opts.moduleId, opts.text, opts.locale);
  }
}
`;
}

function themeContext() {
  return `import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dark, light, type ThemeColors, fonts, radius, appId } from './theme';

export type Appearance = 'system' | 'light' | 'dark';

type Ctx = {
  colors: ThemeColors;
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
  isDark: boolean;
  fonts: typeof fonts;
  radius: number;
};

const ThemeCtx = createContext<Ctx | null>(null);
const KEY = \`\${appId}.appearance\`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setAppearanceState(v);
    });
  }, []);

  const setAppearance = (a: Appearance) => {
    setAppearanceState(a);
    AsyncStorage.setItem(KEY, a);
  };

  const isDark = appearance === 'system' ? system === 'dark' : appearance === 'dark';
  const colors = isDark ? dark : light;

  const value = useMemo(
    () => ({ colors, appearance, setAppearance, isDark, fonts, radius }),
    [colors, appearance, isDark],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme outside provider');
  return ctx;
}
`;
}

function uiComponents() {
  return `import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
}

export function Card({
  children,
  index = 0,
  style,
  onPress,
}: {
  children: React.ReactNode;
  index?: number;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const { colors, radius } = useTheme();
  const body = (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(16)}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderWidth: 1,
          borderRadius: radius,
          padding: 18,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      {body}
    </Pressable>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors, fonts } = useTheme();
  return (
    <Text
      style={[
        {
          fontFamily: fonts.display,
          fontSize: 34,
          lineHeight: 40,
          color: colors.ink,
          letterSpacing: -0.5,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors, fonts } = useTheme();
  return (
    <Text style={[{ fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: colors.muted }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  const { colors, fonts, radius } = useTheme();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      onPress={onPress}
    >
      <Animated.View
        style={[
          anim,
          {
            backgroundColor: variant === 'primary' ? colors.primary : 'transparent',
            borderColor: colors.line,
            borderWidth: variant === 'ghost' ? 1 : 0,
            borderRadius: Math.max(12, radius - 6),
            paddingVertical: 16,
            paddingHorizontal: 20,
            alignItems: 'center',
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: fonts.bodyBold,
            fontSize: 17,
            color: variant === 'primary' ? colors.bg : colors.ink,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors, fonts, radius } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.line,
          backgroundColor: selected ? colors.primary : colors.surface,
          marginRight: 8,
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.bodyBold,
            fontSize: 15,
            color: selected ? colors.bg : colors.ink,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export const pad = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
});
`;
}

function rootLayout(spec) {
  const fontImports = {
    tollvik: `import { useFonts, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { SourceSans3_400Regular, SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3';`,
    kildevik: `import { useFonts, LibreBaskerville_700Bold } from '@expo-google-fonts/libre-baskerville';
import { DMSans_400Regular, DMSans_700Bold } from '@expo-google-fonts/dm-sans';`,
    kursvik: `import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { NunitoSans_400Regular, NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans';`,
  };
  const fontLoad = {
    tollvik: `{ Fraunces_700Bold, SourceSans3_400Regular, SourceSans3_700Bold }`,
    kildevik: `{ LibreBaskerville_700Bold, DMSans_400Regular, DMSans_700Bold }`,
    kursvik: `{ PlayfairDisplay_700Bold, NunitoSans_400Regular, NunitoSans_700Bold }`,
  };

  return `import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
${fontImports[spec.id]}
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { loadLocale } from '@/i18n';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Nav() {
  const { isDark, colors } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(${fontLoad[spec.id]});
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    loadLocale().finally(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded && i18nReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, i18nReady]);

  if (!fontsLoaded || !i18nReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Nav />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
`;
}

function tabsLayout() {
  return `import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { t, loadLocale } from '@/i18n';

export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  const [, bump] = useState(0);
  useEffect(() => {
    loadLocale().then(() => bump((n) => n + 1));
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab_home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="modules"
        options={{
          title: t('tab_modules'),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="subscribe"
        options={{
          title: t('tab_subscribe'),
          tabBarIcon: ({ color, size }) => <Ionicons name="card-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tab_settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen name="analyze/[moduleId]" options={{ href: null }} />
    </Tabs>
  );
}
`;
}

function homeScreen(spec) {
  return `import React from 'react';
import { ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Body, Button, Card, Screen, Title, pad } from '@/components/ui';
import { useTheme } from '@/theme/ThemeContext';
import { t } from '@/i18n';
import { appName } from '@/theme/theme';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  return (
    <Screen>
      <ScrollView contentContainerStyle={[pad.screen, { paddingTop: insets.top + 12, paddingBottom: 40 }]}>
        <LinearGradient
          colors={
            isDark
              ? [colors.surface, colors.bg]
              : [colors.primary + '18', colors.bg]
          }
          style={{ borderRadius: 28, padding: 22, marginBottom: 18 }}
        >
          <Animated.View entering={FadeIn.duration(500)}>
            <Title style={{ fontSize: 42, lineHeight: 48 }}>{appName}</Title>
            <Body style={{ marginTop: 10, color: colors.ink, fontSize: 19 }}>{t('home_tagline')}</Body>
            <Body style={{ marginTop: 8 }}>{t('home_lead')}</Body>
            <View style={{ marginTop: 20 }}>
              <Button label={t('home_cta')} onPress={() => router.push('/modules')} />
            </View>
          </Animated.View>
        </LinearGradient>

        <Title style={{ fontSize: 26, marginBottom: 12 }}>{t('home_how')}</Title>
        {[t('home_how_1'), t('home_how_2'), t('home_how_3')].map((line, i) => (
          <Card key={i} index={i} style={{ marginBottom: 10 }}>
            <Body style={{ color: colors.ink }}>{line}</Body>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
`;
}

function modulesScreen() {
  return `import React from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Card, Screen, Title, pad } from '@/components/ui';
import { useTheme } from '@/theme/ThemeContext';
import { t } from '@/i18n';
import { MODULES } from '@/modules';

export default function Modules() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <Screen>
      <ScrollView contentContainerStyle={[pad.screen, { paddingTop: insets.top + 12, paddingBottom: 40 }]}>
        <Title>{t('modules_title')}</Title>
        <Body style={{ marginTop: 6, marginBottom: 18 }}>{t('modules_subtitle')}</Body>
        {MODULES.map((m, i) => (
          <Card
            key={m.id}
            index={i}
            style={{ marginBottom: 12 }}
            onPress={() => router.push(\`/analyze/\${m.id}\`)}
          >
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: colors.primary + '22',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={m.icon as any} size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Title style={{ fontSize: 22, lineHeight: 28 }}>{t(\`mod_\${m.id}_name\`)}</Title>
                <Body style={{ marginTop: 4 }}>{t(\`mod_\${m.id}_blurb\`)}</Body>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
`;
}

function analyzeScreen() {
  return `import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Body, Button, Card, Screen, Title, pad } from '@/components/ui';
import { useTheme } from '@/theme/ThemeContext';
import { t, i18n } from '@/i18n';
import { analyzeCase, type AnalysisResult } from '@/services/ai';

export default function Analyze() {
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const insets = useSafeAreaInsets();
  const { colors, fonts, radius } = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const run = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const out = await analyzeCase({
      moduleId: String(moduleId),
      text: text.trim(),
      locale: i18n.locale,
    });
    setResult(out);
    setBusy(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[pad.screen, { paddingTop: insets.top + 8, paddingBottom: 48 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Button label="←" onPress={() => router.back()} variant="ghost" />
          <Title style={{ marginTop: 8 }}>{t(\`mod_\${moduleId}_name\`)}</Title>
          <Body style={{ marginTop: 6, marginBottom: 14 }}>{t(\`mod_\${moduleId}_blurb\`)}</Body>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t(\`mod_\${moduleId}_hint\`)}
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            style={{
              minHeight: 140,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.surface,
              borderRadius: radius,
              padding: 16,
              fontFamily: fonts.body,
              fontSize: 17,
              lineHeight: 26,
              color: colors.ink,
              marginBottom: 14,
            }}
          />

          <Button
            label={busy ? t('analyze_running') : t('analyze_run')}
            onPress={run}
            disabled={busy || !text.trim()}
          />
          {busy ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
          ) : null}

          {result ? (
            <Animated.View entering={FadeInDown.springify()} style={{ marginTop: 20, gap: 12 }}>
              <Card>
                <Body style={{ color: colors.accent, fontFamily: fonts.bodyBold }}>
                  {result.source === 'live' ? t('analyze_source_live') : t('analyze_source_local')}
                </Body>
                <Title style={{ fontSize: 28, marginTop: 6 }}>
                  {t('analyze_confidence')}: {Math.round(result.confidence)}%
                </Title>
              </Card>
              <Card>
                <Title style={{ fontSize: 20 }}>{t('analyze_assessment')}</Title>
                <Body style={{ marginTop: 8, color: colors.ink }}>{result.assessment}</Body>
              </Card>
              <Card>
                <Title style={{ fontSize: 20 }}>{t('analyze_steps')}</Title>
                {result.nextSteps.map((s, i) => (
                  <Body key={i} style={{ marginTop: 8, color: colors.ink }}>
                    {i + 1}. {s}
                  </Body>
                ))}
              </Card>
              <Body style={{ fontSize: 13 }}>{t('analyze_disclaimer')}</Body>
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
`;
}

function subscribeScreen(spec) {
  return `import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Screen, Title, pad } from '@/components/ui';
import { useTheme } from '@/theme/ThemeContext';
import { t } from '@/i18n';
import { appId, appName } from '@/theme/theme';
import {
  openEmailSubscribe,
  paymentsConfigured,
  startCheckout,
  type Plan,
} from '@/services/payments';

export default function Subscribe() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [busy, setBusy] = useState<Plan | null>(null);

  const go = async (plan: Plan) => {
    setBusy(plan);
    if (!paymentsConfigured()) {
      await openEmailSubscribe(appName, plan);
      setBusy(null);
      return;
    }
    const res = await startCheckout(appId, plan);
    if (!res.ok) {
      Alert.alert(t('subscribe_title'), t('subscribe_missing_payments'));
      await openEmailSubscribe(appName, plan);
    }
    setBusy(null);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[pad.screen, { paddingTop: insets.top + 12, paddingBottom: 40 }]}>
        <Title>{t('subscribe_title')}</Title>
        <Body style={{ marginTop: 8, marginBottom: 18 }}>{t('subscribe_lead')}</Body>
        {!paymentsConfigured() ? (
          <Card style={{ marginBottom: 14, borderColor: colors.warning }}>
            <Body style={{ color: colors.ink }}>{t('subscribe_missing_payments')}</Body>
          </Card>
        ) : null}

        <Card index={0} style={{ marginBottom: 12 }}>
          <Title style={{ fontSize: 22 }}>{t('subscribe_monthly')}</Title>
          <Title style={{ fontSize: 32, marginTop: 6 }}>{t('subscribe_price_monthly')}</Title>
          <View style={{ marginTop: 14 }}>
            <Button
              label={busy === 'monthly' ? '…' : paymentsConfigured() ? t('subscribe_cta') : t('subscribe_email_fallback')}
              onPress={() => go('monthly')}
              disabled={!!busy}
            />
          </View>
        </Card>

        <Card index={1} style={{ marginBottom: 12, borderColor: colors.primary }}>
          <Title style={{ fontSize: 22 }}>{t('subscribe_yearly')}</Title>
          <Title style={{ fontSize: 32, marginTop: 6 }}>{t('subscribe_price_yearly')}</Title>
          {t('subscribe_save') ? (
            <Body style={{ marginTop: 4, color: colors.accent }}>{t('subscribe_save')}</Body>
          ) : null}
          <View style={{ marginTop: 14 }}>
            <Button
              label={busy === 'yearly' ? '…' : paymentsConfigured() ? t('subscribe_cta') : t('subscribe_email_fallback')}
              onPress={() => go('yearly')}
              disabled={!!busy}
            />
          </View>
        </Card>

        <Body>{t('subscribe_includes')}</Body>
      </ScrollView>
    </Screen>
  );
}
`;
}

function settingsScreen() {
  return `import React, { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Card, Chip, Screen, Title, pad } from '@/components/ui';
import { useTheme, type Appearance } from '@/theme/ThemeContext';
import { t, setLocale, type Locale, i18n } from '@/i18n';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { colors, appearance, setAppearance } = useTheme();
  const [locale, setLoc] = useState<Locale>((i18n.locale as Locale) || 'en');
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;

  const changeLang = async (l: Locale) => {
    await setLocale(l);
    setLoc(l);
  };

  const open = (url?: string) => {
    if (url) Linking.openURL(url);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[pad.screen, { paddingTop: insets.top + 12, paddingBottom: 40 }]}>
        <Title>{t('settings_title')}</Title>

        <Body style={{ marginTop: 18, marginBottom: 8, color: colors.ink }}>{t('settings_language')}</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(['nb', 'en', 'es'] as Locale[]).map((l) => (
            <Chip key={l} label={t(\`lang_\${l}\`)} selected={locale === l} onPress={() => changeLang(l)} />
          ))}
        </View>

        <Body style={{ marginTop: 18, marginBottom: 8, color: colors.ink }}>{t('settings_appearance')}</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {([
            ['system', 'settings_system'],
            ['light', 'settings_light'],
            ['dark', 'settings_dark'],
          ] as [Appearance, string][]).map(([a, key]) => (
            <Chip key={a} label={t(key)} selected={appearance === a} onPress={() => setAppearance(a)} />
          ))}
        </View>

        <Card style={{ marginTop: 20 }} onPress={() => open(extra?.privacyUrl)}>
          <Title style={{ fontSize: 20 }}>{t('settings_privacy')}</Title>
        </Card>
        <Card style={{ marginTop: 10 }} onPress={() => open(extra?.termsUrl)}>
          <Title style={{ fontSize: 20 }}>{t('settings_terms')}</Title>
        </Card>
        <Card
          style={{ marginTop: 10 }}
          onPress={() =>
            Linking.openURL(
              \`mailto:\${process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'kontakt@mlinternasjonal.no'}\`,
            )
          }
        >
          <Title style={{ fontSize: 20 }}>{t('settings_support')}</Title>
        </Card>

        <Body style={{ marginTop: 24 }}>
          {t('settings_version')}: {Constants.expoConfig?.version || '1.0.0'}
        </Body>
      </ScrollView>
    </Screen>
  );
}
`;
}

function gitignore() {
  return `node_modules/
.expo/
dist/
web-build/
*.jks
*.p8
*.p12
*.mobileprovision
*.orig.*
.env
.env.local
secrets/
google-service-account*.json
*.keystore
npm-debug.*
`;
}

function scaffold(spec) {
  const dir = path.join(APPS, spec.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  write(path.join(dir, 'package.json'), packageJson(spec));
  write(path.join(dir, 'app.json'), appJson(spec));
  write(path.join(dir, 'eas.json'), easJson());
  write(path.join(dir, 'tsconfig.json'), tsconfig());
  write(path.join(dir, 'babel.config.js'), babelConfig());
  write(path.join(dir, '.env.example'), envExample(spec));
  write(path.join(dir, '.gitignore'), gitignore());
  write(path.join(dir, 'README.md'), readme(spec));
  write(path.join(dir, 'expo-env.d.ts'), `/// <reference types="expo/types" />\n`);

  write(path.join(dir, 'src/theme/theme.ts'), themeTs(spec));
  write(path.join(dir, 'src/theme/ThemeContext.tsx'), themeContext());
  write(path.join(dir, 'src/i18n/index.ts'), i18nTs(spec));
  write(path.join(dir, 'src/modules/index.ts'), modulesTs(spec));
  write(path.join(dir, 'src/services/payments.ts'), paymentsTs());
  write(path.join(dir, 'src/services/ai.ts'), aiTs(spec));
  write(path.join(dir, 'src/components/ui.tsx'), uiComponents());

  write(path.join(dir, 'app/_layout.tsx'), rootLayout(spec));
  write(path.join(dir, 'app/(tabs)/_layout.tsx'), tabsLayout());
  write(path.join(dir, 'app/(tabs)/index.tsx'), homeScreen(spec));
  write(path.join(dir, 'app/(tabs)/modules.tsx'), modulesScreen());
  write(path.join(dir, 'app/(tabs)/subscribe.tsx'), subscribeScreen(spec));
  write(path.join(dir, 'app/(tabs)/settings.tsx'), settingsScreen());
  write(path.join(dir, 'app/(tabs)/analyze/[moduleId].tsx'), analyzeScreen());

  // assets
  const iconSrc = path.join('/tmp/app-icons', `${spec.id}.png`);
  const assets = path.join(dir, 'assets');
  fs.mkdirSync(assets, { recursive: true });
  for (const name of ['icon.png', 'splash-icon.png', 'adaptive-icon.png', 'favicon.png']) {
    fs.copyFileSync(iconSrc, path.join(assets, name));
  }

  write(
    path.join(dir, 'secrets/.gitkeep'),
    `# Place google-play-service-account.json here locally — never commit.\n`,
  );

  console.log('Scaffolded', spec.id);
}

for (const spec of SPECS) scaffold(spec);

// Root pointer README for apps/
write(
  path.join(APPS, 'README.md'),
  `# ML Trade Expo apps

Three publish-ready Expo apps with separate visual identities:

| App | Modules | Monthly |
|-----|---------|---------|
| [Tollvik](./tollvik) | QuoteFlow, Landed Cost AI, Trade Finance AI | €19.99 |
| [Kildevik](./kildevik) | Supplier Intelligence, Trade Compliance, Economic Radar | €24.99 |
| [Kursvik](./kursvik) | AlphaYield, WillyVerse Travel AI | €7.99 |

Payments go through **ML-TRADE-PAYMENTS** (\`EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL\`).  
Store/EAS secrets are listed as **Missing** in each app README — do not invent keys.

> Source of truth for earlier work may live in the private \`ML-TRADE-APPS\` repo. This tree was rebuilt for App Store / Play submission readiness when that repo was not accessible to the agent.
`,
);

console.log('Done.');

# Kildevik

Expo (React Native) app for iOS and Android — ML Internasjonal Handel.

Check who you buy from and which rules apply — before you sign.

## Modules

- **Supplier Intelligence** (`supplier-intelligence`)
- **Trade Compliance** (`trade-compliance`)
- **Economic Radar** (`economic-radar`)

## Design

- Light and dark mode (`userInterfaceStyle: automatic`)
- Large display typography + readable body text
- Rounded cards, bottom tabs, Reanimated transitions
- Brand palette unique to Kildevik (not shared across the sister apps)

## Languages

Norwegian (`nb`), English (`en`), Spanish (`es`). Change in **Settings**.

## Payments (ML-TRADE-PAYMENTS)

In-app purchases are **not** used. Subscriptions are sold on the web via **ML-TRADE-PAYMENTS**.

1. Set `EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL` to the ML-TRADE-PAYMENTS API base (e.g. `https://payments.example/api`).
2. The app calls `POST {base}/checkout/session` with `{ app, plan: "monthly"|"yearly" }` and opens the returned `url` in the system browser.
3. Until the URL is configured, the Subscribe screen falls back to `mailto:kontakt@mlinternasjonal.no`.

Do **not** put Stripe secret keys in this app.

## AI analysis

- Live path: `EXPO_PUBLIC_AI_WEBHOOK_URL` (Make → model), HTTPS POST with `{ app, module, locale, text }`.
- Fallback: on-device heuristic brief (confidence + assessment + next steps) when the webhook is missing or offline.

## Run locally

```bash
cd apps/kildevik
cp .env.example .env
npm install
npx expo start
```

## EAS build (ready, credentials missing)

```bash
npm i -g eas-cli
eas login
eas init          # creates real projectId — paste into app.json extra.eas.projectId
eas build --platform ios --profile production
eas build --platform android --profile production
```

### Missing credentials (do not invent — fill before store submit)

| Item | Where | Status |
|------|--------|--------|
| Expo account / `EXPO_TOKEN` | expo.dev | **Missing** |
| EAS `projectId` | `eas init` → `app.json` `extra.eas.projectId` | **Missing** (empty placeholder) |
| `owner` in app.json | Expo org/user | **Missing** |
| Apple Developer Program membership | developer.apple.com | **Missing** |
| Apple Team ID | App Store Connect / Membership | **Missing** |
| Apple ID (for submit) | ASC | **Missing** |
| ASC App ID (numeric) | App Store Connect → App Information | **Missing** (create app record first) |
| iOS distribution cert + provisioning | managed by EAS after Apple login | **Missing** |
| Google Play Console developer account | play.google.com/console | **Missing** |
| Google Play app listing | Console → Create app | **Missing** |
| Google service account JSON | Console → API access | **Missing** (`secrets/google-play-service-account.json`) |
| `EXPO_PUBLIC_ML_TRADE_PAYMENTS_URL` | env / EAS secret | **Missing** |
| `EXPO_PUBLIC_AI_WEBHOOK_URL` | env / EAS secret | **Missing** |
| Privacy / Support URLs verified in ASC & Play | apps.mlinternasjonal.no | Public pages exist; confirm before review |

Pricing (web only): monthly **€24.99**, yearly **€249.99**.

## Legal

Seller: Martinez Lozano Internasjonal Handel (ENK), org. no. 935 407 095, Oslo, Norway.  
Privacy: https://apps.mlinternasjonal.no/kildevik/privacy/  
Support: kontakt@mlinternasjonal.no

Decision-support software only — not legal, customs, tax, financial or investment advice.

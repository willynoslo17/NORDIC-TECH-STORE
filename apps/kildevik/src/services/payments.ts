import Constants from 'expo-constants';
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
  ).replace(/\/$/, '');
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
    const res = await fetch(`${base}/checkout/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ app: appId, plan, source: 'expo-app' }),
    });
    const data = (await res.json().catch(() => ({}))) as CheckoutResponse;
    const url = data.url || data.checkoutUrl;
    if (!res.ok || !url) {
      return { ok: false, reason: data.error || `http_${res.status}` };
    }
    await WebBrowser.openBrowserAsync(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'network_error' };
  }
}

export async function openEmailSubscribe(appName: string, plan: Plan) {
  const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'kontakt@mlinternasjonal.no';
  const subject = encodeURIComponent(`${appName} – ${plan}`);
  await Linking.openURL(`mailto:${email}?subject=${subject}`);
}

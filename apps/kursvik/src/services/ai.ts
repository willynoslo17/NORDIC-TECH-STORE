import Constants from 'expo-constants';

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
  const words = text.trim().split(/\s+/).filter(Boolean).length;
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
    assessment: `${L.default} Module: ${moduleId}. ${L.assessment}`,
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
        app: 'kursvik',
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

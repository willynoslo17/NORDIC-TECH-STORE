import React, { useState } from 'react';
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

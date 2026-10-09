import React, { useState } from 'react';
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
            <Chip key={l} label={t(`lang_${l}`)} selected={locale === l} onPress={() => changeLang(l)} />
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
              `mailto:${process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'kontakt@mlinternasjonal.no'}`,
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

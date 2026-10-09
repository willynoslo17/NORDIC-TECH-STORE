import React from 'react';
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

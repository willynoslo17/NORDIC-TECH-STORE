import React, { useState } from 'react';
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
          <Button label="‹" onPress={() => router.back()} variant="ghost" />
          <Title style={{ marginTop: 8 }}>{t(`mod_${moduleId}_name`)}</Title>
          <Body style={{ marginTop: 6, marginBottom: 14 }}>{t(`mod_${moduleId}_blurb`)}</Body>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t(`mod_${moduleId}_hint`)}
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

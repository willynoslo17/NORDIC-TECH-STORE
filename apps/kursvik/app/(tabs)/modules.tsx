import React from 'react';
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
            onPress={() => router.push(`/analyze/${m.id}`)}
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
                <Title style={{ fontSize: 22, lineHeight: 28 }}>{t(`mod_${m.id}_name`)}</Title>
                <Body style={{ marginTop: 4 }}>{t(`mod_${m.id}_blurb`)}</Body>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

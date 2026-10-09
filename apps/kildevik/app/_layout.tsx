import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, LibreBaskerville_700Bold } from '@expo-google-fonts/libre-baskerville';
import { DMSans_400Regular, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
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
  const [fontsLoaded] = useFonts({ LibreBaskerville_700Bold, DMSans_400Regular, DMSans_700Bold });
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

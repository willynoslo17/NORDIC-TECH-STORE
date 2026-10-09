import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
const KEY = `${appId}.appearance`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v: string | null) => {
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

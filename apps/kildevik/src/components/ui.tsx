import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
}

export function Card({
  children,
  index = 0,
  style,
  onPress,
}: {
  children: React.ReactNode;
  index?: number;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const { colors, radius } = useTheme();
  const body = (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(16)}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderWidth: 1,
          borderRadius: radius,
          padding: 18,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      {body}
    </Pressable>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors, fonts } = useTheme();
  return (
    <Text
      style={[
        {
          fontFamily: fonts.display,
          fontSize: 34,
          lineHeight: 40,
          color: colors.ink,
          letterSpacing: -0.5,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors, fonts } = useTheme();
  return (
    <Text style={[{ fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: colors.muted }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  const { colors, fonts, radius } = useTheme();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      onPress={onPress}
    >
      <Animated.View
        style={[
          anim,
          {
            backgroundColor: variant === 'primary' ? colors.primary : 'transparent',
            borderColor: colors.line,
            borderWidth: variant === 'ghost' ? 1 : 0,
            borderRadius: Math.max(12, radius - 6),
            paddingVertical: 16,
            paddingHorizontal: 20,
            alignItems: 'center',
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: fonts.bodyBold,
            fontSize: 17,
            color: variant === 'primary' ? colors.bg : colors.ink,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors, fonts, radius } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.line,
          backgroundColor: selected ? colors.primary : colors.surface,
          marginRight: 8,
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.bodyBold,
            fontSize: 15,
            color: selected ? colors.bg : colors.ink,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export const pad = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
});

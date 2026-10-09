export type ThemeColors = {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  tabInactive: string;
};

export const light: ThemeColors = {
  "bg": "#FAF6F0",
  "surface": "#FFFCF7",
  "ink": "#2A1F12",
  "muted": "#7A6A55",
  "line": "#E5D8C4",
  "primary": "#6D5225",
  "accent": "#A67C3A",
  "success": "#3D7A4A",
  "warning": "#B86A1A",
  "danger": "#A33A2C",
  "tabInactive": "#A09078"
};

export const dark: ThemeColors = {
  "bg": "#120E08",
  "surface": "#1C1610",
  "ink": "#F5ECDC",
  "muted": "#B0A08A",
  "line": "#332820",
  "primary": "#D4B06A",
  "accent": "#C49A4A",
  "success": "#6AD090",
  "warning": "#E0A84A",
  "danger": "#E07868",
  "tabInactive": "#8A7A65"
};

export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  body: 'NunitoSans_400Regular',
  bodyBold: 'NunitoSans_700Bold',
  displayFamily: 'PlayfairDisplay',
  bodyFamily: 'NunitoSans',
} as const;

export const radius = 24;
export const appName = 'Kursvik';
export const appId = 'kursvik';

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
  "bg": "#F2F7F4",
  "surface": "#FFFFFF",
  "ink": "#0F241C",
  "muted": "#4F675C",
  "line": "#C9D9D0",
  "primary": "#194F3D",
  "accent": "#2A7A5C",
  "success": "#1F7A4D",
  "warning": "#A86B1A",
  "danger": "#A33A2C",
  "tabInactive": "#7A9186"
};

export const dark: ThemeColors = {
  "bg": "#071410",
  "surface": "#0E221A",
  "ink": "#E6F2EC",
  "muted": "#8AABA0",
  "line": "#1A3328",
  "primary": "#5ECF9A",
  "accent": "#3DA87A",
  "success": "#4AD090",
  "warning": "#E0A84A",
  "danger": "#E07868",
  "tabInactive": "#6A8578"
};

export const fonts = {
  display: 'LibreBaskerville_700Bold',
  body: 'DMSans_400Regular',
  bodyBold: 'DMSans_700Bold',
  displayFamily: 'LibreBaskerville',
  bodyFamily: 'DMSans',
} as const;

export const radius = 16;
export const appName = 'Kildevik';
export const appId = 'kildevik';

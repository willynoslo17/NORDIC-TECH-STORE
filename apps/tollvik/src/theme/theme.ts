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
  "bg": "#F3F6FA",
  "surface": "#FFFFFF",
  "ink": "#0A1628",
  "muted": "#5A6B7D",
  "line": "#D5DEE8",
  "primary": "#0B2748",
  "accent": "#1D6B9F",
  "success": "#1F7A4D",
  "warning": "#B86A1A",
  "danger": "#B42318",
  "tabInactive": "#8A9AAB"
};

export const dark: ThemeColors = {
  "bg": "#061018",
  "surface": "#0E1A28",
  "ink": "#E8EEF5",
  "muted": "#8FA0B3",
  "line": "#1E2E40",
  "primary": "#6EB0E0",
  "accent": "#3D8FC4",
  "success": "#3DB87A",
  "warning": "#E0A04A",
  "danger": "#F07060",
  "tabInactive": "#6A7A8C"
};

export const fonts = {
  display: 'Fraunces_700Bold',
  body: 'SourceSans3_400Regular',
  bodyBold: 'SourceSans3_700Bold',
  displayFamily: 'Fraunces',
  bodyFamily: 'SourceSans3',
} as const;

export const radius = 20;
export const appName = 'Tollvik';
export const appId = 'tollvik';

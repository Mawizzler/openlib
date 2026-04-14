import { useColorScheme } from 'nativewind';

export type AppColorScheme = 'light' | 'dark';

export type AppPalette = {
  scheme: AppColorScheme;
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  danger: string;
  dangerText: string;
};

const lightPalette: AppPalette = {
  scheme: 'light',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceMuted: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#334155',
  textSubtle: '#64748b',
  primary: '#2563eb',
  primaryText: '#ffffff',
  secondary: '#ffffff',
  secondaryText: '#0f172a',
  inputBackground: '#ffffff',
  inputBorder: '#cbd5e1',
  inputText: '#0f172a',
  inputPlaceholder: '#64748b',
  danger: '#b91c1c',
  dangerText: '#b91c1c',
};

const darkPalette: AppPalette = {
  scheme: 'dark',
  background: '#0b1220',
  surface: '#0f172a',
  surfaceMuted: '#111c33',
  border: '#24324a',
  text: '#f8fafc',
  textMuted: '#cbd5e1',
  textSubtle: '#94a3b8',
  primary: '#60a5fa',
  primaryText: '#0b1220',
  secondary: '#0f172a',
  secondaryText: '#f8fafc',
  inputBackground: '#0b1220',
  inputBorder: '#334155',
  inputText: '#f8fafc',
  inputPlaceholder: '#94a3b8',
  danger: '#fca5a5',
  dangerText: '#fecaca',
};

export function getAppPalette(scheme: AppColorScheme): AppPalette {
  return scheme === 'dark' ? darkPalette : lightPalette;
}

export function useAppPalette(): AppPalette {
  const { colorScheme } = useColorScheme();
  const scheme: AppColorScheme = colorScheme === 'dark' ? 'dark' : 'light';
  return getAppPalette(scheme);
}


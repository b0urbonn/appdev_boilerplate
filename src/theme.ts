import { useSettings } from '@/settings/SettingsContext';

export interface Theme {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  tint: string;
  danger: string;
  success: string;
  warning: string;
  userBubble: string;
  userBubbleText: string;
  assistantBubble: string;
  inputBackground: string;
}

const light: Theme = {
  background: '#FFFFFF',
  card: '#F2F2F7',
  text: '#111111',
  textSecondary: '#6B6B70',
  border: '#D8D8DE',
  tint: '#208AEF',
  danger: '#D32F2F',
  success: '#2E7D32',
  warning: '#ED6C02',
  userBubble: '#208AEF',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#E9E9EE',
  inputBackground: '#F2F2F7',
};

const dark: Theme = {
  background: '#0E0E12',
  card: '#1C1C22',
  text: '#F2F2F5',
  textSecondary: '#9A9AA3',
  border: '#2E2E38',
  tint: '#4DA3F5',
  danger: '#EF5350',
  success: '#66BB6A',
  warning: '#FFA726',
  userBubble: '#1C6FD1',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#23232C',
  inputBackground: '#1C1C22',
};

export function useTheme(): Theme {
  return useSettings().settings.theme === 'dark' ? dark : light;
}

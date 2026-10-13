import { useSettings } from '@/settings/SettingsContext';

export interface Theme {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  tint: string;
  buttonPrimary: string;
  buttonSecondary: string;
  buttonDanger: string;
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
  tint: '#0066CC',
  buttonPrimary: '#0066CC',
  buttonSecondary: '#E6E8EE',
  buttonDanger: '#BA2525',
  danger: '#B42323',
  success: '#2E7D32',
  warning: '#A14800',
  userBubble: '#0066CC',
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
  tint: '#70B7FF',
  buttonPrimary: '#0A65C7',
  buttonSecondary: '#303038',
  buttonDanger: '#BA2525',
  danger: '#FF8885',
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

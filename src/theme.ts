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
  background: '#F7F9F6',
  card: '#FFFFFF',
  text: '#1C2821',
  textSecondary: '#5D6A61',
  border: '#E5EBE6',
  tint: '#2D7655',
  buttonPrimary: '#7AD8AA',
  buttonSecondary: '#EEF3EF',
  buttonDanger: '#BA2525',
  danger: '#B42323',
  success: '#2D7655',
  warning: '#A14800',
  userBubble: '#C9F0D9',
  userBubbleText: '#1C3828',
  assistantBubble: '#F0F4F0',
  inputBackground: '#F5F7F5',
};

const dark: Theme = {
  background: '#111815',
  card: '#1B2420',
  text: '#D9E4DC',
  textSecondary: '#8DA097',
  border: '#2D3A33',
  tint: '#8BE0B8',
  buttonPrimary: '#3C6D54',
  buttonSecondary: '#29342E',
  buttonDanger: '#BA2525',
  danger: '#FF8885',
  success: '#8BE0B8',
  warning: '#FFA726',
  userBubble: '#2D5A44',
  userBubbleText: '#DDEDE2',
  assistantBubble: '#202B25',
  inputBackground: '#202B25',
};

export function useTheme(): Theme {
  return useSettings().settings.theme === 'dark' ? dark : light;
}

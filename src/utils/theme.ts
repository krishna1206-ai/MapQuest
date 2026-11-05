/**
 * Design tokens. Swap these values for the exact brand colours used on
 * mapquest.com so the app matches the website.
 */
export type AppTheme = {
  dark: boolean;
  colors: {
    primary: string;
    primaryText: string;
    background: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    textMuted: string;
    border: string;
    danger: string;
    route: string;
    routeCasing: string;
    shadow: string;
  };
  radius: { sm: number; md: number; lg: number; pill: number };
  spacing: (n: number) => number;
};

const base = {
  radius: { sm: 8, md: 12, lg: 20, pill: 999 },
  spacing: (n: number) => n * 4,
};

export const lightTheme: AppTheme = {
  ...base,
  dark: false,
  colors: {
    primary: '#0B6BCB',
    primaryText: '#FFFFFF',
    background: '#F4F6F9',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF2F7',
    text: '#111827',
    textMuted: '#6B7280',
    border: '#E2E8F0',
    danger: '#D93025',
    route: '#0B6BCB',
    routeCasing: '#FFFFFF',
    shadow: '#000000',
  },
};

export const darkTheme: AppTheme = {
  ...base,
  dark: true,
  colors: {
    primary: '#4C9AFF',
    primaryText: '#0B1220',
    background: '#0B1220',
    surface: '#151E2E',
    surfaceAlt: '#1F2A3D',
    text: '#F3F4F6',
    textMuted: '#9CA3AF',
    border: '#273449',
    danger: '#FF6B5E',
    route: '#4C9AFF',
    routeCasing: '#0B1220',
    shadow: '#000000',
  },
};

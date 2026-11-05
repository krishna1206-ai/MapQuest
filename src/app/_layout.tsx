import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from '../hooks/useAppTheme';

export default function RootLayout() {
  const t = useAppTheme();
  const nav = t.dark ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...nav,
        colors: {
          ...nav.colors,
          primary: t.colors.primary,
          background: t.colors.background,
          card: t.colors.surface,
          text: t.colors.text,
          border: t.colors.border,
        },
      }}
    >
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ title: 'MapQuest' }} />
        <Stack.Screen name="directions" options={{ title: 'Directions', animation: 'slide_from_right' }} />
      </Stack>
    </ThemeProvider>
  );
}

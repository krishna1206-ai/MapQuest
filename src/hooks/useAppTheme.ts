import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type AppTheme } from '../utils/theme';

/** Follows the OS light/dark setting. */
export function useAppTheme(): AppTheme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

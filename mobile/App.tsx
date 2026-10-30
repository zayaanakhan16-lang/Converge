import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Text } from './src/components/ui/Text';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { useBrandFonts } from './src/hooks/useBrandFonts';
import { RootNavigation } from './src/navigation/RootNavigation';
import { spacing } from './src/theme';

/**
 * Converge.
 *
 * Provider order matters: fonts first (so no text reflows after paint), then the
 * theme, then authentication (which the repository selection depends on), then
 * navigation.
 */
function Shell() {
  const { theme } = useTheme();
  const { ready, error } = useBrandFonts();

  if (!ready) {
    return (
      <View style={[styles.splash, { backgroundColor: theme.colors.background }]}>
        <Text token="title3" tone="muted">
          Converge
        </Text>
      </View>
    );
  }

  if (error) {
    // Fonts are bundled, so this only happens if the asset pipeline is broken.
    // Rendering anyway with system fallbacks is better than a blank screen.
    console.warn('Converge: brand fonts failed to load, falling back to system fonts.', error);
  }

  return (
    <AuthProvider>
      <RootNavigation />
      <StatusBar style={theme.statusBar} />
    </AuthProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});

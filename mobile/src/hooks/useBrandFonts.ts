import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

/**
 * Font loading.
 *
 * Both typefaces are bundled as static instances cut from the upstream variable
 * fonts (Plus Jakarta Sans and Inter, both SIL Open Font License). They are
 * loaded before the first screen renders so no text ever reflows after paint.
 */

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash screen is already hidden in some launch paths; not an error.
});

export function useBrandFonts(): { ready: boolean; error: Error | null } {
  const [loaded, error] = useFonts({
    'Jakarta-Regular': require('../../assets/fonts/PlusJakartaSans-400.ttf'),
    'Jakarta-Medium': require('../../assets/fonts/PlusJakartaSans-500.ttf'),
    'Jakarta-SemiBold': require('../../assets/fonts/PlusJakartaSans-600.ttf'),
    'Jakarta-Bold': require('../../assets/fonts/PlusJakartaSans-700.ttf'),
    'Jakarta-ExtraBold': require('../../assets/fonts/PlusJakartaSans-800.ttf'),
    'Inter-Regular': require('../../assets/fonts/Inter-400.ttf'),
    'Inter-Medium': require('../../assets/fonts/Inter-500.ttf'),
    'Inter-SemiBold': require('../../assets/fonts/Inter-600.ttf'),
    'Inter-Bold': require('../../assets/fonts/Inter-700.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync().catch(() => {
        // Nothing to do: the splash is already gone.
      });
    }
  }, [loaded, error]);

  return { ready: loaded || Boolean(error), error: error ?? null };
}

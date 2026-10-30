import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

/**
 * Font loading.
 *
 * The brand typefaces are bundled as static instances of the Fraunces and
 * Manrope variable fonts (both SIL Open Font License). They are loaded before
 * the first screen renders so no text ever reflows after paint.
 */

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash screen is already hidden in some launch paths; not an error.
});

export function useBrandFonts(): { ready: boolean; error: Error | null } {
  const [loaded, error] = useFonts({
    'Fraunces-SemiBold': require('../../assets/fonts/Fraunces-SemiBold.ttf'),
    'Manrope-Regular': require('../../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../../assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('../../assets/fonts/Manrope-SemiBold.ttf'),
    'Manrope-Bold': require('../../assets/fonts/Manrope-Bold.ttf'),
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

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { useOnboarding } from '../../features/onboarding/OnboardingContext';
import { useTheme } from '../../context/ThemeContext';
import type { OnboardingStackParamList } from '../../navigation/types';
import { radius, spacing } from '../../theme';
import { snapToGrid } from '../../utils/geo';
import { OnboardingLayout } from './OnboardingLayout';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingLocation'>;

/**
 * Approximate location step.
 *
 * The device position is snapped to a coarse grid on the device before it is
 * held in state, and only saved if the user opts in. Background location is
 * never requested.
 */
export function OnboardingLocationScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { draft, update } = useOnboarding();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestArea = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setStatus(
          'Location permission was declined. You can type an area instead, or skip this step.',
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      const snapped = snapToGrid({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const places = await Location.reverseGeocodeAsync(snapped).catch(() => []);
      const areaLabel =
        places[0]?.district ?? places[0]?.city ?? places[0]?.subregion ?? undefined;
      update({
        location: { ...snapped, areaLabel },
        locationConsent: true,
      });
      setStatus(
        areaLabel
          ? `Saved as roughly ${areaLabel}. The exact reading was discarded.`
          : 'Saved as a coarse area. The exact reading was discarded.',
      );
    } catch {
      setStatus('Could not read your area. Type an area name instead, or skip this step.');
    } finally {
      setBusy(false);
    }
  };

  const manualArea = draft.location?.areaLabel ?? '';

  return (
    <OnboardingLayout
      step={6}
      totalSteps={7}
      title="Roughly where are you based?"
      subtitle="This is optional and off by default. It is used only to rank communities and events near you."
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate('OnboardingPrivacy')}
      onSkip={() => {
        update({ location: null, locationConsent: false });
        navigation.navigate('OnboardingPrivacy');
      }}
      busy={busy}
    >
      <View style={styles.stack}>
        <View
          style={[
            styles.notice,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <MapPin size={18} color={theme.colors.accent} strokeWidth={2} />
          <View style={styles.noticeText}>
            <Text token="bodyStrong">How Converge handles location</Text>
            <Text token="caption" tone="secondary">
              Coordinates are rounded to about five kilometres before they are stored. Converge
              never records a location history, never tracks you in the background, and never
              shows your position on a map to other members.
            </Text>
          </View>
        </View>

        {status ? <InlineMessage tone="info" message={status} /> : null}

        <Button
          label={draft.location ? 'Update my area' : 'Use my approximate area'}
          variant="secondary"
          onPress={requestArea}
          loading={busy}
          fullWidth
        />

        <TextField
          label="Or describe your area"
          value={manualArea}
          onChangeText={(value) =>
            update({
              location: draft.location
                ? { ...draft.location, areaLabel: value }
                : { latitude: 0, longitude: 0, areaLabel: value },
              locationConsent: value.trim().length > 0,
            })
          }
          hint="A district or neighbourhood name only, e.g. Northside. Do not enter a street address."
          placeholder="e.g. Northside"
          maxLength={48}
        />

        {draft.location ? (
          <Text token="caption" tone="muted">
            Saved area: {draft.location.areaLabel ?? 'unnamed'} ·{' '}
            {draft.location.latitude.toFixed(2)}, {draft.location.longitude.toFixed(2)} (coarse
            grid)
          </Text>
        ) : (
          <Text token="caption" tone="muted">
            Nothing saved yet. Proximity is one of several matching signals; skipping it only
            removes distance from the reasons shown.
          </Text>
        )}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1, gap: spacing.xs },
});

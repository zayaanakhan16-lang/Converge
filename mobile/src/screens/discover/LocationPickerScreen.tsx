import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MapPin, Navigation } from 'lucide-react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { FadeIn } from '../../components/motion';
import { useLocation } from '../../context/LocationContext';
import { useTheme } from '../../context/ThemeContext';
import { searchPlaces, type PlaceSearchResult } from '../../services/location';
import { snapToGrid } from '../../utils/geo';
import { spacing, radius } from '../../theme';
import type { NearbyStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Choose a discovery area by name.
 *
 * This exists because device location is optional in Converge. A member who
 * declines the permission prompt, or who wants to look at a city they are
 * travelling to, can set the area by hand. Both paths produce the same thing: a
 * grid-snapped point, so a place chosen here is no more precise than a device
 * reading.
 *
 * Results come from the platform geocoder, which is a real lookup rather than a
 * built-in list, so any city the device can resolve can be searched.
 */

type Props = NativeStackScreenProps<NearbyStackParamList, 'LocationPicker'>;

/** Keeps a fast typist from issuing a lookup on every keystroke. */
const SEARCH_DEBOUNCE_MS = 350;

export function LocationPickerScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { setManualArea, requestDeviceArea, loading: deviceLoading, area } = useLocation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once a search has run, so "no matches" is not shown before typing. */
  const [searched, setSearched] = useState(false);

  const requestId = useRef(0);

  const runSearch = useCallback(async (text: string) => {
    const id = ++requestId.current;
    setSearching(true);
    setError(null);
    try {
      const found = await searchPlaces(text);
      // Ignore a response that arrived after a newer search was started.
      if (id !== requestId.current) return;
      setResults(found);
      setSearched(true);
    } catch {
      if (id !== requestId.current) return;
      setError('That place could not be looked up. Check your connection and try again.');
      setResults([]);
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    // Clearing results for a short query happens inside the timeout callback
    // rather than in the effect body, so no state is set during render.
    const timer = setTimeout(() => {
      if (trimmed.length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }
      void runSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const choose = (result: PlaceSearchResult) => {
    setManualArea({
      // Snap even a chosen city, so both paths store the same kind of value.
      ...snapToGrid({ latitude: result.latitude, longitude: result.longitude }),
      areaLabel: result.city ?? result.label,
      city: result.city,
      countryCode: result.countryCode,
    });
    navigation.goBack();
  };

  const useDevice = async () => {
    const outcome = await requestDeviceArea();
    if (outcome.status === 'ok') navigation.goBack();
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text token="body" tone="secondary">
          Search for a city to explore. Converge stores the approximate area only, never an exact
          position.
        </Text>

        {area ? (
          <View style={[styles.current, { borderColor: theme.colors.border }]}>
            <MapPin size={16} color={theme.colors.textMuted} strokeWidth={2} />
            <Text token="caption" tone="secondary">
              Currently searching around {area.areaLabel ?? area.city ?? 'your area'}
            </Text>
          </View>
        ) : null}

        <TextField
          label="City or place"
          placeholder="e.g. Lagos, Berlin, São Paulo"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
        />

        {error ? <InlineMessage tone="error" message={error} /> : null}

        {searching ? (
          <View style={styles.searching}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text token="caption" tone="muted">
              Searching…
            </Text>
          </View>
        ) : null}

        {results.map((result, index) => (
          <FadeIn key={`${result.label}-${index}`} delay={index * 40}>
            <Pressable
              onPress={() => choose(result)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${result.label} as your area`}
              style={[
                styles.result,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <View style={[styles.resultIcon, { backgroundColor: theme.colors.accentSoft }]}>
                <MapPin size={16} color={theme.colors.accent} strokeWidth={2} />
              </View>
              <Text token="body" style={styles.resultLabel} numberOfLines={1}>
                {result.label}
              </Text>
            </Pressable>
          </FadeIn>
        ))}

        {searched && !searching && results.length === 0 && !error ? (
          <Text token="caption" tone="muted">
            No places matched that search. Try a city name on its own.
          </Text>
        ) : null}

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        <Button
          label="Use my device location instead"
          variant="secondary"
          icon={<Navigation size={16} color={theme.colors.textPrimary} strokeWidth={2} />}
          onPress={useDevice}
          loading={deviceLoading}
        />
        <Text token="caption" tone="muted" align="center">
          Converge asks for foreground permission only. It never tracks you in the background.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searching: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultLabel: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginVertical: spacing.sm },
});

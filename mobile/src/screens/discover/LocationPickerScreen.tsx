import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Globe2, MapPin, Navigation } from 'lucide-react-native';

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
 * Device location is optional in Converge, so this screen exists for the member
 * who declines the permission prompt, or who wants to look at somewhere they
 * are travelling to. Both routes produce the same thing: a grid-snapped point,
 * so a place chosen here is never more precise than a device reading.
 *
 * The lookup is a real geocoder reached through the Converge backend. Four
 * states are distinguished rather than collapsed into one empty list, because
 * each needs different words: searching, no match, lookup failed, and place
 * search not configured.
 */

type Props = NativeStackScreenProps<NearbyStackParamList, 'LocationPicker'>;

/** Keeps a fast typist from issuing a lookup on every keystroke. */
const SEARCH_DEBOUNCE_MS = 400;

/** How specific a place is, in words a member would use. */
const KIND_LABEL: Record<PlaceSearchResult['kind'], string> = {
  country: 'Country',
  region: 'Region',
  city: 'City',
  neighbourhood: 'Neighbourhood',
  other: 'Place',
};

export function LocationPickerScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { setManualArea, requestDeviceArea, loading: deviceLoading, area } = useLocation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** Distinguishes "searched and found nothing" from "have not searched yet". */
  const [searched, setSearched] = useState(false);

  // Only the newest search may write state, so a slow earlier response cannot
  // overwrite the results for what the member has since typed.
  const requestId = useRef(0);

  const runSearch = useCallback(async (text: string) => {
    const id = ++requestId.current;
    setSearching(true);
    setMessage(null);

    const outcome = await searchPlaces(text, { limit: 6 });
    if (id !== requestId.current) return;

    if (outcome.status === 'ok') {
      setResults(outcome.results);
    } else {
      setResults([]);
      setMessage(outcome.message);
    }
    setSearched(true);
    setSearching(false);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    // A short query clears the list inside the timeout callback rather than in
    // the effect body, so no state is set during render.
    const timer = setTimeout(() => {
      if (trimmed.length < 2) {
        requestId.current += 1; // invalidate any in-flight search
        setResults([]);
        setMessage(null);
        setSearched(false);
        setSearching(false);
        return;
      }
      void runSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const choose = (result: PlaceSearchResult) => {
    setManualArea({
      // Snap even a chosen city, so both routes store the same kind of value.
      ...snapToGrid({ latitude: result.latitude, longitude: result.longitude }),
      areaLabel: result.city ?? result.name ?? result.label,
      city: result.city ?? result.name,
      countryCode: result.countryCode ?? undefined,
    });
    navigation.goBack();
  };

  const useDevice = async () => {
    const outcome = await requestDeviceArea();
    if (outcome.status === 'ok') navigation.goBack();
  };

  const showEmpty = searched && !searching && !message && results.length === 0;

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text token="body" tone="secondary">
          Search for a country, city or neighbourhood to explore. Converge stores the approximate
          area only, never an exact position.
        </Text>

        {area ? (
          <View style={[styles.current, { borderColor: theme.colors.border }]}>
            <MapPin size={16} color={theme.colors.textMuted} strokeWidth={2} />
            <Text token="caption" tone="secondary" style={styles.flex}>
              Currently searching around {area.areaLabel ?? area.city ?? 'your area'}
            </Text>
          </View>
        ) : null}

        <TextField
          label="Country, city or neighbourhood"
          placeholder="e.g. Lagos, Berlin, São Paulo"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            const trimmed = query.trim();
            if (trimmed.length >= 2) void runSearch(trimmed);
          }}
        />

        {message ? <InlineMessage tone="error" message={message} /> : null}

        {searching ? (
          <View style={styles.searching}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text token="caption" tone="muted">
              Searching…
            </Text>
          </View>
        ) : null}

        {results.map((result, index) => (
          <FadeIn key={`${result.label}-${result.latitude}-${result.longitude}`} delay={index * 40}>
            <Pressable
              onPress={() => choose(result)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${result.label} as your discovery area`}
              style={({ pressed }) => [
                styles.result,
                {
                  backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={[styles.resultIcon, { backgroundColor: theme.colors.accentSoft }]}>
                <MapPin size={16} color={theme.colors.accent} strokeWidth={2} />
              </View>
              <View style={styles.flex}>
                <Text token="body" numberOfLines={1}>
                  {result.name}
                </Text>
                <Text token="caption" tone="muted" numberOfLines={1}>
                  {[KIND_LABEL[result.kind], result.label].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </Pressable>
          </FadeIn>
        ))}

        {showEmpty ? (
          <View style={[styles.empty, { borderColor: theme.colors.border }]}>
            <Globe2 size={20} color={theme.colors.textMuted} strokeWidth={2} />
            <Text token="caption" tone="muted" style={styles.flex}>
              Nothing matched “{query.trim()}”. Try a country or city name on its own.
            </Text>
          </View>
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
          Converge asks for foreground permission only, and only for an approximate position. It
          never tracks you in the background.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  flex: { flex: 1 },
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
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  divider: { height: StyleSheet.hairlineWidth * 2, marginVertical: spacing.sm },
});

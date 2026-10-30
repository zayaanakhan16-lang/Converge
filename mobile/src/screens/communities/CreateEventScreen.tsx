import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { ChipGroup } from '../../components/ui/ChipGroup';
import { Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { ACTIVITIES, LANGUAGES } from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import { useMutation } from '../../hooks/useData';
import type { CommunitiesStackParamList } from '../../navigation/types';
import { repository } from '../../services';
import { spacing } from '../../theme';
import { firstErrorFor, validateEventTitle, validateEventVenue, validateFields } from '../../utils/validation';

type Props = NativeStackScreenProps<CommunitiesStackParamList, 'CreateEvent'>;

/** Adds days to a local date and returns a datetime-local compatible string. */
function defaultStart(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(18, 0, 0, 0);
  return date;
}

function toInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function parseInputValue(value: string): string | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Create an event.
 *
 * Venue text is validated against private-address patterns because Converge
 * only supports activities in public places. The field cannot be bypassed from
 * the UI, and the database check constraint backs it up.
 */
export function CreateEventScreen({ navigation, route }: Props) {
  const { communityId } = route.params;
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [startsAt, setStartsAt] = useState(toInputValue(defaultStart()));
  const [endsAt, setEndsAt] = useState(
    toInputValue(new Date(defaultStart().getTime() + 2 * 60 * 60 * 1000)),
  );
  const [capacity, setCapacity] = useState('30');
  const [activities, setActivities] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['en']);
  const [errors, setErrors] = useState<ReturnType<typeof validateFields>['errors']>([]);

  const create = useMutation(
    useCallback(async () => {
      if (!user) throw new Error('You need to be signed in.');
      const startIso = parseInputValue(startsAt);
      const endIso = parseInputValue(endsAt);
      if (!startIso || !endIso) throw new Error('Enter a valid start and end time.');
      return repository().createEvent(user.id, {
        communityId,
        title: title.trim(),
        description: description.trim(),
        startsAt: startIso,
        endsAt: endIso,
        venueName: venue.trim(),
        activityIds: activities,
        languageCodes: languages,
        capacity: capacity.trim() ? Number(capacity) : null,
      });
    }, [activities, capacity, communityId, description, endsAt, languages, startsAt, title, user, venue]),
  );

  const submit = async () => {
    const startIso = parseInputValue(startsAt);
    const endIso = parseInputValue(endsAt);
    const validation = validateFields([
      ['title', validateEventTitle(title)],
      ['venue', validateEventVenue(venue)],
      ['startsAt', startIso ? null : 'Enter a valid start date and time.'],
      ['endsAt', endIso ? null : 'Enter a valid end date and time.'],
      [
        'range',
        startIso && endIso && new Date(endIso) <= new Date(startIso)
          ? 'The end time must be after the start time.'
          : null,
      ],
      [
        'capacity',
        capacity.trim() && (!Number.isInteger(Number(capacity)) || Number(capacity) < 2)
          ? 'Enter a whole number of at least 2, or leave it blank.'
          : null,
      ],
      ['languages', languages.length === 0 ? 'Choose at least one language.' : null],
    ]);
    setErrors(validation.errors);
    if (!validation.valid) return;
    const created = await create.run();
    if (created) navigation.replace('EventDetail', { eventId: created.id });
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Create an event</Text>
          <Text token="body" tone="secondary">
            Events must be held in public venues. Converge does not support private meetings
            between members who have not met before.
          </Text>
        </View>

        {create.error ? <InlineMessage tone="error" message={create.error} /> : null}

        <TextField
          label="Event title"
          value={title}
          onChangeText={setTitle}
          error={firstErrorFor(errors, 'title')}
          placeholder="e.g. Beginner data workshop"
          maxLength={90}
          required
        />

        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          hint="Optional. What will happen, and what should people bring?"
          multiline
          numberOfLines={4}
          maxLength={600}
        />

        <TextField
          label="Venue (public place)"
          value={venue}
          onChangeText={setVenue}
          error={firstErrorFor(errors, 'venue')}
          hint="A library, campus room, café or community hall. Private addresses are rejected."
          placeholder="e.g. Central Library, Meeting Room 2"
          maxLength={120}
          required
        />

        <View style={styles.row}>
          <TextField
            label="Starts"
            value={startsAt}
            onChangeText={setStartsAt}
            error={firstErrorFor(errors, 'startsAt') ?? firstErrorFor(errors, 'range')}
            hint="Format: YYYY-MM-DDTHH:MM"
            containerStyle={styles.half}
            required
          />
          <TextField
            label="Ends"
            value={endsAt}
            onChangeText={setEndsAt}
            error={firstErrorFor(errors, 'endsAt')}
            hint="Format: YYYY-MM-DDTHH:MM"
            containerStyle={styles.half}
            required
          />
        </View>

        <TextField
          label="Capacity"
          value={capacity}
          onChangeText={setCapacity}
          error={firstErrorFor(errors, 'capacity')}
          hint="Leave blank for no limit."
          keyboardType="number-pad"
          maxLength={4}
        />

        <ChipGroup
          title="Activities"
          description="Optional. Helps members find events that suit them."
          options={ACTIVITIES.map((activity) => ({ id: activity.id, label: activity.label }))}
          selected={activities}
          onToggle={(id) =>
            setActivities((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
            )
          }
        />

        <ChipGroup
          title="Languages"
          description="Languages the event will run in."
          options={LANGUAGES.map((language) => ({ id: language.code, label: language.label }))}
          selected={languages}
          onToggle={(id) =>
            setLanguages((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
            )
          }
        />
        {firstErrorFor(errors, 'languages') ? (
          <Text token="caption" tone="danger">
            {firstErrorFor(errors, 'languages')}
          </Text>
        ) : null}

        <SectionHeader
          title="What attendees see"
          subtitle="The venue name and the number going. Never a member list or a location map."
        />

        <Button label="Create event" onPress={submit} loading={create.busy} size="lg" fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
});

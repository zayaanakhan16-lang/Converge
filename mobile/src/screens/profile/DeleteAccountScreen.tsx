import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertTriangle } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { ProfileStackParamList } from '../../navigation/types';
import { radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DeleteAccount'>;

const CONFIRMATION_PHRASE = 'DELETE';

/**
 * Account deletion.
 *
 * Deletion is irreversible, so the screen states exactly what is removed and
 * requires the member to type the confirmation phrase. The actual removal runs
 * in a Supabase Edge Function so the service key never reaches the client.
 */
export function DeleteAccountScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { deleteAccount, isDemoMode, profile } = useAuth();
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = phrase.trim().toUpperCase() === CONFIRMATION_PHRASE;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await deleteAccount();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Delete your account</Text>
          <Text token="body" tone="secondary">
            This removes your Converge account permanently. It cannot be undone.
          </Text>
        </View>

        {error ? <InlineMessage tone="error" message={error} /> : null}
        {isDemoMode ? (
          <InlineMessage
            tone="info"
            message="In demo mode, deletion clears your local session only. A real deployment removes your data through the delete-account function."
          />
        ) : null}

        <Card>
          <SectionHeader title="What is deleted" />
          <Item text="Your profile, photo, interests, skills, languages and goals." />
          <Item text="Your memberships of every community, and any events you organised." />
          <Item text="Your connections and connection requests." />
          <Item text="Your conversations and every message you sent." />
          <Item text="Your translations, reports you made and notifications." />
          <Text token="caption" tone="muted" style={styles.note}>
            Messages you sent to others are removed from their conversations as well. Reports you
            filed are retained in anonymised form where moderation or legal obligations require it.
          </Text>
        </Card>

        <Card>
          <SectionHeader
            title="Before you go"
            subtitle="Consider these lighter alternatives."
          />
          <Item text="Set your visibility to Private to disappear from discovery without losing your communities." />
          <Item text="Turn off connection requests to stop new conversations arriving." />
          <Item text="Block a specific member instead of leaving entirely." />
          <Button
            label="Open privacy settings"
            variant="secondary"
            onPress={() => navigation.navigate('PrivacySettings')}
            fullWidth
          />
        </Card>

        <View
          style={[
            styles.warning,
            { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.error },
          ]}
        >
          <AlertTriangle size={16} color={theme.colors.error} strokeWidth={2} />
          <Text token="caption" tone="secondary" style={styles.warningText}>
            Deleting your account signs you out immediately. You will need to create a new account
            to use Converge again.
          </Text>
        </View>

        <TextField
          label={`Type ${CONFIRMATION_PHRASE} to confirm`}
          value={phrase}
          onChangeText={setPhrase}
          hint={`You are signed in as ${profile?.displayName ?? 'this member'}.`}
          autoCapitalize="characters"
          placeholder={CONFIRMATION_PHRASE}
          maxLength={12}
        />

        <Button
          label="Delete my account permanently"
          variant="danger"
          onPress={submit}
          disabled={!confirmed}
          loading={busy}
          size="lg"
          fullWidth
        />
        <Button label="Keep my account" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
      </View>
    </Screen>
  );
}

function Item({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.item}>
      <View style={[styles.dot, { backgroundColor: theme.colors.error }]} />
      <Text token="caption" tone="secondary" style={styles.itemText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
  item: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  itemText: { flex: 1 },
  note: { marginTop: spacing.md },
  warning: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'flex-start',
  },
  warningText: { flex: 1 },
});

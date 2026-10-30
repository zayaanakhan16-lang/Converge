import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, Keyboard } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { useTheme } from '../../context/ThemeContext';
import { useMutation } from '../../hooks/useData';
import type { CommunitiesStackParamList } from '../../navigation/types';
import { repository } from '../../services';
import { radius, spacing } from '../../theme';
import { validateJoinCode } from '../../utils/validation';

type Props = NativeStackScreenProps<CommunitiesStackParamList, 'JoinByCode'>;

/**
 * Join with a code.
 *
 * Codes exist so a community can be joined from a QR poster at a real event,
 * without exposing the community to public search.
 */
export function JoinByCodeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const join = useMutation(
    useCallback(async (value: string) => repository().joinByCode(value), []),
  );

  const submit = async () => {
    const validation = validateJoinCode(code);
    setFieldError(validation);
    if (validation) return;
    const community = await join.run(code);
    if (community) {
      navigation.replace('CommunityDetail', { communityId: community.id });
    }
  };

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        <View style={styles.heading}>
          <Text token="title1">Join with a code</Text>
          <Text token="body" tone="secondary">
            Enter the code shown on the community poster or shared by an organiser. Codes are
            case-insensitive.
          </Text>
        </View>

        {join.error ? <InlineMessage tone="error" message={join.error} /> : null}

        <TextField
          label="Community code"
          value={code}
          onChangeText={(value) => {
            setCode(value.toUpperCase());
            if (fieldError) setFieldError(null);
          }}
          error={fieldError}
          hint="Letters, numbers and hyphens, e.g. DATA-2026."
          placeholder="ENTER-CODE"
          autoCapitalize="characters"
          maxLength={24}
          required
          onSubmitEditing={submit}
          returnKeyType="go"
          containerStyle={styles.field}
        />

        <Button
          label="Join community"
          onPress={submit}
          loading={join.busy}
          size="lg"
          fullWidth
          icon={<Keyboard size={16} color={theme.colors.onPrimary} strokeWidth={2} />}
        />

        <Card>
          <SectionHeader
            title="Scanning instead?"
            subtitle="Point the camera at the community QR poster."
          />
          <Button
            label="Scan a QR code"
            variant="secondary"
            onPress={() => navigation.navigate('ScanCode')}
            icon={<Camera size={16} color={theme.colors.textPrimary} strokeWidth={2} />}
            fullWidth
          />
        </Card>

        <View
          style={[
            styles.note,
            { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
          ]}
        >
          <Text token="caption" tone="secondary">
            Joining a community makes its members visible to you and shows you in its member list,
            unless you turn that off in your privacy settings. Your exact location is never shared.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  heading: { gap: spacing.sm },
  field: { marginTop: spacing.sm },
  note: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});

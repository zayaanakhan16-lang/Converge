import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Bell,
  ChevronRight,
  Eye,
  Flag,
  Palette,
  ShieldOff,
  Sparkles,
  Trash2,
  UserCog,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Chip, LoadingState } from '../../components/ui/Chip';
import { DemoDataBanner } from '../../components/ui/Banners';
import { Button } from '../../components/ui/Button';
import { Card, Screen, SectionHeader } from '../../components/ui/Layout';
import { Text } from '../../components/ui/Text';
import {
  labelForActivity,
  labelForGoal,
  labelForInterest,
  labelForLanguage,
  labelForSkill,
} from '../../constants/taxonomy';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useBlockedUsers, useConnections } from '../../hooks/useData';
import type { ProfileStackParamList } from '../../navigation/types';
import { radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

/**
 * Profile and settings home.
 *
 * The top half is how the member appears to others; the bottom half is every
 * control that changes that appearance or the app's behaviour. Grouping them
 * this way makes the privacy consequences of each setting obvious.
 */
export function ProfileScreen({ navigation }: Props) {
  const { theme, themeName, preference, setPreference } = useTheme();
  const { profile, user, signOut, isDemoMode, demoReason, busy } = useAuth();
  const blocked = useBlockedUsers();
  const connections = useConnections();

  if (!profile) return <LoadingState label="Loading your profile" />;

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.stack}>
        {isDemoMode && demoReason ? <DemoDataBanner message={demoReason} /> : null}

        <View style={styles.identity}>
          <Avatar name={profile.displayName} uri={profile.avatarUrl} size={72} />
          <View style={styles.identityText}>
            <Text token="title1">{profile.displayName}</Text>
            <Text token="caption" tone="secondary">
              {profile.headline ?? 'No headline yet'}
            </Text>
            <Text token="caption" tone="muted">
              {user?.email}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Connections" value={connections.data.connections.length} />
          <Stat label="Interests" value={profile.interests.length} />
          <Stat label="Languages" value={profile.languages.length} />
        </View>

        {profile.bio ? (
          <Card>
            <SectionHeader title="Introduction" />
            <Text token="body" tone="secondary">
              {profile.bio}
            </Text>
          </Card>
        ) : (
          <Card>
            <Text token="body" tone="muted">
              You have not written an introduction. Members with an introduction receive more
              replies, and it is what the coach uses for practice scenarios.
            </Text>
          </Card>
        )}

        <Card>
          <SectionHeader title="Your profile" />
          <SettingRow
            Icon={UserCog}
            label="Edit profile details"
            hint="Name, headline, introduction and photo"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingRow
            Icon={Sparkles}
            label="Interests"
            hint={`${profile.interests.length} selected`}
            onPress={() => navigation.navigate('EditInterests')}
          />
          <SettingRow
            Icon={Sparkles}
            label="Skills and learning goals"
            hint={`${profile.skills.length} offered · ${profile.learningSkills.length} to learn`}
            onPress={() => navigation.navigate('EditSkills')}
          />
          <SettingRow
            Icon={Sparkles}
            label="Languages"
            hint={profile.languages.map(labelForLanguage).join(', ') || 'None selected'}
            onPress={() => navigation.navigate('EditLanguages')}
          />
          <SettingRow
            Icon={Sparkles}
            label="Goals"
            hint={profile.goals.map(labelForGoal).join(', ') || 'None selected'}
            onPress={() => navigation.navigate('EditGoals')}
          />
        </Card>

        <Card>
          <SectionHeader
            title="Privacy and safety"
            subtitle="These settings control who can find you and contact you."
          />
          <SettingRow
            Icon={Eye}
            label="Visibility and discovery"
            hint={`Currently: ${profile.privacy.visibility}${
              profile.privacy.shareApproximateLocation ? ' · approximate area shared' : ''
            }`}
            onPress={() => navigation.navigate('PrivacySettings')}
          />
          <SettingRow
            Icon={ShieldOff}
            label="Blocked accounts"
            hint={
              blocked.data.length === 0
                ? 'Nobody is blocked'
                : `${blocked.data.length} blocked`
            }
            onPress={() => navigation.navigate('BlockedAccounts')}
          />
          <SettingRow
            Icon={Flag}
            label="Reports you have made"
            hint="Reports are reviewed by moderators"
            onPress={() =>
              navigation.navigate('PrivacySettings')
            }
          />
          <SettingRow
            Icon={Bell}
            label="Notifications"
            hint="Choose what Converge tells you about"
            onPress={() => navigation.navigate('NotificationSettings')}
          />
        </Card>

        <Card>
          <SectionHeader title="Appearance" />
          <View style={styles.themeRow}>
            {(
              [
                { id: 'system', label: 'System' },
                { id: 'light', label: 'Light' },
                { id: 'dark', label: 'Dark' },
              ] as const
            ).map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                selected={preference === option.id}
                onPress={() => setPreference(option.id)}
                icon={
                  option.id === 'system' ? (
                    <Palette size={13} color={theme.colors.textSecondary} strokeWidth={2} />
                  ) : undefined
                }
              />
            ))}
          </View>
          <Text token="caption" tone="muted">
            Currently showing the {themeName} theme. Both themes use the same verified contrast
            ratios.
          </Text>
        </Card>

        <Card>
          <SectionHeader
            title="About and data"
            subtitle="What is stored, and how to remove it."
          />
          <SettingRow
            Icon={Sparkles}
            label="Brand and design system"
            hint="Logo, palette and typography tokens"
            onPress={() => navigation.navigate('Brand')}
          />
          <SettingRow
            Icon={Trash2}
            label="Delete my account"
            hint="Permanently removes your profile, messages and memberships"
            onPress={() => navigation.navigate('DeleteAccount')}
            danger
          />
        </Card>

        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => void signOut()}
          loading={busy}
          fullWidth
        />

        <Text token="caption" tone="muted" align="center">
          Converge 0.1.0 · Find common ground. Start meaningful conversations.
        </Text>
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Text token="title2">{value}</Text>
      <Text token="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

export function SettingRow({
  Icon,
  label,
  hint,
  onPress,
  danger = false,
  trailing,
}: {
  Icon: typeof ChevronRight;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        style={[
          styles.settingIcon,
          { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
        ]}
      >
        <Icon size={16} color={danger ? theme.colors.error : theme.colors.accent} strokeWidth={2} />
      </View>
      <View style={styles.settingText}>
        <Text token="body" tone={danger ? 'danger' : 'primary'}>
          {label}
        </Text>
        {hint ? (
          <Text token="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        <ChevronRight size={17} color={theme.colors.textMuted} strokeWidth={2} />
      )}
    </Pressable>
  );
}

export { labelForInterest, labelForActivity, labelForSkill };

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  identity: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  identityText: { flex: 1, gap: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  stat: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
    gap: spacing.xxs,
    alignItems: 'flex-start',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  settingText: { flex: 1, gap: spacing.xxs },
  themeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
});

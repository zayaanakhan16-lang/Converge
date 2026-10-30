import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Eye, Languages, Lock, ShieldCheck, Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../context/ThemeContext';
import type { OnboardingStackParamList } from '../../navigation/types';
import { radius, spacing } from '../../theme';
import { OnboardingLayout } from './OnboardingLayout';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingIntro'>;

const PRINCIPLES = [
  {
    Icon: Eye,
    title: 'You choose what is visible',
    body: 'Every field is optional. You can hide your profile from discovery and still join communities.',
  },
  {
    Icon: ShieldCheck,
    title: 'Exact location stays private',
    body: 'If you share an area, it is rounded to roughly five kilometres before it is stored.',
  },
  {
    Icon: Lock,
    title: 'Messaging needs both people',
    body: 'Nobody can send you a private message until you accept a connection request.',
  },
  {
    Icon: Sparkles,
    title: 'Recommendations you can read',
    body: 'AuraMatch lists the reasons behind each suggestion instead of showing a score.',
  },
  {
    Icon: Languages,
    title: 'Language is not a barrier',
    body: 'Write in your own language and let Converge translate for the other person.',
  },
] as const;

export function OnboardingIntroScreen({ navigation }: Props) {
  const { theme } = useTheme();
  return (
    <OnboardingLayout
      step={1}
      totalSteps={7}
      title="Build a profile that works for you"
      subtitle="Six short steps. Each one is optional, and you can change any answer later in your profile settings."
      onNext={() => navigation.navigate('OnboardingIdentity')}
      nextLabel="Start"
    >
      <View style={styles.list}>
        {PRINCIPLES.map(({ Icon, title, body }) => (
          <View
            key={title}
            style={[
              styles.row,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: theme.colors.accentSoft }]}>
              <Icon size={17} color={theme.colors.accent} strokeWidth={2} />
            </View>
            <View style={styles.rowText}>
              <Text token="bodyStrong">{title}</Text>
              <Text token="caption" tone="secondary">
                {body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingLayout>
  );
}

export { Button };

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'flex-start',
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: spacing.xxs },
});

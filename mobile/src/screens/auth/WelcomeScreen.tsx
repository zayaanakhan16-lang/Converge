import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Building2,
  Compass,
  Handshake,
  Languages,
  MessageSquareText,
  Sparkles,
} from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConvergeMark } from '../../components/brand/ConvergeMark';
import { DemoDataBanner } from '../../components/ui/Banners';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { AuthStackParamList } from '../../navigation/types';
import { radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

/** The journey Converge is built around, stated once and reused as copy. */
const JOURNEY = [
  {
    Icon: Compass,
    title: 'Discover',
    body: 'Explore communities, clubs, events and people who share your interests.',
  },
  {
    Icon: Sparkles,
    title: 'Understand',
    body: 'AuraMatch explains why a connection could be worthwhile, never a bare percentage.',
  },
  {
    Icon: MessageSquareText,
    title: 'Practise',
    body: 'Rehearse introductions and questions with the conversation coach before you send.',
  },
  {
    Icon: Handshake,
    title: 'Connect',
    body: 'Requests are mutual. Messaging opens only when you both agree.',
  },
  {
    Icon: Languages,
    title: 'Communicate',
    body: 'Translate as you write so a shared interest is not blocked by a shared language.',
  },
  {
    Icon: Building2,
    title: 'Participate',
    body: 'Join discussions and public events with the communities you belong to.',
  },
] as const;

export function WelcomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { isDemoMode, demoReason } = useAuth();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <View style={styles.hero}>
            <ConvergeMark size={54} stroke={theme.colors.primary} node={theme.colors.accent} />
            <Text token="display" style={styles.title}>
              Find common ground.{'\n'}Start meaningful conversations.
            </Text>
            <Text token="body" tone="secondary" style={styles.intro}>
              Converge turns shared interests and community participation into real
              conversations and collaboration. It is not a follower count and not a
              dating app.
            </Text>
          </View>

          {isDemoMode && demoReason ? (
            <DemoDataBanner message={`${demoReason} Sign in with the demo account to explore every screen.`} />
          ) : null}

          <View style={styles.journey}>
            {JOURNEY.map(({ Icon, title, body }) => (
              <View key={title} style={styles.step}>
                <View
                  style={[
                    styles.stepIcon,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <Icon size={18} color={theme.colors.accent} strokeWidth={1.9} />
                </View>
                <View style={styles.stepText}>
                  <Text token="bodyStrong">{title}</Text>
                  <Text token="caption" tone="secondary">
                    {body}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              label="Create an account"
              onPress={() => navigation.navigate('SignUp')}
              size="lg"
              fullWidth
            />
            <Button
              label="Sign in"
              variant="secondary"
              onPress={() => navigation.navigate('SignIn')}
              size="lg"
              fullWidth
            />
          </View>

          <Text token="caption" tone="muted" align="center" style={styles.privacy}>
            Your exact location is never stored or shared. Discovery is opt-in, and
            private messaging always requires mutual consent.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingVertical: spacing.xxxl },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: spacing.xl },
  hero: { gap: spacing.lg, marginBottom: spacing.xxl },
  title: { marginTop: spacing.sm },
  intro: { maxWidth: 440 },
  journey: { gap: spacing.lg, marginTop: spacing.xxl },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, gap: spacing.xxs },
  actions: { gap: spacing.md, marginTop: spacing.xxxl },
  privacy: { marginTop: spacing.xl, paddingHorizontal: spacing.md },
});

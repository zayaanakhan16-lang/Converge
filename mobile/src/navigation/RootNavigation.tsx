import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Text } from '../components/ui/Text';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { OnboardingProvider } from '../features/onboarding/OnboardingContext';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { OnboardingCompleteScreen } from '../screens/onboarding/OnboardingCompleteScreen';
import { OnboardingGoalsScreen } from '../screens/onboarding/OnboardingGoalsScreen';
import { OnboardingIdentityScreen } from '../screens/onboarding/OnboardingIdentityScreen';
import { OnboardingInterestsScreen } from '../screens/onboarding/OnboardingInterestsScreen';
import { OnboardingIntroScreen } from '../screens/onboarding/OnboardingIntroScreen';
import { OnboardingLanguagesScreen } from '../screens/onboarding/OnboardingLanguagesScreen';
import { OnboardingLocationScreen } from '../screens/onboarding/OnboardingLocationScreen';
import { OnboardingPrivacyScreen } from '../screens/onboarding/OnboardingPrivacyScreen';
import { OnboardingSkillsScreen } from '../screens/onboarding/OnboardingSkillsScreen';
import { spacing } from '../theme';
import { MainTabs } from './MainTabs';
import type { AuthStackParamList, OnboardingStackParamList, RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

/** Deep links: converge://chat/<id> and https equivalents land on the right tab. */
const linking = {
  prefixes: ['converge://', 'https://converge.app'],
  config: {
    screens: {
      Main: {
        screens: {
          Discover: {
            screens: { DiscoverHome: 'discover', ProfileDetail: 'member/:userId', Coach: 'coach' },
          },
          Communities: {
            screens: {
              CommunitiesHome: 'communities',
              CommunityDetail: 'community/:communityId',
              EventDetail: 'event/:eventId',
              CommunityDiscussion: 'community/:communityId/discussion',
            },
          },
          // `Chat` exists in both the Connections and Messages stacks. Only the
          // Messages copy carries the path, because React Navigation rejects the
          // same pattern resolving to two screens. `chat/:conversationId` is the
          // canonical target; opening it from Connections happens in-stack.
          Connections: { screens: { ConnectionsHome: 'connections' } },
          Messages: { screens: { Conversations: 'messages', Chat: 'chat/:conversationId' } },
          Profile: { screens: { ProfileHome: 'profile' } },
        },
      },
      Auth: {
        screens: {
          Welcome: 'welcome',
          SignIn: 'sign-in',
          SignUp: 'sign-up',
          ForgotPassword: 'reset-password',
        },
      },
    },
  },
};

function AuthNavigator() {
  const { theme } = useTheme();
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function OnboardingNavigator({ initialName }: { initialName: string }) {
  const { theme } = useTheme();
  return (
    <OnboardingProvider initialName={initialName}>
      <OnboardingStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <OnboardingStack.Screen name="OnboardingIntro" component={OnboardingIntroScreen} />
        <OnboardingStack.Screen name="OnboardingIdentity" component={OnboardingIdentityScreen} />
        <OnboardingStack.Screen name="OnboardingInterests" component={OnboardingInterestsScreen} />
        <OnboardingStack.Screen name="OnboardingSkills" component={OnboardingSkillsScreen} />
        <OnboardingStack.Screen
          name="OnboardingLanguages"
          component={OnboardingLanguagesScreen}
        />
        <OnboardingStack.Screen name="OnboardingGoals" component={OnboardingGoalsScreen} />
        <OnboardingStack.Screen name="OnboardingLocation" component={OnboardingLocationScreen} />
        <OnboardingStack.Screen name="OnboardingPrivacy" component={OnboardingPrivacyScreen} />
        <OnboardingStack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} />
      </OnboardingStack.Navigator>
    </OnboardingProvider>
  );
}

/**
 * Root navigation.
 *
 * Which navigator is mounted is derived from the session and the profile's
 * onboarding flag, so a member can never reach a screen their state does not
 * allow and no screen has to redirect defensively.
 */
export function RootNavigation() {
  const { theme, themeName } = useTheme();
  const { status, user } = useAuth();

  const navigationTheme = useMemo(() => {
    const base = themeName === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.accent,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.textPrimary,
        border: theme.colors.border,
        notification: theme.colors.accent,
      },
    };
  }, [theme, themeName]);

  if (status === 'loading') {
    return (
      <View style={[styles.splash, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text token="caption" tone="muted" style={styles.splashText}>
          Opening Converge
        </Text>
      </View>
    );
  }

  const needsOnboarding = Boolean(user && !user.profile.onboardingCompleted);

  return (
    <NavigationContainer
      theme={navigationTheme}
      linking={linking as unknown as LinkingOptions<RootStackParamList>}
    >
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {status === 'signed-in' && user ? (
          needsOnboarding ? (
            <RootStack.Screen name="Onboarding">
              {() => <OnboardingNavigator initialName={user.profile.displayName} />}
            </RootStack.Screen>
          ) : (
            <RootStack.Screen name="Main" component={MainTabs} />
          )
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  splashText: { marginTop: spacing.sm },
});

export { SafeAreaProvider };

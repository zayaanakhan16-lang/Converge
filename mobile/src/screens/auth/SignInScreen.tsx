import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InlineMessage, Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { DEMO_ACCOUNT } from '../../data/demo';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { AuthStackParamList } from '../../navigation/types';
import { MIN_TOUCH_TARGET, spacing } from '../../theme';
import { firstErrorFor, validateEmail, validateFields } from '../../utils/validation';
import { AuthLayout } from './AuthLayout';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { signIn, busy, error, isDemoMode, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<ReturnType<typeof validateFields>['errors']>([]);

  const submit = async () => {
    const validation = validateFields([
      ['email', validateEmail(email)],
      ['password', password ? null : 'Enter your password.'],
    ]);
    setErrors(validation.errors);
    if (!validation.valid) return;
    try {
      await signIn(email, password);
    } catch {
      // The context surfaces the message; nothing else to do here.
    }
  };

  const useDemoAccount = () => {
    clearError();
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your communities and conversations."
      onBack={() => navigation.goBack()}
      footer={
        <View style={styles.footerRow}>
          <Text token="caption" tone="secondary">
            New to Converge?
          </Text>
          <Pressable
            onPress={() => navigation.navigate('SignUp')}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
            style={styles.footerLink}
          >
            <Text token="caption" tone="accent">
              Create an account
            </Text>
          </Pressable>
        </View>
      }
    >
      {error ? <InlineMessage tone="error" message={error} /> : null}

      <TextField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        error={firstErrorFor(errors, 'email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
        required
        returnKeyType="next"
      />

      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={firstErrorFor(errors, 'password')}
        secure
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        placeholder="Your password"
        required
        onSubmitEditing={submit}
        returnKeyType="go"
      />

      <Button label="Sign in" onPress={submit} loading={busy} size="lg" fullWidth />

      <Pressable
        onPress={() => navigation.navigate('ForgotPassword')}
        accessibilityRole="button"
        accessibilityLabel="Forgot your password"
        style={styles.forgot}
      >
        <Text token="caption" tone="accent">
          Forgot your password?
        </Text>
      </Pressable>

      {isDemoMode ? (
        <View
          style={[
            styles.demoBox,
            { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
          ]}
        >
          <Text token="label" tone="secondary">
            Demo account
          </Text>
          <Text token="caption" tone="secondary">
            {DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}
          </Text>
          <Button
            label="Fill demo credentials"
            variant="ghost"
            onPress={useDemoAccount}
            style={styles.demoButton}
          />
        </View>
      ) : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  forgot: {
    alignSelf: 'center',
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  footerLink: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  demoBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  demoButton: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});

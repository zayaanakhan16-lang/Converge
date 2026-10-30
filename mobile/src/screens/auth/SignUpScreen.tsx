import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, InlineMessage } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParamList } from '../../navigation/types';
import { MIN_TOUCH_TARGET, spacing } from '../../theme';
import {
  MAX_DISPLAY_NAME_LENGTH,
  firstErrorFor,
  validateDisplayName,
  validateEmail,
  validateFields,
  validatePassword,
  validatePasswordConfirmation,
} from '../../utils/validation';
import { AuthLayout } from './AuthLayout';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const { signUp, busy, error } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateFields>['errors']>([]);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const submit = async () => {
    const validation = validateFields([
      ['displayName', validateDisplayName(displayName)],
      ['email', validateEmail(email)],
      ['password', validatePassword(password)],
      ['confirmation', validatePasswordConfirmation(password, confirmation)],
      ['terms', acceptedTerms ? null : 'Accept the community guidelines to continue.'],
    ]);
    setErrors(validation.errors);
    if (!validation.valid) return;
    try {
      const result = await signUp(email, password, displayName);
      if (result.confirmationRequired) setConfirmationSent(true);
    } catch {
      // Error is surfaced by the auth context.
    }
  };

  if (confirmationSent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={`We sent a confirmation link to ${email.trim()}. Open it to finish creating your account, then sign in.`}
        footer={
          <Pressable
            onPress={() => navigation.navigate('SignIn')}
            accessibilityRole="button"
            accessibilityLabel="Go to sign in"
            hitSlop={8}
          >
            <Text token="caption" tone="accent">
              Back to sign in
            </Text>
          </Pressable>
        }
      >
        <InlineMessage
          tone="info"
          message="Email confirmation is enabled on this Supabase project. Until you confirm, you will not be able to sign in."
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Your profile is voluntary and editable at any time. Only add what you are comfortable sharing."
      onBack={() => navigation.goBack()}
      footer={
        <View style={styles.footerRow}>
          <Text token="caption" tone="secondary">
            Already have an account?
          </Text>
          <Pressable
            onPress={() => navigation.navigate('SignIn')}
            accessibilityRole="button"
            accessibilityLabel="Sign in instead"
            style={styles.footerLink}
          >
            <Text token="caption" tone="accent">
              Sign in
            </Text>
          </Pressable>
        </View>
      }
    >
      {error ? <InlineMessage tone="error" message={error} /> : null}

      <TextField
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        error={firstErrorFor(errors, 'displayName')}
        hint={`This is the only name other members see. Up to ${MAX_DISPLAY_NAME_LENGTH} characters.`}
        placeholder="How you would like to be known"
        maxLength={MAX_DISPLAY_NAME_LENGTH}
        required
        returnKeyType="next"
      />

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
        hint="At least 10 characters, including two of: lowercase, uppercase, numbers."
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        required
        returnKeyType="next"
      />

      <TextField
        label="Confirm password"
        value={confirmation}
        onChangeText={setConfirmation}
        error={firstErrorFor(errors, 'confirmation')}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        required
        returnKeyType="done"
        onSubmitEditing={submit}
      />

      <Pressable
        onPress={() => setAcceptedTerms((value) => !value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acceptedTerms }}
        accessibilityLabel="Accept the community guidelines and privacy notice"
        style={styles.terms}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: acceptedTerms ? 'transparent' : '#C9C1B4',
              backgroundColor: acceptedTerms ? '#0E3A4C' : 'transparent',
            },
          ]}
        >
          {acceptedTerms ? <Text token="caption" color="#FFFFFF">✓</Text> : null}
        </View>
        <Text token="caption" tone="secondary" style={styles.termsText}>
          I agree to the community guidelines: no harassment, no unsolicited private
          messaging, and public venues only for in-person activities.
        </Text>
      </Pressable>
      {firstErrorFor(errors, 'terms') ? (
        <Text token="caption" tone="danger">
          {firstErrorFor(errors, 'terms')}
        </Text>
      ) : null}

      <Button label="Create account" onPress={submit} loading={busy} size="lg" fullWidth />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  terms: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  termsText: { flex: 1 },
  footerLink: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
});

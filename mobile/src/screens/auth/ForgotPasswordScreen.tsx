import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';

import { Button, InlineMessage } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParamList } from '../../navigation/types';
import { validateEmail } from '../../utils/validation';
import { AuthLayout } from './AuthLayout';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

/**
 * Password recovery.
 *
 * Supabase sends the recovery link, so this screen reports exactly what the
 * provider did rather than claiming an email was delivered.
 */
export function ForgotPasswordScreen({ navigation }: Props) {
  const { requestPasswordReset, busy, error, isDemoMode } = useAuth();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const validation = validateEmail(email);
    setFieldError(validation);
    if (validation) return;
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      // Surfaced by the auth context.
    }
  };

  if (sent) {
    return (
      <AuthLayout
        title="Recovery email sent"
        subtitle={`If an account exists for ${email.trim()}, Supabase has sent a link to reset the password. The link expires shortly, so use it soon.`}
        onBack={() => navigation.navigate('SignIn')}
      >
        <InlineMessage
          tone="info"
          message="Check your spam folder if the message does not arrive within a few minutes."
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email address on your account and we will ask Supabase to send a recovery link."
      onBack={() => navigation.goBack()}
    >
      {error ? <InlineMessage tone="error" message={error} /> : null}
      {isDemoMode ? (
        <InlineMessage
          tone="info"
          message="Password recovery requires a configured Supabase project. In demo mode no email can be sent."
        />
      ) : null}

      <TextField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        error={fieldError}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
        required
        onSubmitEditing={submit}
        returnKeyType="send"
      />

      <Button
        label="Send recovery email"
        onPress={submit}
        loading={busy}
        disabled={isDemoMode}
        size="lg"
        fullWidth
      />
    </AuthLayout>
  );
}

import { ChevronDown, Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { MIN_TOUCH_TARGET, radius, spacing, typography } from '../../theme';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  /** Helper text shown below the field when there is no error. */
  hint?: string;
  /** Renders a show/hide control for password fields. */
  secure?: boolean;
  containerStyle?: ViewStyle;
  required?: boolean;
}

/**
 * Labelled text field.
 *
 * The label is always visible rather than a floating placeholder, which keeps
 * the form usable when autofill inserts a value and removes reliance on colour
 * alone to convey state.
 */
export function TextField({
  label,
  error,
  hint,
  secure = false,
  containerStyle,
  required = false,
  ...rest
}: TextFieldProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColour = error
    ? theme.colors.error
    : focused
      ? theme.colors.accent
      : theme.colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text token="label" tone="secondary" style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View
        style={[
          styles.inputRow,
          {
            borderColor: borderColour,
            backgroundColor: theme.colors.surface,
          },
          focused ? { borderWidth: 1.5 } : null,
        ]}
      >
        <TextInput
          {...rest}
          secureTextEntry={secure && !revealed}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={label}
          accessibilityHint={hint ?? error ?? undefined}
          style={[typography.body, styles.input, { color: theme.colors.textPrimary }]}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={styles.trailing}
          >
            <Text token="caption" tone="accent">
              {revealed ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text token="caption" color={theme.colors.error} style={styles.message}>
          {error}
        </Text>
      ) : hint ? (
        <Text token="caption" tone="muted" style={styles.message}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  onSubmit?: () => void;
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  onSubmit,
}: SearchFieldProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.search,
        { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
      ]}
    >
      <Search size={18} color={theme.colors.textMuted} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={[typography.body, styles.searchInput, { color: theme.colors.textPrimary }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
        >
          <X size={16} color={theme.colors.textMuted} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

export interface SelectFieldProps {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  error?: string | null;
}

/** Opens a picker sheet; the sheet itself is rendered by the calling screen. */
export function SelectField({ label, value, placeholder, onPress, error }: SelectFieldProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <Text token="label" tone="secondary" style={styles.label}>
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        style={[
          styles.inputRow,
          {
            borderColor: error ? theme.colors.error : theme.colors.border,
            backgroundColor: theme.colors.surface,
            justifyContent: 'space-between',
          },
        ]}
      >
        <Text token="body" tone={value ? 'primary' : 'muted'}>
          {value ?? placeholder}
        </Text>
        <ChevronDown size={18} color={theme.colors.textMuted} strokeWidth={2} />
      </Pressable>
      {error ? (
        <Text token="caption" color={theme.colors.error} style={styles.message}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { marginBottom: spacing.xxs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
    minHeight: MIN_TOUCH_TARGET,
  },
  input: { flex: 1, paddingVertical: spacing.md },
  trailing: { paddingLeft: spacing.md, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  message: { marginTop: spacing.xxs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
    minHeight: MIN_TOUCH_TARGET,
  },
  searchInput: { flex: 1, paddingVertical: spacing.md },
});

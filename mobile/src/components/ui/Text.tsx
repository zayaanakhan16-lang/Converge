import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { typography, type TypographyToken } from '../../theme';

export interface TextProps extends RNTextProps {
  token?: TypographyToken;
  color?: string;
  /** Convenience for the three text tones, resolved from the active theme. */
  tone?: 'primary' | 'secondary' | 'muted' | 'accent' | 'inverse' | 'danger' | 'success';
  align?: 'auto' | 'left' | 'right' | 'center';
}

/**
 * The only text component in the app.
 *
 * Centralising it guarantees the brand type scale is applied consistently and
 * that colour always comes from theme tokens rather than hard-coded values.
 */
export function Text({
  token = 'body',
  tone = 'primary',
  color,
  align,
  style,
  ...rest
}: TextProps) {
  const { theme } = useTheme();
  const toneColour = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    muted: theme.colors.textMuted,
    accent: theme.colors.accent,
    inverse: theme.colors.surfaceInverse === theme.colors.background ? theme.colors.onPrimary : theme.colors.textPrimary,
    danger: theme.colors.error,
    success: theme.colors.success,
  }[tone];

  return (
    <RNText
      {...rest}
      style={[
        typography[token],
        { color: color ?? toneColour },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

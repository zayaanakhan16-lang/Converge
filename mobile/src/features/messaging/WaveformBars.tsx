import { View, type ViewStyle } from 'react-native';

import { useTheme } from '../../context/ThemeContext';

/**
 * The bars drawn under a voice note.
 *
 * Values are peak amplitude on a 0-100 scale, taken from the recording itself by
 * the native audio module. Nothing here is generated: when the array is empty the
 * caller renders the duration alone instead of a decorative flat line.
 *
 * A short bar still has a visible minimum height, because a silent section that
 * renders as nothing reads as a gap in the audio rather than as silence.
 */

export interface WaveformBarsProps {
  /** Peak amplitude per bar, 0-100. */
  bars: number[];
  /** Bars are drawn at this height; a bar scales within it. */
  height?: number;
  /** Colour of the bars. Defaults to the theme's secondary text colour. */
  color?: string;
  /** Highlights the first `progress` fraction of the bars, for playback. */
  progress?: number;
  style?: ViewStyle;
}

const MINIMUM_BAR_FRACTION = 0.12;

export function WaveformBars({
  bars,
  height = 24,
  color,
  progress,
  style,
}: WaveformBarsProps) {
  const { theme } = useTheme();
  const barColor = color ?? theme.colors.textSecondary;

  if (bars.length === 0) return null;

  const playedThrough = progress === undefined ? bars.length : Math.round(progress * bars.length);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Voice note waveform, ${bars.length} bars${
        progress === undefined ? '' : `, ${Math.round((progress ?? 0) * 100)} percent played`
      }`}
      style={[{ flexDirection: 'row', alignItems: 'center', height, gap: 2 }, style]}
    >
      {bars.map((value, index) => {
        const clamped = Math.max(0, Math.min(100, value));
        const fraction = Math.max(MINIMUM_BAR_FRACTION, clamped / 100);
        const isPlayed = index < playedThrough;
        return (
          <View
            // Bars are positional and never reordered, so the index is a stable
            // key. A waveform never contains more bars than the screen can show.
            key={index}
            style={{
              flex: 1,
              height: Math.max(2, Math.round(height * fraction)),
              borderRadius: 1,
              backgroundColor: barColor,
              opacity: isPlayed ? 1 : 0.45,
            }}
          />
        );
      })}
    </View>
  );
}

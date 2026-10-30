import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { duration } from '../../theme';

/**
 * Motion primitives.
 *
 * Everything here is built on React Native's own `Animated` and drives only
 * `transform` and `opacity`, which the native driver can run off the JS thread.
 * That matters on the target hardware (a Vivo Y21): an animation that competes
 * with list rendering for the JS thread is what makes a budget Android phone
 * feel slow, so no animation here touches layout properties, and no animation
 * library is added.
 *
 * The rule for using these: motion should explain a change (this appeared
 * because you navigated here; this is responding to your press) rather than
 * decorate a screen. Screen-level entrance is used once per screen, not on
 * every element inside it.
 */

export interface RiseInProps {
  children: React.ReactNode;
  /** Stagger in milliseconds, for sequencing several items. */
  delay?: number;
  /** Distance travelled upward, in points. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrance animation: fades in while rising a short distance.
 *
 * Intended for the first meaningful block on a screen, or for a short run of
 * list items with an increasing `delay`.
 */
export function RiseIn({ children, delay = 0, distance = 12, style }: RiseInProps) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: duration.slow,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay]);

  const transform = useMemo(
    () => [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
    [progress, distance],
  );

  return (
    <Animated.View style={[style, { opacity: progress, transform }]}>{children}</Animated.View>
  );
}

export interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  durationMs?: number;
  style?: StyleProp<ViewStyle>;
}

/** Opacity-only entrance, for content that should not appear to move. */
export function FadeIn({ children, delay = 0, durationMs = duration.normal, style }: FadeInProps) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay, durationMs]);

  return <Animated.View style={[style, { opacity: progress }]}>{children}</Animated.View>;
}

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale applied while held. 1 disables the effect. */
  activeScale?: number;
}

/**
 * A pressable that dips slightly while held.
 *
 * This is the app's main tactile feedback. It is deliberately subtle (2%): the
 * gesture should read as the surface acknowledging the touch, not as the button
 * jumping.
 */
export function PressableScale({
  children,
  style,
  activeScale = 0.98,
  ...rest
}: PressableScaleProps) {
  const [scale] = useState(() => new Animated.Value(1));

  const animateTo = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: duration.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      {...rest}
      onPressIn={(event) => {
        animateTo(activeScale);
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        rest.onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export interface PulseProps {
  children: React.ReactNode;
  /** Peak opacity of the halo. */
  toOpacity?: number;
  /** Full cycle length in milliseconds. */
  cycleMs?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A slow, breathing opacity pulse.
 *
 * Used to draw the eye to a single live element (a shared node on the mark, a
 * pending request). Never applied to more than one thing on screen at a time,
 * because several pulsing elements read as noise.
 */
export function Pulse({ children, toOpacity = 0.45, cycleMs = 2200, style }: PulseProps) {
  const [value] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: toOpacity,
          duration: cycleMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 1,
          duration: cycleMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, toOpacity, cycleMs]);

  return <Animated.View style={[style, { opacity: value }]}>{children}</Animated.View>;
}

/**
 * Cross-fade between two pieces of content without unmounting either.
 *
 * Used where a value changes in place (a filter count, a translated message)
 * so the change is visible rather than instantaneous.
 */
export function CrossFade({
  visible,
  children,
  style,
}: {
  visible: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: duration.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, visible]);

  return <Animated.View style={[style, { opacity: progress }]}>{children}</Animated.View>;
}

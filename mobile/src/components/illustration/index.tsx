import { useEffect, useId, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import {
  MARK_CURVE_PATHS,
  MARK_NODE,
  MARK_STROKE_WIDTH,
  MARK_VIEWBOX,
} from '../../brand/mark';
import { useTheme } from '../../context/ThemeContext';
import { duration } from '../../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * Animated brand illustrations.
 *
 * These are drawn as vectors and animated with `Animated`, rather than shipped
 * as Lottie or Rive files. The reasoning: the brand is already expressed as
 * geometry (the same path data that generates the exported SVGs), so an
 * animation built from that geometry stays on-brand by construction and adds no
 * runtime dependency. It also means every illustration takes its colours from
 * the active theme and stays crisp at any density.
 *
 * All of them animate only `strokeDashoffset`, `opacity` and `transform`, so
 * they run on the native driver.
 */

/** Path length used to normalise stroke-dash draw-on animations. */
const DASH_LENGTH = 140;

export interface ConvergingPathsProps {
  size?: number;
  /** Milliseconds between each path starting to draw. */
  stagger?: number;
  /** Play the entrance animation. Set false for a static mark. */
  animate?: boolean;
  strokeWidth?: number;
}

/**
 * The Converge mark, drawn on rather than simply appearing.
 *
 * Each of the three paths draws from its outer end towards the shared node,
 * then the node scales in. The sequence is the product idea made literal:
 * separate paths arriving at one point.
 */
export function ConvergingPaths({
  size = 160,
  stagger = 180,
  animate = true,
  strokeWidth = MARK_STROKE_WIDTH,
}: ConvergingPathsProps) {
  const { theme } = useTheme();
  const [draw] = useState(() => new Animated.Value(animate ? 0 : 1));
  const [node] = useState(() => new Animated.Value(animate ? 0 : 1));

  useEffect(() => {
    if (!animate) return;
    const sequence = Animated.sequence([
      ...MARK_CURVE_PATHS.map((_, index) =>
        Animated.timing(draw, {
          toValue: (index + 1) / MARK_CURVE_PATHS.length,
          duration: duration.slow * 1.6,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
          delay: index === 0 ? 0 : stagger,
        }),
      ),
      Animated.spring(node, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: false,
      }),
    ]);
    sequence.start();
    return () => sequence.stop();
  }, [animate, draw, node, stagger]);

  const nodeScale = node.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}>
      {MARK_CURVE_PATHS.map((d, index) => {
        // Each path draws across its own slice of the shared progress value.
        const share = 1 / MARK_CURVE_PATHS.length;
        const dashOffset = draw.interpolate({
          inputRange: [index * share, (index + 1) * share],
          outputRange: [DASH_LENGTH, 0],
          extrapolate: 'clamp',
        });
        return (
          <AnimatedPath
            key={d}
            d={d}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={DASH_LENGTH}
            strokeDashoffset={dashOffset}
          />
        );
      })}
      <AnimatedCircle
        cx={MARK_NODE.cx}
        cy={MARK_NODE.cy}
        r={MARK_NODE.r}
        fill={theme.colors.accent}
        originX={MARK_NODE.cx}
        originY={MARK_NODE.cy}
        transform={[{ scale: nodeScale }]}
      />
    </Svg>
  );
}

export interface SharedGroundProps {
  size?: number;
  animate?: boolean;
}

/**
 * Two figures arriving at a shared interest.
 *
 * Two dots travel inwards along the arms of the mark and settle beside the
 * node, while three interest markers around the node fade up in sequence. It
 * depicts the moment the product exists for: two people finding something in
 * common, rather than a generic "people talking" scene.
 */
export function SharedGround({ size = 200, animate = true }: SharedGroundProps) {
  const { theme } = useTheme();
  const [travel] = useState(() => new Animated.Value(animate ? 0 : 1));
  const [markers] = useState(() => new Animated.Value(animate ? 0 : 1));
  const [halo] = useState(() => new Animated.Value(animate ? 0 : 1));

  useEffect(() => {
    if (!animate) return;
    const sequence = Animated.sequence([
      Animated.timing(travel, {
        toValue: 1,
        duration: duration.slow * 2,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(markers, {
        toValue: 1,
        duration: duration.slow,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(halo, {
        toValue: 1,
        duration: duration.slow,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    sequence.start();
    return () => sequence.stop();
  }, [animate, travel, markers, halo]);

  // The two dots start apart and end up either side of the shared node.
  const leftX = travel.interpolate({ inputRange: [0, 1], outputRange: [-34, -13] });
  const rightX = travel.interpolate({ inputRange: [0, 1], outputRange: [34, 13] });
  const armOpacity = travel.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0.55, 0.55] });

  const markerOpacity = markers.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}>
      {/* The two arms of the mark, dimmed to read as paths already travelled. */}
      <AnimatedG opacity={armOpacity}>
        <Path
          d={MARK_CURVE_PATHS[0]}
          fill="none"
          stroke={theme.colors.primary}
          strokeWidth={MARK_STROKE_WIDTH}
          strokeLinecap="round"
        />
        <Path
          d={MARK_CURVE_PATHS[2]}
          fill="none"
          stroke={theme.colors.primary}
          strokeWidth={MARK_STROKE_WIDTH}
          strokeLinecap="round"
        />
      </AnimatedG>

      {/* Interest markers around the shared point. */}
      <AnimatedG opacity={markerOpacity}>
        <Circle cx={50} cy={14} r={3.4} fill={theme.colors.primary} opacity={0.5} />
        <Circle cx={50} cy={86} r={3.4} fill={theme.colors.primary} opacity={0.5} />
        <Circle cx={16} cy={50} r={3.4} fill={theme.colors.primary} opacity={0.35} />
      </AnimatedG>

      {/* Halo marking the shared point. */}
      <AnimatedCircle
        cx={MARK_NODE.cx}
        cy={MARK_NODE.cy}
        r={MARK_NODE.r * 2.1}
        fill={theme.colors.accent}
        opacity={0.14}
        originX={MARK_NODE.cx}
        originY={MARK_NODE.cy}
        transform={[{ scale: haloScale }]}
      />
      <Circle cx={MARK_NODE.cx} cy={MARK_NODE.cy} r={MARK_NODE.r} fill={theme.colors.accent} />

      {/* The two figures, converging on the shared point. */}
      <AnimatedCircle
        cx={MARK_NODE.cx}
        cy={MARK_NODE.cy}
        r={7.4}
        fill={theme.colors.primary}
        originX={MARK_NODE.cx}
        originY={MARK_NODE.cy}
        transform={[{ translateX: leftX }]}
      />
      <AnimatedCircle
        cx={MARK_NODE.cx}
        cy={MARK_NODE.cy}
        r={7.4}
        fill={theme.colors.secondary}
        originX={MARK_NODE.cx}
        originY={MARK_NODE.cy}
        transform={[{ translateX: rightX }]}
      />
    </Svg>
  );
}

export type EmptyArtKind = 'search' | 'people' | 'communities' | 'messages' | 'requests' | 'error';

export interface EmptyArtProps {
  kind: EmptyArtKind;
  size?: number;
}

/**
 * Animated art for empty and error states.
 *
 * Each variant is a small piece of brand geometry with one moving element, so
 * an empty screen still looks designed rather than broken. The motion is slow
 * and low-amplitude on purpose: an empty state is a resting place, not a
 * loading indicator.
 */
export function EmptyArt({ kind, size = 132 }: EmptyArtProps) {
  const { theme } = useTheme();
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const rise = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const settle = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });
  const breathe = drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const ink = theme.colors.borderStrong;
  const faint = theme.colors.border;

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {kind === 'search' ? (
        <>
          <AnimatedG opacity={0.9} transform={[{ translateY: rise }]}>
            <Circle cx={54} cy={52} r={26} fill="none" stroke={ink} strokeWidth={5} />
            <Circle cx={54} cy={52} r={13} fill="none" stroke={faint} strokeWidth={4} />
          </AnimatedG>
          <Path d="M73 71 L92 90" stroke={theme.colors.accent} strokeWidth={6} strokeLinecap="round" />
        </>
      ) : null}

      {kind === 'people' ? (
        <>
          <AnimatedG transform={[{ translateY: rise }]}>
            <Circle cx={44} cy={44} r={15} fill={faint} />
            <Path d="M20 92c0-13 11-23 24-23s24 10 24 23" fill={faint} />
          </AnimatedG>
          <AnimatedG transform={[{ translateY: settle }]}>
            <Circle cx={78} cy={40} r={12} fill={ink} />
            <Path d="M60 88c0-11 8-20 18-20s18 9 18 20" fill={ink} />
          </AnimatedG>
          <Circle cx={96} cy={22} r={4} fill={theme.colors.accent} />
        </>
      ) : null}

      {kind === 'communities' ? (
        <>
          <AnimatedG transform={[{ translateY: rise }]}>
            <Rect x={22} y={30} width={76} height={58} rx={10} fill={faint} />
            <Rect x={32} y={42} width={34} height={6} rx={3} fill={ink} />
            <Rect x={32} y={56} width={52} height={6} rx={3} fill={ink} opacity={0.5} />
          </AnimatedG>
          <Circle cx={38} cy={80} r={7} fill={theme.colors.accent} />
          <Circle cx={54} cy={80} r={7} fill={theme.colors.accent} opacity={0.6} />
          <Circle cx={70} cy={80} r={7} fill={theme.colors.accent} opacity={0.35} />
        </>
      ) : null}

      {kind === 'messages' ? (
        <>
          <AnimatedG transform={[{ translateY: rise }]}>
            <Path
              d="M24 34h64a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8H56l-16 14v-14h-16a8 8 0 0 1-8-8V42a8 8 0 0 1 8-8z"
              fill={faint}
            />
            <Rect x={32} y={48} width={44} height={5} rx={2.5} fill={ink} />
            <Rect x={32} y={60} width={28} height={5} rx={2.5} fill={ink} opacity={0.5} />
          </AnimatedG>
          <Circle cx={92} cy={30} r={5} fill={theme.colors.accent} />
        </>
      ) : null}

      {kind === 'requests' ? (
        <>
          <AnimatedG transform={[{ translateY: rise }]}>
            <Circle cx={48} cy={48} r={20} fill={faint} />
          </AnimatedG>
          <AnimatedG transform={[{ translateY: settle }]}>
            <Circle cx={80} cy={62} r={17} fill={ink} />
          </AnimatedG>
          <Path
            d="M66 46h12M72 40v12"
            stroke={theme.colors.accent}
            strokeWidth={5}
            strokeLinecap="round"
          />
        </>
      ) : null}

      {kind === 'error' ? (
        <>
          <AnimatedG transform={[{ translateY: rise }]}>
            <Circle cx={60} cy={54} r={26} fill="none" stroke={faint} strokeWidth={5} />
          </AnimatedG>
          <Path
            d="M60 40v20"
            stroke={theme.colors.error}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <AnimatedCircle
            cx={60}
            cy={72}
            r={4}
            fill={theme.colors.error}
            originX={60}
            originY={72}
            transform={[{ scale: breathe }]}
          />
        </>
      ) : null}
    </Svg>
  );
}

export interface ConnectionMomentProps {
  size?: number;
  visible: boolean;
}

/**
 * The moment two members become connected.
 *
 * Two markers travel together and a ring expands once. It is shown after a
 * connection request is accepted, so the state change has a visual beat rather
 * than silently re-rendering a list.
 */
export function ConnectionMoment({ size = 160, visible }: ConnectionMomentProps) {
  const { theme } = useTheme();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    const sequence = Animated.sequence([
      Animated.timing(progress, {
        toValue: 0.6,
        duration: duration.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(progress, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
    ]);
    sequence.start();
    return () => sequence.stop();
  }, [visible, progress]);

  const gap = progress.interpolate({ inputRange: [0, 1], outputRange: [30, 11] });
  const ringScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.25] });
  const ringOpacity = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0.5, 0] });
  const checkOpacity = progress.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1] });

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <AnimatedCircle
        cx={60}
        cy={60}
        r={34}
        fill="none"
        stroke={theme.colors.accent}
        strokeWidth={3}
        opacity={ringOpacity}
        originX={60}
        originY={60}
        transform={[{ scale: ringScale }]}
      />
      <AnimatedCircle
        cx={60}
        cy={60}
        r={16}
        fill={theme.colors.primary}
        originX={60}
        originY={60}
        transform={[{ translateX: Animated.multiply(gap, -1) }]}
      />
      <AnimatedCircle
        cx={60}
        cy={60}
        r={16}
        fill={theme.colors.secondary}
        originX={60}
        originY={60}
        transform={[{ translateX: gap }]}
      />
      <AnimatedPath
        d="M52 60l6 6 12-13"
        fill="none"
        stroke={theme.colors.background}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={checkOpacity}
      />
    </Svg>
  );
}

/**
 * A soft top-edge wash used behind hero content.
 *
 * A single restrained gradient, tied to the brand accent, so hero areas read as
 * lit rather than as a flat rectangle. It is a static layer: gradients are
 * cheap, but an animated one would cost a full-screen redraw per frame.
 */
export function HeroWash({ height = 260, intensity = 0.16 }: { height?: number; intensity?: number }) {
  const { theme } = useTheme();
  // `useId` gives a stable, unique id without calling an impure function during
  // render, which a gradient reference needs to avoid colliding across screens.
  const id = `wash-${useId()}`;

  return (
    <View pointerEvents="none" style={[styles.wash, { height }]}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor={theme.colors.accent} stopOpacity={intensity} />
            <Stop offset="0.6" stopColor={theme.colors.accent} stopOpacity={intensity * 0.25} />
            <Stop offset="1" stopColor={theme.colors.accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { position: 'absolute', top: 0, left: 0, right: 0 },
});

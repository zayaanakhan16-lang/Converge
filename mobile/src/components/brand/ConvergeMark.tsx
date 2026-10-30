import Svg, { Circle, Path } from 'react-native-svg';

import {
  MARK_CURVE_PATHS,
  MARK_NODE,
  MARK_STROKE_WIDTH,
  MARK_VIEWBOX,
} from '../../brand/mark';
import { Text } from '../ui/Text';

export interface ConvergeMarkProps {
  size: number;
  /** Colour of the converging paths. */
  stroke: string;
  /** Colour of the shared node at the point of convergence. */
  node: string;
  strokeWidth?: number;
}

/**
 * The Converge mark, drawn from the same vector data that generates the brand
 * SVGs (`brand/tools/generate_brand.py`). Rendering it as real geometry rather
 * than a raster asset keeps it crisp at any size and lets it take theme colours.
 */
export function ConvergeMark({ size, stroke, node, strokeWidth = MARK_STROKE_WIDTH }: ConvergeMarkProps) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}>
      {MARK_CURVE_PATHS.map((d) => (
        <Path
          key={d}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ))}
      <Circle cx={MARK_NODE.cx} cy={MARK_NODE.cy} r={MARK_NODE.r} fill={node} />
    </Svg>
  );
}

export interface ConvergeLogoProps {
  /** Height of the mark in the lockup. */
  size?: number;
  colour: string;
  nodeColour: string;
  /** Optional wordmark rendered as text beside the mark. */
  showWordmark?: boolean;
  wordmarkColour?: string;
}

/**
 * Horizontal lockup: mark plus wordmark. The wordmark uses the display face so
 * the lockup matches the SVG export without embedding outlined glyphs.
 */
export function ConvergeLogo({
  size = 28,
  colour,
  nodeColour,
  showWordmark = true,
  wordmarkColour,
}: ConvergeLogoProps) {
  return (
    <>
      <ConvergeMark size={size} stroke={colour} node={nodeColour} />
      {showWordmark ? (
        <Text
          token="title2"
          color={wordmarkColour ?? colour}
          style={{ fontFamily: 'Fraunces-SemiBold', marginLeft: size * 0.3 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          Converge
        </Text>
      ) : null}
    </>
  );
}

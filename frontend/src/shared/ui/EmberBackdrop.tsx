import { useEffect, useId } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/shared/theme/ThemeProvider';

type EmberSpec = { left: number; top: number; size: number; duration: number; delay: number; drift: number };

const EMBERS: EmberSpec[] = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: 55 + ((i * 23) % 45),
  size: 2 + (i % 3),
  duration: 9000 + ((i * 1700) % 7000),
  delay: (i * 900) % 8000,
  drift: (i % 2 === 0 ? 1 : -1) * (6 + ((i * 7) % 14)),
}));

function Ember({ spec, rise, color }: { spec: EmberSpec; rise: number; color: string }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      spec.delay,
      withRepeat(withTiming(1, { duration: spec.duration, easing: Easing.linear }), -1, false),
    );
  }, [t, spec]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.15, 0.65, 1], [0, 0.85, 0.45, 0]),
    transform: [
      { translateY: -t.value * rise },
      { translateX: Math.sin(t.value * Math.PI * 2) * spec.drift },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${spec.left}%`,
          top: `${spec.top}%`,
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size,
          backgroundColor: color,
          boxShadow: `0 0 ${spec.size * 3}px ${spec.size / 2}px ${color}`,
        },
        style,
      ]}
    />
  );
}

/**
 * The background of the welcome and auth screens: two warm glows and a few embers drifting
 * up. Purely decorative, hidden from screen readers; without motion the embers are left out.
 */
export function EmberBackdrop() {
  const { colors, scheme } = useTheme();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const base = useId().replace(/[^a-zA-Z0-9]/g, '');
  const strength = scheme === 'dark' ? 1 : 0.6;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${base}low`} cx="18%" cy="88%" rx="60%" ry="55%" fx="18%" fy="88%">
            <Stop offset="0" stopColor={colors.accent.fill} stopOpacity={0.2 * strength} />
            <Stop offset="1" stopColor={colors.accent.fill} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${base}high`} cx="92%" cy="6%" rx="45%" ry="40%" fx="92%" fy="6%">
            <Stop offset="0" stopColor={colors.accent.fill} stopOpacity={0.09 * strength} />
            <Stop offset="1" stopColor={colors.accent.fill} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${base}low)`} />
        <Rect width="100%" height="100%" fill={`url(#${base}high)`} />
      </Svg>
      {reduceMotion
        ? null
        : EMBERS.map((spec) => (
            <Ember key={`${spec.left}-${spec.top}`} spec={spec} rise={height * 0.5} color={colors.accent.fill} />
          ))}
    </View>
  );
}

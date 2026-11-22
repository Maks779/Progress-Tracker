import { type ReactNode, useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/shared/theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  size: number;
  progress: number;
  strokeWidth?: number;
  duration?: number;
  delay?: number;
  glow?: boolean;
  accessibilityLabel?: string;
  children?: ReactNode;
};

function Glow({ size }: { size: number }) {
  const { colors, scheme } = useTheme();
  const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const breath = useSharedValue(0.75);
  const span = size * 1.7;

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }),
        withTiming(0.75, { duration: 2600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
  }, [breath]);

  const style = useAnimatedStyle(() => ({
    opacity: breath.value,
    transform: [{ scale: 0.92 + breath.value * 0.08 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: span, height: span, left: (size - span) / 2, top: (size - span) / 2 },
        style,
      ]}
    >
      <Svg width={span} height={span}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.accent.fill} stopOpacity={scheme === 'dark' ? 0.28 : 0.18} />
            <Stop offset="1" stopColor={colors.accent.fill} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={span / 2} cy={span / 2} r={span / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The progress ring: a quiet track and an accent arc that starts at 12 o'clock and fills
 * with an ease-out (no bounce). With "reduce motion" on, the arc appears without animation.
 */
export function ProgressRing({
  size,
  progress,
  strokeWidth = 8,
  duration = 250,
  delay = 0,
  glow = false,
  accessibilityLabel,
  children,
}: Props) {
  const { colors } = useTheme();
  const center = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const share = Math.min(Math.max(progress, 0), 1);
  const filled = useSharedValue(0);

  useEffect(() => {
    filled.value = withDelay(
      delay,
      withTiming(share, {
        duration,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
      ReduceMotion.System,
    );
  }, [filled, share, duration, delay]);

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - filled.value),
  }));

  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {glow ? <Glow size={size} /> : null}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={colors.border.default}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          animatedProps={arc}
          cx={center}
          cy={center}
          r={r}
          stroke={colors.accent.fill}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {children}
    </View>
  );
}

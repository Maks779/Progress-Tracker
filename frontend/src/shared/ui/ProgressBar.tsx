import { View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

type Props = { value: number; color: string; label: string };

/** Progress bar from the Figma library: 8 px, filled in `color`; `value` is 0–1 and is clamped. */
export function ProgressBar({ value, color, label }: Props) {
  const { colors, radius } = useTheme();
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      style={{ height: 8, borderRadius: radius.full, backgroundColor: colors.bg.surfaceRaised, overflow: 'hidden' }}
    >
      <View style={{ width: `${percent}%`, height: 8, borderRadius: radius.full, backgroundColor: color }} />
    </View>
  );
}

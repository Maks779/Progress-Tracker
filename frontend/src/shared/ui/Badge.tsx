import { View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import type { LucideIcon } from './icons';
import { Text } from './Text';

type Props = { icon: LucideIcon; label: string; color: string };

/** Status badge from the Figma library ("On track", "4-week streak"): an icon and a short label. */
export function Badge({ icon: Icon, label, color }: Props) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: space[8],
        borderRadius: radius[8],
        backgroundColor: colors.bg.surfaceRaised,
      }}
    >
      <Icon color={color} size={14} strokeWidth={2} />
      <Text variant="captionMedium">{label}</Text>
    </View>
  );
}

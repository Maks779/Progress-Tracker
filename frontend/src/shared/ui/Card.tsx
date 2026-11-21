import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.bg.surface,
          borderColor: colors.border.default,
          borderWidth: 1,
          borderRadius: radius[16],
          padding: space[16],
          gap: space[8],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

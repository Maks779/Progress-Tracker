import type { ReactNode } from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

type Props = Omit<ViewProps, 'style'> & { children: ReactNode; style?: ViewStyle };

export function Card({ children, style, ...rest }: Props) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      {...rest}
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

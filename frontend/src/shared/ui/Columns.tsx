import type { ReactNode } from 'react';
import { View } from 'react-native';

import { SIDE_COLUMN_WIDTH, useTwoColumns } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';

type Props = { main: ReactNode; side?: ReactNode };

/**
 * The desktop page layout from the design: the main content and a 352 px supporting column on
 * the right. Phones, tablets and desktop windows too narrow for both stack the two, main
 * content first.
 */
export function Columns({ main, side }: Props) {
  const { space } = useTheme();
  const wide = useTwoColumns();
  if (!wide) {
    return (
      <View style={{ gap: space[16] }}>
        {main}
        {side}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[24] }}>
      <View style={{ flex: 1, gap: space[24] }}>{main}</View>
      {side ? <View style={{ width: SIDE_COLUMN_WIDTH, gap: space[24] }}>{side}</View> : null}
    </View>
  );
}

import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useSideColumn } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';

type Props = { main: ReactNode; side?: ReactNode; tablet?: boolean };

/**
 * The desktop page layout from the design: the main content and a 352 px supporting column on
 * the right. With `tablet` the page keeps a narrower column on tablets, as Home does in the
 * design. Where there is no room for one, the two stack, main content first.
 */
export function Columns({ main, side, tablet = false }: Props) {
  const { space } = useTheme();
  const sideWidth = useSideColumn(tablet);
  if (sideWidth === null) {
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
      {side ? <View style={{ width: sideWidth, gap: space[24] }}>{side}</View> : null}
    </View>
  );
}

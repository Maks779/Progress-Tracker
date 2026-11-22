import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { fonts } from '@/shared/theme/tokens';

import { Text } from './Text';

/** The Ember mark (an ember rising like an "A") with the wordmark. */
export function Logo() {
  const { colors, space } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Ember"
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}
    >
      <Svg width={28} height={28} viewBox="0 0 24 24">
        <Path d="M12 1.5 23 22.5h-6L12 12.8 7 22.5H1L12 1.5Z" fill={colors.accent.fill} />
      </Svg>
      <Text variant="h2" style={{ fontFamily: fonts.bold }}>
        ember
      </Text>
    </View>
  );
}

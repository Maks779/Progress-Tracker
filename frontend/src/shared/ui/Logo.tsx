import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { fonts } from '@/shared/theme/tokens';

import { Text } from './Text';

/** The Ember mark (an ember rising like an "A", with its triangular counter) and the wordmark. */
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
        <Path d="M12 1.5 23 22.5h-7.75L12 14.9l-3.25 7.6H1L12 1.5Zm0 4.8-3.7 7.5h7.4L12 6.3Z" fill={colors.accent.fill} fillRule="evenodd" />
      </Svg>
      <Text variant="h2" style={{ fontFamily: fonts.bold }}>
        ember
      </Text>
    </View>
  );
}

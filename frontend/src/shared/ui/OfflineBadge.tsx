import { useTranslation } from 'react-i18next';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useOffline } from '@/shared/api/connection';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { Badge } from './Badge';
import { WifiOff } from './icons';

/**
 * "Offline" while the device has no network or the server does not answer: what the page
 * shows was saved on the device and may be out of date. The empty status region stays in
 * place, so screen readers hear the badge when it appears; `style` spaces the badge itself.
 */
export function OfflineBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const offline = useOffline();
  return (
    <View accessibilityLiveRegion="polite" role="status" style={{ alignItems: 'flex-start' }}>
      {offline ? (
        <View accessible accessibilityLabel={t('sync.badgeLabel')} style={style}>
          <Badge icon={WifiOff} color={colors.state.warning} label={t('sync.badge')} />
        </View>
      ) : null}
    </View>
  );
}

import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { TriangleAlert } from '@/shared/ui/icons';
import { Sheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';

type Props = { count: number; onLogOut: () => Promise<void>; onClose: () => void };

/**
 * Log out while changes made on this device have not reached the server: logging out deletes
 * them from the device (the next person must not get them), so it asks first.
 */
export function LogOutSheet({ count, onLogOut, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Sheet visible title={t('sync.logOutTitle')} onClose={onClose}>
      <View style={{ flexDirection: 'row', gap: space[8] }}>
        <TriangleAlert color={colors.state.error} size={20} strokeWidth={1.75} />
        <Text variant="small" tone="muted" style={{ flex: 1 }}>
          {t('sync.logOutBody', { count })}
        </Text>
      </View>
      <Button label={t('sync.logOutConfirm')} variant="destructive" onPress={onLogOut} />
      <Button label={t('sync.logOutCancel')} variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

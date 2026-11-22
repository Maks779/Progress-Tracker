import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Text } from '@/shared/ui/Text';

type Props = { visible: boolean; onToggle: () => void };

/** "Password is hidden. Show password" under a password field. */
export function PasswordVisibility({ visible, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onToggle}
      style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}
    >
      <Text variant="caption" tone="muted">
        {t(visible ? 'auth.passwordShown' : 'auth.passwordHidden')}{' '}
        <Text variant="captionStrong">{t(visible ? 'auth.hidePassword' : 'auth.showPassword')}</Text>
      </Text>
    </Pressable>
  );
}

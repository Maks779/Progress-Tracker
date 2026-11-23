import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { signOut } from '@/features/auth/session';
import { useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ShieldCheck } from '@/shared/ui/icons';
import { Screen } from '@/shared/ui/Screen';
import { Text } from '@/shared/ui/Text';

import { DeleteAccountSheet } from '../components/DeleteAccountSheet';
import { ProfileCard } from '../components/ProfileCard';
import { SettingsCard } from '../components/SettingsCard';

function PersonalCard() {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Card style={{ gap: space[16], padding: space[24] }}>
      <ShieldCheck color={colors.accent.text} size={24} strokeWidth={1.75} />
      <Text variant="h3">{t('profile.personalTitle')}</Text>
      <Text variant="small" tone="muted">
        {t('profile.personalBody')}
      </Text>
      <Text variant="caption" tone="muted">
        {t('profile.version')}
      </Text>
    </Card>
  );
}

/**
 * Profile and settings. Phones and tablets get one column; desktop puts the account actions
 * and a short privacy note in a column on the right, as in the design. The two account
 * buttons sit side by side only on tablets: elsewhere "Видалити акаунт" would not fit.
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const { space } = useTheme();
  const breakpoint = useBreakpoint();
  const wide = breakpoint === 'expanded';
  const sideBySide = breakpoint === 'medium';
  const me = useReadMe();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const logOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const account = (
    <>
      <ProfileCard
        me={me.data?.status === 200 ? me.data.data : undefined}
        loading={me.isPending}
        onRetry={() => me.refetch()}
      />
      <SettingsCard />
    </>
  );

  const actions = (
    <View style={{ flexDirection: sideBySide ? 'row' : 'column', gap: space[16] }}>
      <View style={sideBySide ? { flex: 1 } : undefined}>
        <Button label={t('profile.logOut')} variant="secondary" loading={signingOut} onPress={logOut} />
      </View>
      <View style={sideBySide ? { flex: 1 } : undefined}>
        <Button label={t('profile.deleteAccount')} variant="secondary" onPress={() => setDeleting(true)} />
      </View>
    </View>
  );

  return (
    <Screen title={t('profile.title')} caption={t('profile.caption')}>
      {wide ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[24] }}>
          <View style={{ flex: 1, gap: space[24] }}>{account}</View>
          <View style={{ width: 352, gap: space[24] }}>
            {actions}
            <PersonalCard />
          </View>
        </View>
      ) : (
        <View style={{ gap: space[24] }}>
          {account}
          {actions}
        </View>
      )}
      <DeleteAccountSheet visible={deleting} onClose={() => setDeleting(false)} />
    </Screen>
  );
}

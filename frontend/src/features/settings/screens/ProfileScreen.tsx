import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { signOut } from '@/features/auth/session';
import { ExportSheet } from '@/features/export/ExportSheet';
import { NotificationsCard } from '@/features/notifications/components';
import { forgetAccount, useOutbox } from '@/features/outbox/outbox';
import { workout } from '@/features/workout/store';
import { useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { SIDE_COLUMN_WIDTH, useBreakpoint, useTwoColumns } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Download, Layers, ShieldCheck, Target } from '@/shared/ui/icons';
import { Screen } from '@/shared/ui/Screen';
import { Text } from '@/shared/ui/Text';

import { ChangePasswordSheet } from '../components/ChangePasswordSheet';
import { DeleteAccountSheet } from '../components/DeleteAccountSheet';
import { EditNameSheet } from '../components/EditNameSheet';
import { LinksCard } from '../components/LinksCard';
import { LogOutSheet } from '../components/LogOutSheet';
import { ProfileCard } from '../components/ProfileCard';
import { SettingsCard } from '../components/SettingsCard';

function PersonalCard() {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Card style={{ gap: space[16], padding: space[16] }}>
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
 * Profile and settings. Phones, tablets and narrow desktop windows get one column; wide
 * desktop windows put the account actions and a short privacy note in a column on the right,
 * as in the design. The account buttons sit side by side only in the one-column layout of
 * tablets and desktop: on phones and in the right column "Видалити акаунт" would not fit.
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const { space } = useTheme();
  const breakpoint = useBreakpoint();
  const twoColumns = useTwoColumns();
  const router = useRouter();
  const wide = breakpoint === 'expanded';
  const sideBySide = breakpoint !== 'compact' && !twoColumns;
  const me = useReadMe();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmingLogOut, setConfirmingLogOut] = useState(false);
  const account = me.data?.status === 200 ? me.data.data : undefined;
  const unsynced = useOutbox((state) => state.items.filter((item) => item.userId === account?.id).length);

  const leave = async () => {
    setSigningOut(true);
    workout.clear();
    if (account) {
      await forgetAccount(account.id);
    }
    await signOut();
  };
  const logOut = async () => {
    if (unsynced > 0) {
      setConfirmingLogOut(true);
      return;
    }
    await leave();
  };

  const main = (
    <>
      <ProfileCard
        me={account}
        loading={me.isPending}
        onRetry={() => me.refetch()}
        onEditName={() => setEditingName(true)}
      />
      <SettingsCard />
      <NotificationsCard />
    </>
  );

  const links = (
    <LinksCard
      links={[
        {
          icon: Target,
          title: t('profile.links.goals'),
          hint: wide ? t('profile.links.goalsHint') : undefined,
          onPress: () => router.push('/profile/goals'),
        },
        {
          icon: Layers,
          title: t('profile.links.trackers'),
          hint: wide ? t('profile.links.trackersHint') : undefined,
          onPress: () => router.push('/profile/trackers'),
        },
        {
          icon: Download,
          title: t('profile.export.link'),
          hint: wide ? t('profile.export.linkHint') : undefined,
          onPress: () => setExporting(true),
        },
      ]}
    />
  );

  const actions = (
    <View style={{ flexDirection: sideBySide ? 'row' : 'column', gap: space[16] }}>
      <View style={sideBySide ? { flex: 1 } : undefined}>
        <Button
          label={t('profile.changePassword')}
          variant="secondary"
          onPress={() => setChangingPassword(true)}
        />
      </View>
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
      {twoColumns ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[24] }}>
          <View style={{ flex: 1, gap: space[24] }}>{main}</View>
          <View style={{ width: SIDE_COLUMN_WIDTH, gap: space[24] }}>
            {links}
            {actions}
            <PersonalCard />
          </View>
        </View>
      ) : (
        <View style={{ gap: space[24] }}>
          {main}
          {links}
          {actions}
        </View>
      )}
      {editingName && account ? (
        <EditNameSheet name={account.name} onClose={() => setEditingName(false)} />
      ) : null}
      {changingPassword ? <ChangePasswordSheet onClose={() => setChangingPassword(false)} /> : null}
      {exporting ? <ExportSheet onClose={() => setExporting(false)} /> : null}
      <DeleteAccountSheet visible={deleting} onClose={() => setDeleting(false)} />
      {confirmingLogOut ? (
        <LogOutSheet count={unsynced} onLogOut={leave} onClose={() => setConfirmingLogOut(false)} />
      ) : null}
    </Screen>
  );
}

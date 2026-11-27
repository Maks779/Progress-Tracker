import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { TextLink } from '@/shared/ui/TextLink';

import { AuthLayout } from '../components/AuthLayout';
import { WeeklyGoalExample } from '../components/WeeklyGoalExample';
import { useAuthStore } from '../store';

/**
 * On desktop the hero panel already shows the weekly goal ring, so it is not repeated here.
 * After a session expires the log-in screen explains why, so Welcome hands over to it: on a
 * phone the app opens the auth group here, and the root guard's `redirectTo` is not applied.
 */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const { space } = useTheme();
  const router = useRouter();
  const wide = useBreakpoint() === 'expanded';
  const expired = useAuthStore((state) => state.expired);

  if (expired) {
    return <Redirect href="/log-in" />;
  }

  return (
    <AuthLayout
      eyebrow={t('auth.welcome.eyebrow')}
      title={t('auth.welcome.title')}
      subtitle={t('auth.welcome.subtitle')}
      caption={t('auth.welcome.caption')}
      upperCaption
      large
    >
      {wide ? null : (
        <View style={{ alignItems: 'center', paddingVertical: space[16] }}>
          <WeeklyGoalExample size={192} />
        </View>
      )}
      <Button label={t('auth.welcome.start')} onPress={() => router.push('/sign-up')} />
      <TextLink label={t('auth.welcome.haveAccount')} href="/log-in" tone="primary" />
    </AuthLayout>
  );
}

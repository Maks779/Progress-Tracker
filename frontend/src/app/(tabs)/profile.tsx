import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { signOut } from '@/features/auth/session';
import { LANGUAGE_NAMES, LANGUAGES } from '@/shared/i18n';
import { type ThemePreference, useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Screen } from '@/shared/ui/Screen';
import { Text } from '@/shared/ui/Text';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_KEYS = {
  system: 'profile.themeSystem',
  light: 'profile.themeLight',
  dark: 'profile.themeDark',
} as const;

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { preference, setPreference, space } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const logOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <Screen title={t('profile.title')}>
      <Card>
        <Text variant="captionStrong" tone="muted">
          {t('profile.language')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
          {LANGUAGES.map((language) => (
            <View key={language} style={{ flexGrow: 1 }}>
              <Button
                label={LANGUAGE_NAMES[language]}
                variant="secondary"
                size="compact"
                selected={i18n.resolvedLanguage === language}
                onPress={() => i18n.changeLanguage(language)}
              />
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <Text variant="captionStrong" tone="muted">
          {t('profile.theme')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
          {THEMES.map((theme) => (
            <View key={theme} style={{ flexGrow: 1 }}>
              <Button
                label={t(THEME_KEYS[theme])}
                variant="secondary"
                size="compact"
                selected={preference === theme}
                onPress={() => setPreference(theme)}
              />
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <Text variant="captionStrong" tone="muted">
          {t('profile.account')}
        </Text>
        <Button
          label={t('profile.logOut')}
          variant="secondary"
          loading={signingOut}
          onPress={logOut}
        />
      </Card>
    </Screen>
  );
}

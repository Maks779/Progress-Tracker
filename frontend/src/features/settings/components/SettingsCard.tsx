import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { LANGUAGE_NAMES } from '@/shared/i18n';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Card } from '@/shared/ui/Card';
import { Text } from '@/shared/ui/Text';

import { changePreference, PREFERENCE_CHOICES, usePreferences } from '../preferences';
import { ChoiceRow } from './ChoiceRow';

/**
 * Language, theme and units. A change applies at once; the line at the bottom says when it
 * is only on this device so far (offline) and will reach the account later.
 */
export function SettingsCard() {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const values = usePreferences((state) => state.values);
  const unsynced = usePreferences((state) => state.pending.length > 0);

  return (
    <Card style={{ gap: 0, paddingVertical: space[8] }}>
      <ChoiceRow
        label={t('profile.language')}
        value={values.language}
        options={PREFERENCE_CHOICES.language.map((value) => ({ value, label: LANGUAGE_NAMES[value] }))}
        onChange={(value) => changePreference('language', value)}
      />
      <ChoiceRow
        label={t('profile.theme')}
        value={values.theme}
        options={PREFERENCE_CHOICES.theme.map((value) => ({ value, label: t(`profile.themes.${value}`) }))}
        onChange={(value) => changePreference('theme', value)}
      />
      <ChoiceRow
        label={t('profile.weightUnit')}
        value={values.weight_unit}
        options={PREFERENCE_CHOICES.weight_unit.map((value) => ({ value, label: t(`profile.units.${value}`) }))}
        onChange={(value) => changePreference('weight_unit', value)}
      />
      <ChoiceRow
        label={t('profile.distanceUnit')}
        value={values.distance_unit}
        options={PREFERENCE_CHOICES.distance_unit.map((value) => ({ value, label: t(`profile.units.${value}`) }))}
        onChange={(value) => changePreference('distance_unit', value)}
      />
      <View
        style={{
          borderTopColor: colors.border.default,
          borderTopWidth: 1,
          marginTop: space[8],
          paddingTop: space[16],
          paddingBottom: space[8],
        }}
      >
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {unsynced ? t('profile.unsynced') : t('profile.syncNote')}
        </Text>
      </View>
    </Card>
  );
}

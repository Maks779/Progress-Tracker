import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { formatDate, parseIsoDate, toIsoDate } from '@/shared/format/dates';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { controlHeight } from '@/shared/theme/tokens';

import { Button } from './Button';
import { showFocusRing } from './focusRing';
import { CalendarDays } from './icons';
import { Sheet } from './Sheet';
import { Text } from './Text';

export type DateFieldProps = {
  label: string;
  value: string;
  minimum?: string;
  maximum?: string;
  doneLabel: string;
  error?: string;
  onChange: (value: string) => void;
};

/**
 * A date input: the field shows the date in the UI language. Android opens its own date dialog;
 * iOS shows the inline calendar in a sheet with a Done button. The web build uses the browser's
 * date input instead (DateField.web.tsx).
 */
export function DateField({ label, value, minimum, maximum, doneLabel, error, onChange }: DateFieldProps) {
  const { i18n } = useTranslation();
  const { colors, radius, scheme, space, typography } = useTheme();
  const [draft, setDraft] = useState<Date | null>(null);

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseIsoDate(value),
        mode: 'date',
        minimumDate: minimum ? parseIsoDate(minimum) : undefined,
        maximumDate: maximum ? parseIsoDate(maximum) : undefined,
        onChange: (event, picked) => {
          if (event.type === 'set' && picked) {
            onChange(toIsoDate(picked));
          }
        },
      });
      return;
    }
    setDraft(parseIsoDate(value));
  }

  function done() {
    if (draft) {
      onChange(toIsoDate(draft));
    }
    setDraft(null);
  }

  return (
    <View style={{ gap: space[8] }}>
      <Text variant="smallMedium">{label}</Text>
      <Pressable
        role="button"
        aria-label={`${label}: ${formatDate(value, i18n.language)}`}
        onPress={open}
        style={({ focused }: { pressed: boolean; focused?: boolean }): ViewStyle => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[8],
          minHeight: controlHeight.regular,
          paddingHorizontal: space[16],
          borderRadius: radius[12],
          borderWidth: 1,
          borderColor: error ? colors.state.error : colors.border.default,
          backgroundColor: colors.bg.surfaceRaised,
          outlineStyle: 'solid',
          outlineWidth: showFocusRing(focused) ? 2 : 0,
          outlineColor: colors.accent.fill,
        })}
      >
        <Text style={{ flex: 1, fontSize: typography.body.fontSize }}>{formatDate(value, i18n.language)}</Text>
        <CalendarDays color={colors.text.muted} size={20} strokeWidth={1.75} />
      </Pressable>
      {error ? (
        <Text variant="caption" tone="error">
          {error}
        </Text>
      ) : null}
      {draft ? (
        <Sheet visible title={label} onClose={() => setDraft(null)}>
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            minimumDate={minimum ? parseIsoDate(minimum) : undefined}
            maximumDate={maximum ? parseIsoDate(maximum) : undefined}
            themeVariant={scheme}
            accentColor={colors.accent.fill}
            locale={i18n.language}
            onChange={(_, picked) => picked && setDraft(picked)}
          />
          <Button label={doneLabel} onPress={done} />
        </Sheet>
      ) : null}
    </View>
  );
}

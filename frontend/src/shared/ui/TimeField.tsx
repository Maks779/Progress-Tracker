import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { dateToTime, formatTime, timeToDate } from '@/shared/format/time';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { controlHeight } from '@/shared/theme/tokens';

import { Button } from './Button';
import { showFocusRing } from './focusRing';
import { Clock } from './icons';
import { Sheet } from './Sheet';
import { Text } from './Text';

export type TimeFieldProps = {
  label: string;
  /** "HH:MM", 24-hour. */
  value: string;
  doneLabel: string;
  onChange: (value: string) => void;
};

/**
 * A time input, the twin of DateField: Android opens its own clock dialog, iOS shows the wheel
 * in a sheet with a Done button; the web build uses the browser's time input (TimeField.web.tsx).
 */
export function TimeField({ label, value, doneLabel, onChange }: TimeFieldProps) {
  const { i18n } = useTranslation();
  const { colors, radius, scheme, space, typography } = useTheme();
  const [draft, setDraft] = useState<Date | null>(null);

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: timeToDate(value),
        mode: 'time',
        onChange: (event, picked) => {
          if (event.type === 'set' && picked) {
            onChange(dateToTime(picked));
          }
        },
      });
      return;
    }
    setDraft(timeToDate(value));
  }

  function done() {
    if (draft) {
      onChange(dateToTime(draft));
    }
    setDraft(null);
  }

  return (
    <View style={{ gap: space[8] }}>
      <Text variant="smallMedium">{label}</Text>
      <Pressable
        role="button"
        aria-label={`${label}: ${formatTime(value, i18n.language)}`}
        onPress={open}
        style={({ focused }: { pressed: boolean; focused?: boolean }): ViewStyle => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[8],
          minHeight: controlHeight.regular,
          paddingHorizontal: space[16],
          borderRadius: radius[12],
          borderWidth: 1,
          borderColor: colors.border.default,
          backgroundColor: colors.bg.surfaceRaised,
          outlineStyle: 'solid',
          outlineWidth: showFocusRing(focused) ? 2 : 0,
          outlineColor: colors.accent.fill,
        })}
      >
        <Text style={{ flex: 1, fontSize: typography.body.fontSize }}>{formatTime(value, i18n.language)}</Text>
        <Clock color={colors.text.muted} size={20} strokeWidth={1.75} />
      </Pressable>
      {draft ? (
        <Sheet visible title={label} onClose={() => setDraft(null)}>
          <DateTimePicker
            value={draft}
            mode="time"
            display="spinner"
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

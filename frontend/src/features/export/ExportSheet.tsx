import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, View, type ViewStyle } from 'react-native';

import { errorMessageKey } from '@/features/auth/errors';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { TrackerOut } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Check, Download, FileJson, type LucideIcon } from '@/shared/ui/icons';
import { Notice } from '@/shared/ui/Notice';
import { Sheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { TextLink } from '@/shared/ui/TextLink';

import { type ExportFile, fetchCsvExport, fetchJsonExport } from './exportFiles';
import { saveFile, SharingUnavailableError } from './saveFile';
import { useOneAtATime } from './useOneAtATime';

type RowProps = {
  title: string;
  hint: string;
  icon?: LucideIcon;
  dot?: string;
  state: 'idle' | 'busy' | 'done';
  disabled: boolean;
  onPress: () => void;
};

function ExportRow({ title, hint, icon: Icon, dot, state, disabled, onPress }: RowProps) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={`${title}, ${hint}`}
      aria-busy={state === 'busy'}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[16],
        minHeight: 56,
        paddingHorizontal: space[16],
        borderRadius: radius[12],
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: hovered && !disabled ? colors.bg.surfaceRaised : colors.bg.surface,
        opacity: disabled && state !== 'busy' ? 0.5 : 1,
        cursor: disabled ? 'auto' : 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      {Icon ? <Icon color={colors.accent.text} size={20} strokeWidth={1.75} /> : null}
      {dot ? (
        <View style={{ width: 12, height: 12, marginHorizontal: 4, borderRadius: radius.full, backgroundColor: dot }} />
      ) : null}
      <View style={{ flex: 1, paddingVertical: space[8] }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      </View>
      {state === 'busy' ? <ActivityIndicator color={colors.accent.fill} /> : null}
      {state === 'done' ? <Check color={colors.state.success} size={20} strokeWidth={2} /> : null}
      {state === 'idle' ? <Download color={colors.text.muted} size={20} strokeWidth={1.75} /> : null}
    </Pressable>
  );
}

type Props = { onClose: () => void };

const EVERYTHING = 'everything';

/**
 * Export: everything as JSON, or one tracker as CSV for a spreadsheet. Phones hand the file to
 * the share sheet, the web downloads it. One export runs at a time, so a double tap cannot
 * start two; a finished download gets a check on the web. Rendered only while open.
 */
export function ExportSheet({ onClose }: Props) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const trackers = useListTrackers({ include_archived: true });
  const { busy, run: oneAtATime } = useOneAtATime();
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const list: TrackerOut[] = trackers.data?.status === 200 ? trackers.data.data.items : [];

  function run(key: string, load: () => Promise<ExportFile>) {
    void oneAtATime(key, async () => {
      setError(null);
      try {
        await saveFile(await load(), t('profile.export.title'));
        if (Platform.OS === 'web') {
          setDone((keys) => (keys.includes(key) ? keys : [...keys, key]));
        }
      } catch (failure) {
        setError(failure instanceof SharingUnavailableError ? 'profile.export.noSharing' : errorMessageKey(failure));
      }
    });
  }

  function state(key: string) {
    if (busy === key) {
      return 'busy' as const;
    }
    return done.includes(key) ? ('done' as const) : ('idle' as const);
  }

  return (
    <Sheet visible title={t('profile.export.title')} onClose={onClose}>
      <Text variant="small" tone="muted">
        {t('profile.export.body')}
      </Text>
      <ExportRow
        title={t('profile.export.everything')}
        hint={t('profile.export.everythingHint')}
        icon={FileJson}
        state={state(EVERYTHING)}
        disabled={busy !== null && busy !== EVERYTHING}
        onPress={() => run(EVERYTHING, fetchJsonExport)}
      />
      <Text variant="captionStrong" tone="muted" style={{ textTransform: 'uppercase', marginTop: space[8] }}>
        {t('profile.export.trackers')}
      </Text>
      {trackers.isPending ? (
        <View aria-label={t('profile.export.loading')} style={{ paddingVertical: space[16], alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent.fill} />
        </View>
      ) : null}
      {trackers.isError ? (
        <View>
          <Text variant="small" tone="muted">
            {t('profile.export.loadError')}
          </Text>
          <TextLink label={t('profile.retry')} onPress={() => trackers.refetch()} align="start" />
        </View>
      ) : null}
      {!trackers.isPending && !trackers.isError && list.length === 0 ? (
        <Text variant="small" tone="muted">
          {t('profile.export.empty')}
        </Text>
      ) : null}
      {list.map((tracker) => (
        <ExportRow
          key={tracker.id}
          title={tracker.name}
          hint={t('profile.export.csvHint')}
          dot={colors.tracker[tracker.color]}
          state={state(tracker.id)}
          disabled={busy !== null && busy !== tracker.id}
          onPress={() => run(tracker.id, () => fetchCsvExport(tracker.id))}
        />
      ))}
      {error ? <Notice tone="error" title={t(error)} /> : null}
    </Sheet>
  );
}

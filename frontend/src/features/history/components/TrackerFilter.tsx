import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { colorFor, TRACKER_ICONS, TYPE_DEFAULTS, type TrackerIcon } from '@/features/trackers/catalog';
import type { TrackerSummary } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Check, Layers } from '@/shared/ui/icons';
import { Segmented } from '@/shared/ui/Segmented';
import { Sheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';

import { filterGroups } from '../rules';

const ALL = 'all';
const MORE = 'more';

type Props = {
  trackers: TrackerSummary[];
  value: string | null;
  onChange: (trackerId: string | null) => void;
  onMore: () => void;
};

/**
 * The tracker filter above the month (design: All trackers · Gym · Reading · More). More opens
 * the full list; while one of those trackers is chosen, the segment carries its name.
 */
export function TrackerFilter({ trackers, value, onChange, onMore }: Props) {
  const { t } = useTranslation();
  const { shown, rest } = filterGroups(trackers);
  const chosenRest = rest.find((tracker) => tracker.id === value);
  const options = [
    { value: ALL, label: t('history.filter.all') },
    ...shown.map((tracker) => ({ value: tracker.id, label: tracker.name })),
    ...(rest.length > 0 ? [{ value: MORE, label: chosenRest?.name ?? t('history.filter.more') }] : []),
  ];
  const selected = value === null ? ALL : chosenRest ? MORE : value;
  return (
    <Segmented
      fit="content"
      label={t('history.filter.label')}
      options={options}
      value={selected}
      onChange={(next) => {
        if (next === MORE) {
          onMore();
        } else {
          onChange(next === ALL ? null : next);
        }
      }}
    />
  );
}

function Choice({ label, detail, icon, selected, onPress }: { label: string; detail?: string; icon: ReactNode; selected: boolean; onPress: () => void }) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      aria-label={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[16],
        minHeight: 56,
        paddingHorizontal: space[8],
        borderRadius: radius[12],
        backgroundColor: selected ? colors.accent.subtle : hovered ? colors.bg.surfaceRaised : 'transparent',
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      {icon}
      <View style={{ flex: 1, paddingVertical: space[8] }}>
        <Text variant="smallMedium" numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? <Check color={colors.accent.text} size={18} strokeWidth={2} /> : null}
    </Pressable>
  );
}

/** Every tracker to show sessions of, archived ones last; the filter icon and More open it. */
export function TrackerFilterSheet({ trackers, value, onChange, onClose }: Omit<Props, 'onMore'> & { onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { shown, rest } = filterGroups(trackers);
  const choose = (id: string | null) => {
    onChange(id);
    onClose();
  };
  return (
    <Sheet visible title={t('history.filter.title')} onClose={onClose}>
      <View role="radiogroup" aria-label={t('history.filter.title')}>
        <Choice
          label={t('history.filter.all')}
          icon={<Layers color={colors.text.primary} size={20} strokeWidth={1.75} />}
          selected={value === null}
          onPress={() => choose(null)}
        />
        {[...shown, ...rest].map((tracker) => {
          const Icon = TRACKER_ICONS[tracker.icon as TrackerIcon] ?? TRACKER_ICONS[TYPE_DEFAULTS[tracker.type].icon];
          return (
            <Choice
              key={tracker.id}
              label={tracker.name}
              detail={tracker.archived ? t('history.filter.archived') : undefined}
              icon={<Icon color={colorFor(colors, tracker.color)} size={20} strokeWidth={1.75} />}
              selected={tracker.id === value}
              onPress={() => choose(tracker.id)}
            />
          );
        })}
      </View>
    </Sheet>
  );
}

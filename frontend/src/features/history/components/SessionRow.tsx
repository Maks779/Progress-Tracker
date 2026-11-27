import { Pressable, View, type ViewStyle } from 'react-native';

import { useHomeText } from '@/features/home/format';
import { colorFor, TRACKER_ICONS, TYPE_DEFAULTS, type TrackerIcon } from '@/features/trackers/catalog';
import type { SessionListItem, TrackerSummary } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Text } from '@/shared/ui/Text';

type Props = {
  item: SessionListItem;
  tracker: TrackerSummary | undefined;
  today: string;
  onOpen: (id: string) => void;
};

/**
 * A session in a list (design: Session card): the tracker's icon tile, the name, "Yesterday ·
 * 48 min" and the session's main figure. It opens the session in History.
 */
export function SessionRow({ item, tracker, today, onOpen }: Props) {
  const { colors, radius, space } = useTheme();
  const text = useHomeText();
  const look = tracker ?? TYPE_DEFAULTS[item.tracker_type];
  const Icon = TRACKER_ICONS[look.icon as TrackerIcon] ?? TRACKER_ICONS.sparkles;
  const line = text.sessionLine(item, today);
  const figure = text.headline(item);
  return (
    <Pressable
      role="link"
      aria-label={`${item.name}, ${line}, ${figure}`}
      onPress={() => onOpen(item.id)}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[16],
        paddingVertical: space[8],
        marginHorizontal: -space[8],
        paddingHorizontal: space[8],
        borderRadius: radius[12],
        backgroundColor: hovered ? colors.bg.surface : 'transparent',
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius[12],
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg.surfaceRaised,
        }}
      >
        <Icon color={colorFor(colors, look.color)} size={20} strokeWidth={1.75} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="smallMedium" numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {line}
        </Text>
      </View>
      <Text variant="smallMedium" style={{ fontVariant: ['tabular-nums'] }}>
        {figure}
      </Text>
    </Pressable>
  );
}

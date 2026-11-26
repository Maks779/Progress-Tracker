import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { Card } from '@/shared/ui/Card';
import { showFocusRing } from '@/shared/ui/focusRing';
import { ChevronRight, type LucideIcon } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

type Link = { icon: LucideIcon; title: string; hint?: string; onPress: () => void };

/**
 * Rows that lead somewhere from Profile ("Export data"; "Goals & trackers" joins it later):
 * an icon, a title, an optional hint on wide screens and a chevron.
 */
export function LinksCard({ links }: { links: Link[] }) {
  const { colors, radius, space } = useTheme();
  return (
    <Card style={{ gap: 0, paddingVertical: space[8] }}>
      {links.map(({ icon: Icon, title, hint, onPress }) => (
        <Pressable
          key={title}
          role="button"
          aria-label={hint ? `${title}, ${hint}` : title}
          onPress={onPress}
          style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[16],
            minHeight: 56,
            marginHorizontal: -space[8],
            paddingHorizontal: space[8],
            borderRadius: radius[12],
            backgroundColor: hovered ? colors.bg.surfaceRaised : 'transparent',
            cursor: 'pointer',
            outlineStyle: 'solid',
            outlineWidth: showFocusRing(focused) ? 2 : 0,
            outlineColor: colors.accent.fill,
          })}
        >
          <Icon color={colors.text.primary} size={24} strokeWidth={1.5} />
          <View style={{ flex: 1 }}>
            <Text variant="body">{title}</Text>
            {hint ? (
              <Text variant="caption" tone="muted">
                {hint}
              </Text>
            ) : null}
          </View>
          <ChevronRight color={colors.text.muted} size={20} strokeWidth={1.75} />
        </Pressable>
      ))}
    </Card>
  );
}

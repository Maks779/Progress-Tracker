import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { showFocusRing } from './focusRing';
import type { LucideIcon } from './icons';
import { Sheet } from './Sheet';
import { Text } from './Text';

export type MenuItem = { label: string; icon: LucideIcon; onPress: () => void; destructive?: boolean; hint?: string };

type Props = { title: string; items: MenuItem[]; onClose: () => void; children?: React.ReactNode };

/**
 * The actions behind a "⋯" button, in a sheet on phones and a dialog on desktop: one 56 px row
 * per action with its icon. A destructive action shows its icon in the error color.
 */
export function MenuSheet({ title, items, onClose, children }: Props) {
  const { colors, radius, space } = useTheme();
  return (
    <Sheet visible title={title} onClose={onClose}>
      {children}
      <View>
        {items.map((item) => (
          <Pressable
            key={item.label}
            role="button"
            aria-label={item.label}
            accessibilityHint={item.hint}
            onPress={item.onPress}
            style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[16],
              minHeight: 56,
              paddingHorizontal: space[8],
              borderRadius: radius[12],
              backgroundColor: hovered ? colors.bg.surfaceRaised : 'transparent',
              cursor: 'pointer',
              outlineStyle: 'solid',
              outlineWidth: showFocusRing(focused) ? 2 : 0,
              outlineColor: colors.accent.fill,
            })}
          >
            <item.icon color={item.destructive ? colors.state.error : colors.text.primary} size={20} strokeWidth={1.75} />
            <View style={{ flex: 1 }}>
              <Text variant="body">{item.label}</Text>
              {item.hint ? (
                <Text variant="caption" tone="muted">
                  {item.hint}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

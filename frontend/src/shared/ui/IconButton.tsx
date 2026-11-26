import { Pressable, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { showFocusRing } from './focusRing';
import type { LucideIcon } from './icons';

type Props = { icon: LucideIcon; label: string; onPress: () => void };

/** A 44 px button with only an icon (the "+" beside a page title); the label is for screen readers. */
export function IconButton({ icon: Icon, label, onPress }: Props) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius[12],
        backgroundColor: hovered ? colors.bg.surfaceRaised : 'transparent',
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <Icon color={colors.text.primary} size={24} strokeWidth={1.75} />
    </Pressable>
  );
}

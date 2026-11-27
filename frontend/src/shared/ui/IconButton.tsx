import { Pressable, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { showFocusRing } from './focusRing';
import type { LucideIcon } from './icons';

type Props = { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean };

/**
 * A 44 px button with only an icon (the "+" beside a page title); the label is for screen
 * readers. A disabled one is dimmed and does nothing (the calendar's arrow past this month).
 */
export function IconButton({ icon: Icon, label, onPress, disabled = false }: Props) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius[12],
        backgroundColor: hovered && !disabled ? colors.bg.surfaceRaised : 'transparent',
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'auto' : 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <Icon color={colors.text.primary} size={24} strokeWidth={1.75} />
    </Pressable>
  );
}

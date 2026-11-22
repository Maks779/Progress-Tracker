import { Text as NativeText, type TextProps } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import type { TypographyVariant } from '@/shared/theme/tokens';

type Tone = 'primary' | 'muted' | 'accent' | 'onAccent' | 'error' | 'success';

type Props = TextProps & { variant?: TypographyVariant; tone?: Tone };

export function Text({ variant = 'body', tone = 'primary', style, ...rest }: Props) {
  const { colors, typography } = useTheme();
  const color = {
    primary: colors.text.primary,
    muted: colors.text.muted,
    accent: colors.accent.text,
    onAccent: colors.accent.onFill,
    error: colors.state.error,
    success: colors.state.success,
  }[tone];
  return <NativeText style={[typography[variant], { color }, style]} {...rest} />;
}

import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { Flame, type LucideIcon, TrendingUp } from '@/shared/ui/icons';
import { entrance } from '@/shared/ui/motion';
import { Text } from '@/shared/ui/Text';

import { WeeklyGoalExample } from './WeeklyGoalExample';

/** A product promise next to the ring: an icon in an accent circle and a short title. */
function Highlight({ icon: Icon, title, step }: { icon: LucideIcon; title: string; step: number }) {
  const { colors, radius, space } = useTheme();
  return (
    <Animated.View
      entering={entrance(step)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
        gap: space[16],
        paddingVertical: 12,
        paddingLeft: 12,
        paddingRight: space[24],
        borderRadius: radius[16],
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.bg.surface,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accent.subtle,
        }}
      >
        <Icon color={colors.accent.fill} size={20} strokeWidth={2} />
      </View>
      <Text variant="smallStrong" style={{ flexShrink: 1 }}>
        {title}
      </Text>
    </Animated.View>
  );
}

/** The left half of the desktop welcome and auth screens. */
export function HeroPanel() {
  const { t } = useTranslation();
  const { scheme, space } = useTheme();
  return (
    <View style={{ flex: 1, maxWidth: 520, gap: space[48] }}>
      <Animated.View entering={entrance(0)} style={{ gap: space[40], maxWidth: 400 }}>
        <Text variant="captionStrong" tone={scheme === 'light' ? 'primary' : 'accent'} style={{ textTransform: 'uppercase' }}>
          {t('auth.hero.eyebrow')}
        </Text>
        <Text variant="display" style={{ maxWidth: 360 }}>
          {t('auth.hero.title')}
        </Text>
        <Text variant="body" tone="muted">
          {t('auth.hero.body')}
        </Text>
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[40] }}>
        <Animated.View entering={entrance(1)}>
          <WeeklyGoalExample size={224} />
        </Animated.View>
        <View style={{ flexShrink: 1, gap: space[16] }}>
          <Highlight icon={Flame} title={t('auth.hero.restDay')} step={4} />
          <Highlight icon={TrendingUp} title={t('auth.hero.better')} step={5} />
        </View>
      </View>
      <Animated.View entering={entrance(6)}>
        <Text variant="caption" tone="muted" style={{ textTransform: 'uppercase' }}>
          {t('auth.hero.footer')}
        </Text>
      </Animated.View>
    </View>
  );
}

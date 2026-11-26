import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { Card } from '@/shared/ui/Card';
import { showFocusRing } from '@/shared/ui/focusRing';
import { ChevronRight } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import { colorFor, TRACKER_ICONS, type TrackerIcon, type TrackerType } from '../catalog';

type GlyphProps = { icon: string; color: string; size?: number; muted?: boolean };

/** A tracker's icon in its color (muted for archived trackers). */
export function TrackerGlyph({ icon, color, size = 24, muted = false }: GlyphProps) {
  const { colors } = useTheme();
  const Icon = TRACKER_ICONS[icon as TrackerIcon] ?? TRACKER_ICONS.sparkles;
  return <Icon color={muted ? colors.text.muted : colorFor(colors, color)} size={size} strokeWidth={1.75} />;
}

type RowProps = {
  icon: string;
  color: string;
  name: string;
  detail: string;
  muted?: boolean;
  onPress: () => void;
};

/** One tracker in a list: icon, name, a line about it and a chevron to its page. */
export function TrackerRow({ icon, color, name, detail, muted = false, onPress }: RowProps) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      role="link"
      aria-label={`${name}, ${detail}`}
      onPress={onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[16],
        minHeight: 64,
        marginHorizontal: -space[8],
        paddingHorizontal: space[8],
        paddingVertical: space[8],
        borderRadius: radius[12],
        backgroundColor: hovered ? colors.bg.surfaceRaised : 'transparent',
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <TrackerGlyph icon={icon} color={color} muted={muted} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" tone={muted ? 'muted' : 'primary'}>
          {name}
        </Text>
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
      </View>
      <ChevronRight color={colors.text.muted} size={20} strokeWidth={1.75} />
    </Pressable>
  );
}

type FeatureProps = { eyebrow: string; icon?: string; color?: string; name?: string; body: string; children?: ReactNode };

/** A side card with a small uppercase label, an optional tracker, a line under it and an optional action. */
export function FeatureCard({ eyebrow, icon, color, name, body, children }: FeatureProps) {
  const { space } = useTheme();
  return (
    <Card style={{ gap: space[16], padding: space[24] }}>
      <Text variant="caption" tone="muted" style={{ textTransform: 'uppercase' }}>
        {eyebrow}
      </Text>
      {icon && color && name ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[16] }}>
          <TrackerGlyph icon={icon} color={color} size={32} />
          <Text variant="h2" style={{ flexShrink: 1 }}>
            {name}
          </Text>
        </View>
      ) : null}
      <Text variant="small" tone="muted">
        {body}
      </Text>
      {children}
    </Card>
  );
}

type PreviewProps = { type: TrackerType; name: string; icon: string; color: string };

/** "Live preview" while a tracker is being made: how it will look in the lists. */
export function PreviewCard({ type, name, icon, color }: PreviewProps) {
  const { t } = useTranslation();
  return (
    <FeatureCard
      eyebrow={t('trackers.new.preview')}
      icon={icon}
      color={color}
      name={name.trim() || t(`trackers.names.${type}`)}
      body={t('trackers.new.previewLine', { type: t(`trackers.types.${type}`) })}
    />
  );
}

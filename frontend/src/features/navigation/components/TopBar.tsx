import { router, usePathname } from 'expo-router';
import type { BottomTabHeaderProps } from 'expo-router/js-tabs';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import { CONTENT_MAX_WIDTH, useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { fonts } from '@/shared/theme/tokens';
import { showFocusRing } from '@/shared/ui/focusRing';
import { UserRound } from '@/shared/ui/icons';
import { Logo } from '@/shared/ui/Logo';
import { OfflineBadge } from '@/shared/ui/OfflineBadge';
import { Text } from '@/shared/ui/Text';
import { currentProps, followLink, linkProps } from '@/shared/ui/webLink';

import { openProfilePage } from '../openProfilePage';
import { type CrumbHref, shortName, trailFor } from '../trail';

const PADDING = 40;

function CrumbLink({ href, label }: { href: CrumbHref; label: string }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      role="link"
      {...linkProps(href)}
      onPress={(event) => followLink(event, () => router.dismissTo(href))}
      style={({ focused }: { pressed: boolean; focused?: boolean }): ViewStyle => ({
        flexShrink: 0,
        minHeight: 32,
        justifyContent: 'center',
        borderRadius: radius[8],
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <Text
          variant="small"
          tone={hovered ? 'primary' : 'muted'}
          style={{ textDecorationLine: hovered ? 'underline' : 'none' }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Where the page on screen sits ("Profile / Trackers / Gym"): every step but the last leads
 * back to that page. A tracker's page shows its name once the tracker list is loaded (the
 * same list the page itself uses, so no extra request).
 */
function Breadcrumb() {
  const { t } = useTranslation();
  const trail = trailFor(usePathname());
  const trackerId = trail.find((crumb) => crumb.trackerId)?.trackerId;
  const trackers = useListTrackers({ include_archived: true }, { query: { enabled: Boolean(trackerId) } });
  const items = trackers.data?.status === 200 ? trackers.data.data.items : [];
  const trackerName = items.find((tracker) => tracker.id === trackerId)?.name;

  return (
    <View
      role="navigation"
      aria-label={t('nav.breadcrumb')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}
    >
      {trail.map((crumb, index) => {
        const label = crumb.trackerId && trackerName ? trackerName : t(crumb.label);
        return (
          <Fragment key={crumb.label}>
            {index > 0 ? (
              <Text variant="small" tone="muted" aria-hidden>
                /
              </Text>
            ) : null}
            {crumb.href ? (
              <CrumbLink href={crumb.href} label={label} />
            ) : (
              <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }} {...currentProps(true)}>
                {label}
              </Text>
            )}
          </Fragment>
        );
      })}
    </View>
  );
}

function AccountChip({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const me = useReadMe();
  const name = me.data?.status === 200 ? shortName(me.data.data.name) : t('tabs.profile');
  return (
    <Pressable
      role="link"
      aria-label={t('nav.account', { name })}
      {...linkProps('/profile')}
      onPress={(event) => followLink(event, onPress)}
      hitSlop={6}
      style={({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 32,
        maxWidth: 220,
        paddingHorizontal: 10,
        borderRadius: radius[8],
        backgroundColor: hovered ? colors.border.default : colors.bg.surfaceRaised,
        opacity: pressed ? 0.8 : 1,
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <UserRound color={colors.accent.text} size={16} strokeWidth={1.75} />
      <Text variant="caption" numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.medium }}>
        {name}
      </Text>
    </Pressable>
  );
}

/**
 * The bar above every page on tablets and desktop, as in the design: on desktop the
 * breadcrumb (the sidebar carries the logo), on tablets the logo; the account chip on the
 * right opens Profile, with the offline badge before it. Its content lines up with the page
 * column below.
 */
export function TopBar({ navigation }: Pick<BottomTabHeaderProps, 'navigation'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const expanded = useBreakpoint() === 'expanded';
  const openProfile = () => openProfilePage('/profile', pathname, () => navigation.navigate('profile'));

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.bg.base,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          height: 79,
          width: '100%',
          maxWidth: CONTENT_MAX_WIDTH + 2 * PADDING,
          alignSelf: 'center',
          paddingHorizontal: PADDING,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>{expanded ? <Breadcrumb /> : <Logo />}</View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <OfflineBadge style={{ marginRight: 12 }} />
          <AccountChip onPress={openProfile} />
        </View>
      </View>
    </View>
  );
}

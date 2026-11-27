import { usePathname } from 'expo-router';
import type { BottomTabBarProps, BottomTabViewRoute } from 'expo-router/js-tabs';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';

import { WorkoutButton } from '@/features/workout/components/WorkoutButton';
import { useWorkoutEntry } from '@/features/workout/start';
import { useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { SIDEBAR_WIDTH } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { fonts } from '@/shared/theme/tokens';
import { showFocusRing } from '@/shared/ui/focusRing';
import {
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleUserRound,
  House,
  Layers,
  type LucideIcon,
  Target,
  UserRound,
} from '@/shared/ui/icons';
import { Logo } from '@/shared/ui/Logo';
import { Text } from '@/shared/ui/Text';
import { currentProps, followLink, linkProps } from '@/shared/ui/webLink';

import { openProfilePage } from '../openProfilePage';
import type { ProfilePage } from '../trail';

const SECTIONS: { name: string; label: string; icon: LucideIcon; href: string }[] = [
  { name: '(home)', label: 'tabs.home', icon: House, href: '/' },
  { name: 'history', label: 'tabs.history', icon: CalendarDays, href: '/history' },
  { name: 'progress', label: 'tabs.progress', icon: ChartNoAxesCombined, href: '/progress' },
  { name: 'profile', label: 'tabs.profile', icon: UserRound, href: '/profile' },
];

const SHORTCUTS: { page: ProfilePage; label: string; icon: LucideIcon }[] = [
  { page: '/profile/goals', label: 'goals.label', icon: Target },
  { page: '/profile/trackers', label: 'trackers.label', icon: Layers },
];

type LinkProps = {
  href: string;
  onPress: () => void;
  current?: boolean;
  bleed?: boolean;
  label?: string;
  children: (hovered: boolean) => ReactNode;
};

function SidebarLink({ href, onPress, current = false, bleed = false, label, children }: LinkProps) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      role="link"
      aria-label={label}
      {...linkProps(href)}
      {...currentProps(current)}
      onPress={(event) => followLink(event, onPress)}
      style={({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
        marginHorizontal: bleed ? -12 : 0,
        gap: bleed ? space[16] : 12,
        borderRadius: radius[12],
        backgroundColor: current ? colors.accent.subtle : hovered ? colors.bg.surfaceRaised : 'transparent',
        opacity: pressed ? 0.8 : 1,
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => children(Boolean(hovered))}
    </Pressable>
  );
}

function Account({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const me = useReadMe();
  const account = me.data?.status === 200 ? me.data.data : undefined;
  const name = account?.name ?? t('tabs.profile');
  return (
    <SidebarLink href="/profile" onPress={onPress} bleed label={t('nav.account', { name })}>
      {() => (
        <>
          <CircleUserRound color={colors.text.muted} size={24} strokeWidth={1.75} />
          <View style={{ flex: 1, paddingVertical: 8 }}>
            <Text variant="smallMedium" numberOfLines={2}>
              {name}
            </Text>
            {account ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {account.email}
              </Text>
            ) : null}
          </View>
          <ChevronRight color={colors.text.muted} size={16} strokeWidth={1.75} />
        </>
      )}
    </SidebarLink>
  );
}

/**
 * The desktop navigation from the design, in place of the tab bar: the logo, the four sections
 * (the same as the phone tabs, so the section of the page on screen is highlighted, and a
 * second press goes back to its first page), Start workout (Resume workout while one is under
 * way), Goals and Trackers as shortcuts into Profile, and the account at the bottom. It scrolls when the window is too low for all of it.
 */
export function Sidebar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { colors, scheme, space } = useTheme();
  const pathname = usePathname();
  const focusedKey = state.routes[state.index]?.key;

  const pressSection = (route: BottomTabViewRoute) => {
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (route.key !== focusedKey && !event.defaultPrevented) {
      navigateToTab(route.key);
    }
  };
  const entry = useWorkoutEntry(() => {
    const home = state.routes.find((route) => route.name === '(home)');
    if (home) {
      navigateToTab(home.key);
    }
  });
  const open = (page: ProfilePage) =>
    openProfilePage(page, pathname, () => {
      const profile = state.routes.find((route) => route.name === 'profile');
      if (profile) {
        navigateToTab(profile.key);
      }
    });

  return (
    <View
      role="navigation"
      aria-label={t('nav.main')}
      style={{
        width: SIDEBAR_WIDTH + insets.left,
        paddingLeft: insets.left,
        backgroundColor: colors.bg.surface,
        borderRightWidth: 1,
        borderRightColor: colors.border.default,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: space[24],
          paddingTop: insets.top + space[24],
          paddingBottom: insets.bottom + space[24],
        }}
      >
        <Logo />
        <View style={{ marginTop: space[32], gap: space[8] }}>
          {SECTIONS.map(({ name, label, icon: Icon, href }) => {
            const route = state.routes.find((item) => item.name === name);
            if (!route) {
              return null;
            }
            const current = route.key === focusedKey;
            return (
              <SidebarLink key={name} href={href} current={current} onPress={() => pressSection(route)}>
                {(hovered) => {
                  const tone = current ? colors.accent.text : hovered ? colors.text.primary : colors.text.muted;
                  return (
                    <>
                      <Icon color={tone} size={20} strokeWidth={1.75} />
                      <Text
                        variant="small"
                        numberOfLines={1}
                        style={{ flex: 1, fontFamily: fonts.medium, color: current && scheme === 'light' ? colors.text.primary : tone }}
                      >
                        {t(label)}
                      </Text>
                    </>
                  );
                }}
              </SidebarLink>
            );
          })}
        </View>
        {entry.available ? (
          <View style={{ marginTop: space[32] }}>
            <WorkoutButton entry={entry} />
          </View>
        ) : null}
        <View style={{ marginTop: space[32], gap: space[8] }}>
          {SHORTCUTS.map(({ page, label, icon: Icon }) => (
            <SidebarLink key={page} href={page} bleed onPress={() => open(page)}>
              {() => (
                <>
                  <Icon color={colors.text.muted} size={24} strokeWidth={1.75} />
                  <Text variant="small" numberOfLines={1} style={{ flex: 1, fontFamily: fonts.medium }}>
                    {t(label)}
                  </Text>
                  <ChevronRight color={colors.text.muted} size={16} strokeWidth={1.75} />
                </>
              )}
            </SidebarLink>
          ))}
        </View>
        <View style={{ flex: 1, minHeight: space[32] }} />
        <Account onPress={() => open('/profile')} />
      </ScrollView>
    </View>
  );
}

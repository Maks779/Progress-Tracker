import { BottomTabBar, Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { type ColorValue, View } from 'react-native';

import { Sidebar } from '@/features/navigation/components/Sidebar';
import { TopBar } from '@/features/navigation/components/TopBar';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { fonts } from '@/shared/theme/tokens';
import {
  CalendarDays,
  ChartNoAxesCombined,
  House,
  type LucideIcon,
  Plus,
  UserRound,
} from '@/shared/ui/icons';

const ICON_STROKE = 1.75;

function tabIcon(Icon: LucideIcon) {
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon color={String(color)} size={24} strokeWidth={ICON_STROKE} />;
  }
  return TabIcon;
}

/**
 * The signed-in app. Phones get the bottom tab bar; tablets add the top bar (logo and account);
 * desktop replaces the tab bar with the sidebar and shows the top bar with the breadcrumb.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const breakpoint = useBreakpoint();
  const expanded = breakpoint === 'expanded';

  return (
    <Tabs
      tabBar={(props) => (expanded ? <Sidebar {...props} /> : <BottomTabBar {...props} />)}
      screenOptions={{
        headerShown: breakpoint !== 'compact',
        header: ({ navigation }) => <TopBar navigation={navigation} />,
        tabBarPosition: expanded ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: colors.bg.base },
        tabBarActiveTintColor: colors.accent.text,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.bg.surface,
          borderTopColor: colors.border.default,
          height: 80,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: tabIcon(House) }} />
      <Tabs.Screen
        name="history"
        options={{ title: t('tabs.history'), tabBarIcon: tabIcon(CalendarDays) }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: t('tabs.log'),
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: t('tabs.log'),
          tabBarIcon: () => (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius[12],
                backgroundColor: colors.accent.fill,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus color={colors.accent.onFill} size={24} strokeWidth={2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: t('tabs.progress'), tabBarIcon: tabIcon(ChartNoAxesCombined) }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon(UserRound) }}
      />
    </Tabs>
  );
}

import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { layout, spacing, typography } from '@/theme';
import { useAppTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

/** Filled terracotta icon for the active tab, muted outline for the others. */
function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return (
      <AppIcon
        name={focused ? active : inactive}
        size="md"
        color={focused ? 'primary' : 'muted'}
      />
    );
  };
}

export default function TabsLayout() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: typography.tabLabel,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.outline,
          borderTopWidth: layout.hairline,
          height: layout.tabBarHeight + insets.bottom,
          paddingTop: spacing.sm,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: tabIcon('home-variant', 'home-variant-outline'),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.explore'),
          tabBarIcon: tabIcon('compass', 'compass-outline'),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('tabs.map'),
          tabBarIcon: tabIcon('map-marker-radius', 'map-marker-radius-outline'),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('tabs.progress'),
          tabBarIcon: tabIcon('medal', 'medal-outline'),
        }}
      />
    </Tabs>
  );
}

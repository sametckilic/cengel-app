import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorialIcon, type EditorialIconName } from '@/components/cengel/editorial-icon';
import { fonts, palette, typography } from '@/constants/design';

const tabs: { icon: EditorialIconName; label: string; routeName?: string }[] = [
  { icon: 'today', label: 'Bugün', routeName: 'index' },
  { icon: 'auto-stories', label: 'Arşiv', routeName: 'archive' },
  { icon: 'person', label: 'Profil', routeName: 'profile' },
];

function EditorialTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (width >= 768) {
    return null;
  }

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.tabBarInner}>
        {tabs.map((item) => {
          const routeIndex = state.routes.findIndex((route) => route.name === item.routeName);
          const route = routeIndex >= 0 ? state.routes[routeIndex] : undefined;
          const focused = routeIndex === state.index;

          if (!route) {
            return (
              <View
                key={item.label}
                accessibilityState={{ disabled: true }}
                style={[styles.tabItem, styles.tabItemInactive]}>
                <EditorialIcon color={palette.mutedInk} name={item.icon} />
                <Text style={[styles.tabLabel, styles.tabLabelInactive]}>{item.label}</Text>
              </View>
            );
          }

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={item.label}
              onPress={() => {
                const event = navigation.emit({
                  canPreventDefault: true,
                  target: route.key,
                  type: 'tabPress',
                });

                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={({ pressed }) => [
                styles.tabItem,
                focused && styles.tabItemActive,
                !focused && styles.tabItemInactive,
                pressed && styles.tabItemPressed,
              ]}>
              <EditorialIcon color={focused ? palette.primary : palette.mutedInk} name={item.icon} />
              <Text style={[styles.tabLabel, !focused && styles.tabLabelInactive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <EditorialTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.paper },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bugün',
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: 'Arşiv',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: palette.paper,
    borderTopColor: palette.gridLine,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
  },
  tabBarInner: {
    alignSelf: 'center',
    flexDirection: 'row',
    maxWidth: 576,
    width: '100%',
  },
  tabItem: {
    alignItems: 'center',
    borderTopColor: 'transparent',
    borderTopWidth: 2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 53,
    paddingTop: 8,
  },
  tabItemActive: {
    borderTopColor: palette.primary,
  },
  tabItemInactive: {
    opacity: 0.6,
  },
  tabItemPressed: {
    transform: [{ scale: 0.95 }],
  },
  tabLabel: {
    ...typography.caption,
    color: palette.primary,
    fontFamily: fonts.interBold,
    letterSpacing: 1.2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  tabLabelInactive: {
    color: palette.mutedInk,
    fontFamily: fonts.interMedium,
  },
});

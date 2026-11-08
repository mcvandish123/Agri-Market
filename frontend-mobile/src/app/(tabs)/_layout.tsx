import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { colors, radius } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Tab icon inside a soft green pill when active, as in the prototype. */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: 18,
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: focused ? colors.greenSoft : 'transparent',
      }}
    >
      <Ionicons name={name} size={20} color={focused ? colors.greenDark : colors.textMuted} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.greenDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="forecast"
        options={{
          title: 'Forecast',
          tabBarIcon: ({ focused }) => <TabIcon name="trending-up" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="method"
        options={{
          title: 'Method',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'information-circle' : 'information-circle-outline'} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

import { Text, View } from "react-native";
import { Tabs } from "expo-router";
import { Home, Plus, User } from "lucide-react-native";

import { wearbloomTheme } from "@acme/ui";

function AddTabIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: focused
          ? wearbloomTheme.colors.accent
          : wearbloomTheme.colors["text-tertiary"],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Plus color={wearbloomTheme.colors.background} size={18} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: wearbloomTheme.colors["text-primary"],
        tabBarInactiveTintColor: wearbloomTheme.colors["text-tertiary"],
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: wearbloomTheme.colors.background,
          borderTopColor: wearbloomTheme.colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Wardrobe",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          tabBarLabel: ({ focused }) =>
            focused ? (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: wearbloomTheme.colors["text-primary"],
                }}
              >
                Wardrobe
              </Text>
            ) : null,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarIcon: ({ focused }) => <AddTabIcon focused={focused} />,
          tabBarLabel: ({ focused }) =>
            focused ? (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: wearbloomTheme.colors["text-primary"],
                }}
              >
                Add
              </Text>
            ) : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          tabBarLabel: ({ focused }) =>
            focused ? (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: wearbloomTheme.colors["text-primary"],
                }}
              >
                Profile
              </Text>
            ) : null,
        }}
      />
    </Tabs>
  );
}

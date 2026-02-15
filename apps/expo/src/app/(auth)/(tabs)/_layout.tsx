import React from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { Home, Plus, User } from "lucide-react-native";

function AddTabIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: focused ? "#1A1A1A" : "#A3A3A3",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Plus color="#FFFFFF" size={18} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1A1A1A",
        tabBarInactiveTintColor: "#A3A3A3",
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#EBEBEB",
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
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarIcon: ({ focused }) => <AddTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

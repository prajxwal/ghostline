import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { theme } from '../../styles/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accentGlow,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bgPrimary }]} />
        ),
        tabBarShowLabel: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Text style={[styles.tabBarText, { color }]}>
              {focused ? '[ HOME ]' : '  HOME  '}
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <Text style={[styles.tabBarText, { color }]}>
              {focused ? '[ SYS_CFG ]' : '  SYS_CFG  '}
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 84 : 64, // Accommodate safe area nicely by default
    backgroundColor: theme.colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.accent, // Neon solid line on top
    justifyContent: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0, 
  },
  tabBarText: {
    fontFamily: theme.typography.fontFamilyMono,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
  }
});

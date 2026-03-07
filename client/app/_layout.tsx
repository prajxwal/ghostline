import { Stack } from 'expo-router';
import { theme } from '../styles/theme';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.bgSecondary,
          },
          headerTintColor: theme.colors.textPrimary,
          contentStyle: {
            backgroundColor: theme.colors.bgPrimary,
          },
        }}>
        <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="chat"
          options={{ title: 'Room', headerBackTitle: 'Leave' }}
        />
      </Stack>
    </>
  );
}

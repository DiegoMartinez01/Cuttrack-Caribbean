import { Stack } from 'expo-router';
import { useGameStyles } from '../hooks/useGameStyles';

export default function AuthLayout() {
  const { colors, typography } = useGameStyles();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          color: colors.text,
          fontSize: typography.size.lg,
          fontWeight: typography.weight.bold,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen 
        name="login" 
        options={{ 
          headerShown: false,
          title: 'Acceso'
        }} 
      />
    </Stack>
  );
}
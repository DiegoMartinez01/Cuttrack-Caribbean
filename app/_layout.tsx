import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LoadingScreen } from './styles/components/ui/LoadingScreen';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => {
    // 🔥 Cuando las fuentes estén cargadas, esperar 1.5 segundos para mostrar la pantalla de carga
    if (fontsLoaded) {
      const timer = setTimeout(() => {
        setShowLoading(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  // 🔥 Si las fuentes no están cargadas, mostrar pantalla de carga con la oruga
  if (!fontsLoaded || showLoading) {
    return <LoadingScreen />;
  }

  // 🔥 Cuando todo esté listo, mostrar la app
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="client" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen name="(barbero)" options={{ headerShown: false }} />
      <Stack.Screen name="(cliente)" options={{ headerShown: false }} />
      <Stack.Screen name="register-client" options={{ headerShown: false }} />
      <Stack.Screen name="register-owner" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}
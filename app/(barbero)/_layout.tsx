import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';
import { useGameStyles } from '../hooks/useGameStyles';

// Componente para el header personalizado con logo D47
function CustomHeader({ subtitle }: { subtitle: string }) {
  const { colors } = useGameStyles();
  
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Text style={{ color: colors.background, fontSize: 12, fontWeight: 'bold' }}>D47</Text>
        </View>
        <Text style={{ color: colors.gold, fontSize: 14, letterSpacing: 1, fontWeight: 'bold' }}>
          CUTTRACK
        </Text>
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 9, marginTop: 2 }}>{subtitle}</Text>
    </View>
  );
}

export default function BarberLayout() {
  const { colors, typography } = useGameStyles();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.card,
          borderTopWidth: 1,
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: typography.size.xs,
          fontWeight: typography.weight.medium,
          letterSpacing: 0.5,
        },
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: colors.text,
          fontSize: typography.size.lg,
          fontWeight: typography.weight.bold,
          letterSpacing: 1,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'AGENDA',
          tabBarIcon: ({ color, focused }) => (
            <MotiView
              animate={{ scale: focused ? 1.1 : 1 }}
              transition={{ type: 'timing', duration: 200 }}
            >
              <Feather name="calendar" size={24} color={color} opacity={focused ? 1 : 0.7} />
            </MotiView>
          ),
          headerTitle: () => <CustomHeader subtitle="MI AGENDA" />,
        }}
      />
      
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'CLIENTES',
          tabBarIcon: ({ color, focused }) => (
            <MotiView
              animate={{ scale: focused ? 1.1 : 1 }}
              transition={{ type: 'timing', duration: 200 }}
            >
              <Feather name="users" size={24} color={color} opacity={focused ? 1 : 0.7} />
            </MotiView>
          ),
          headerTitle: () => <CustomHeader subtitle="MIS CLIENTES" />,
        }}
      />
      
      <Tabs.Screen
        name="resenas"
        options={{
          title: 'RESEÑAS',
          tabBarIcon: ({ color, focused }) => (
            <MotiView
              animate={{ scale: focused ? 1.1 : 1 }}
              transition={{ type: 'timing', duration: 200 }}
            >
              <Feather name="star" size={24} color={color} opacity={focused ? 1 : 0.7} />
            </MotiView>
          ),
          headerTitle: () => <CustomHeader subtitle="MIS RESEÑAS" />,
        }}
      />
      
      <Tabs.Screen
        name="ganancias"
        options={{
          title: 'BONOS',
          tabBarIcon: ({ color, focused }) => (
            <MotiView
              animate={{ scale: focused ? 1.1 : 1 }}
              transition={{ type: 'timing', duration: 200 }}
            >
              <Feather name="dollar-sign" size={24} color={color} opacity={focused ? 1 : 0.7} />
            </MotiView>
          ),
          headerTitle: () => <CustomHeader subtitle="MIS GANANCIAS" />,
        }}
      />
      
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'PERFIL',
          tabBarIcon: ({ color, focused }) => (
            <MotiView
              animate={{ scale: focused ? 1.1 : 1 }}
              transition={{ type: 'timing', duration: 200 }}
            >
              <Feather name="user" size={24} color={color} opacity={focused ? 1 : 0.7} />
            </MotiView>
          ),
          headerTitle: () => <CustomHeader subtitle="MI PERFIL" />,
        }}
      />
    </Tabs>
  );
}
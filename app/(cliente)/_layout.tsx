import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';
import { useGameStyles } from '../hooks/useGameStyles';

// 🔥 Componente para el header personalizado con logo D47 (igual que admin)
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
          <Text style={{
            color: colors.background,
            fontSize: 12,
            fontWeight: 'bold',
          }}>D47</Text>
        </View>
        <Text style={{ color: colors.gold, fontSize: 14, letterSpacing: 1, fontWeight: 'bold' }}>
          CUTTRACK
        </Text>
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 9, marginTop: 2 }}>{subtitle}</Text>
    </View>
  );
}

export default function ClientLayout() {
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
      {/* 🔥 Pantalla principal - AGENDAR (ícono dinámico) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'AGENDAR',
          tabBarIcon: ({ color, focused }) => (
            <MotiView
              animate={{ scale: focused ? 1.1 : 1 }}
              transition={{ type: 'timing', duration: 200 }}
            >
              <Feather name="calendar" size={24} color={color} opacity={focused ? 1 : 0.7} />
            </MotiView>
          ),
          headerTitle: () => <CustomHeader subtitle="AGENDA TU CITA" />,
        }}
      />
      
      {/* Pantallas ocultas del flujo de agendamiento */}
      <Tabs.Screen
        name="seleccionar-servicio"
        options={{
          href: null,
          headerTitle: () => <CustomHeader subtitle="SELECCIONAR SERVICIO" />,
        }}
      />
      
      <Tabs.Screen
        name="seleccionar-horario"
        options={{
          href: null,
          headerTitle: () => <CustomHeader subtitle="SELECCIONAR HORARIO" />,
        }}
      />
      
      {/* Pantalla de calificar */}
      <Tabs.Screen
        name="calificar/[id]"
        options={{
          href: null,
          headerTitle: () => <CustomHeader subtitle="CALIFICAR" />,
        }}
      />
      
      {/* 🔥 Pantalla - MIS CITAS */}
      <Tabs.Screen
        name="mis-citas"
        options={{
          title: 'MIS CITAS',
          tabBarIcon: ({ color, focused }) => (
            <MotiView
              animate={{ scale: focused ? 1.1 : 1 }}
              transition={{ type: 'timing', duration: 200 }}
            >
              <Feather name="list" size={24} color={color} opacity={focused ? 1 : 0.7} />
            </MotiView>
          ),
          headerTitle: () => <CustomHeader subtitle="MIS CITAS" />,
        }}
      />
      
      {/* 🔥 Pantalla - PERFIL */}
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
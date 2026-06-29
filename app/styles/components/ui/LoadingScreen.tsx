import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Text, View } from 'react-native';
import { useGameStyles } from '../../../hooks/useGameStyles';

const { width } = Dimensions.get('window');

export function LoadingScreen() {
  const { colors, spacing } = useGameStyles();
  const progress = useRef(new Animated.Value(0)).current;
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 100,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    progress.addListener(({ value }) => {
      setLoadProgress(Math.round(value));
    });

    return () => progress.removeAllListeners();
  }, []);

  // 🔥 Círculos de la oruga (7 segmentos)
  const circles = [
    { size: 48, color: '#FF6B35', offset: 0 },     // Cabeza
    { size: 40, color: '#FF7A4A', offset: 10 },    // Segmento 1
    { size: 38, color: '#FF8959', offset: 20 },    // Segmento 2
    { size: 35, color: '#FF9868', offset: 30 },    // Segmento 3
    { size: 33, color: '#FFA777', offset: 40 },    // Segmento 4
    { size: 30, color: '#FFB686', offset: 50 },    // Segmento 5
    { size: 28, color: '#FFC595', offset: 60 },    // Segmento 6 (cola)
  ];

  return (
    <LinearGradient
      colors={[colors.background, colors.card]}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
    >
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 800 }}
        style={{ alignItems: 'center' }}
      >
        {/* 🔥 ORUGA NARANJA ANIMADA */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          height: 80,
          marginBottom: spacing.xl,
        }}>
          {circles.map((circle, index) => {
            // 🔥 Cada círculo tiene su propia animación de "ondulación"
            const translateY = new Animated.Value(0);
            
            useEffect(() => {
              const startAnimation = () => {
                Animated.loop(
                  Animated.sequence([
                    Animated.timing(translateY, {
                      toValue: -10 - index * 2, // Cada segmento sube un poco menos
                      duration: 500 + index * 50,
                      useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                      toValue: 10 + index * 2,
                      duration: 500 + index * 50,
                      useNativeDriver: true,
                    }),
                  ])
                ).start();
              };
              startAnimation();
            }, []);

            return (
              <Animated.View
                key={index}
                style={{
                  width: circle.size,
                  height: circle.size,
                  borderRadius: circle.size / 2,
                  backgroundColor: circle.color,
                  marginLeft: index === 0 ? 0 : -8,
                  transform: [{ translateY }],
                  shadowColor: circle.color,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 12,
                  elevation: 6,
                  // 🔥 La cabeza tiene "ojos" (dos puntos blancos)
                  ...(index === 0 && {
                    justifyContent: 'center',
                    alignItems: 'center',
                  }),
                }}
              >
                {index === 0 && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: 'white',
                      marginTop: -4,
                    }} />
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: 'white',
                      marginTop: -4,
                    }} />
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>

        <Text style={{
          color: colors.gold,
          fontSize: 28,
          fontWeight: 'bold',
          letterSpacing: 4,
          marginTop: spacing.md,
        }}>
          CUTTRACK
        </Text>
        <Text style={{
          color: colors.textSecondary,
          fontSize: 12,
          letterSpacing: 2,
          marginTop: spacing.xs,
        }}>
          Caribbean
        </Text>
      </MotiView>

      {/* Barra de progreso */}
      <View style={{
        marginTop: spacing.xl,
        width: width * 0.7,
        height: 6,
        backgroundColor: colors.glass,
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <Animated.View style={{
          width: progress.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
          height: '100%',
          backgroundColor: '#FF6B35',
          borderRadius: 3,
        }} />
      </View>

      <Text style={{
        color: colors.textMuted,
        fontSize: 12,
        marginTop: spacing.md,
      }}>
        {loadProgress}%
      </Text>

      <Text style={{
        color: colors.textMuted,
        fontSize: 10,
        marginTop: spacing.xl,
        position: 'absolute',
        bottom: spacing.lg,
      }}>
        v1.0.0 • © 2026 CUTTRACK Caribbean
      </Text>
    </LinearGradient>
  );
}
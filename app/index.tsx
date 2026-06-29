import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { StyleSheet, Text } from 'react-native';
import { useGameStyles } from './hooks/useGameStyles';
import { GameButton } from './styles/components/ui/GameButton';

export default function Index() {
  const { colors } = useGameStyles();

  return (
    <LinearGradient
      colors={[colors.background, colors.card]}
      style={styles.container}
    >
      <MotiView
        from={{ opacity: 0, translateY: 30 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 800 }}
        style={styles.logoContainer}
      >
        <MotiView
          from={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'timing', duration: 600, delay: 200 }}
          style={[styles.logoCircle, { borderColor: colors.primary }]}
        >
          <Feather name="scissors" size={56} color={colors.primary} />
        </MotiView>
        
        <Text style={[styles.title, { color: colors.primary }]}>CUTTRACK</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Tu negocio, bajo control
        </Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 600, delay: 400 }}
        style={styles.buttonsContainer}
      >
        <GameButton 
          title="Entrar como Cliente"
          variant="primary"
          onPress={() => router.push('/client/login')}
          style={styles.button}
          icon="user"
        />

        <GameButton 
          title="Mi Negocio"
          variant="secondary"
          onPress={() => router.push('/(auth)/login')}
          style={styles.button}
          icon="scissors"
        />
      </MotiView>

      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 600, delay: 600 }}
      >
        <Text style={[styles.footer, { color: colors.textMuted }]}>
          © 2026 CUTTRACK Caribbean
        </Text>
      </MotiView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 64,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,107,53,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 6,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    letterSpacing: 1,
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 48,
  },
  button: {
    width: '100%',
  },
  footer: {
    fontSize: 11,
    position: 'absolute',
    bottom: 24,
    letterSpacing: 1,
  },
});
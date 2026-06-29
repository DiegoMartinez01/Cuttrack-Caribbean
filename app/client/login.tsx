import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';

export default function ClientLogin() {
  const { colors, global, spacing } = useGameStyles();
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  const [intentos, setIntentos] = useState(0);
  const timeoutRef = useRef<number | null>(null);

  // Estado del modal
  const [modal, setModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm',
    onConfirm: null as (() => void) | null,
  });

  const showModal = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'confirm' = 'confirm',
    onConfirm?: () => void
  ) => {
    setModal({ visible: true, title, message, type, onConfirm: onConfirm || null });
  };

  const hideModal = () => {
    setModal((prev) => ({ ...prev, visible: false }));
  };

  // 🔥 VERIFICAR SESIÓN AL ABRIR
  useEffect(() => {
    const verificarSesion = async () => {
      try {
        const clienteId = await storage.getItem('cliente_id');
        const clienteNombre = await storage.getItem('cliente_nombre');

        if (clienteId && clienteNombre) {
          console.log('✅ Sesión encontrada para:', clienteNombre);
          router.replace('/(cliente)');
        }
      } catch (error) {
        console.error('Error al verificar sesión:', error);
      } finally {
        setVerificandoSesion(false);
      }
    };
    
    verificarSesion();
  }, []);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleLogin = async () => {
    const telefonoLimpio = telefono.replace(/[^0-9]/g, '');
    
    // Validación de teléfono
    if (!telefonoLimpio) {
      showModal('Campos incompletos', 'Ingresa tu número de teléfono', 'error');
      return;
    }
    
    if (telefonoLimpio.length < 10) {
      showModal('Número inválido', 'El número debe tener al menos 10 dígitos', 'error');
      return;
    }

    if (telefonoLimpio.length > 10) {
      showModal('Número inválido', 'El número no debe exceder los 10 dígitos', 'error');
      return;
    }

    // Control de intentos
    if (intentos >= 5) {
      showModal(
        'Demasiados intentos',
        'Espera 5 minutos antes de intentar de nuevo.',
        'warning'
      );
      return;
    }

    setLoading(true);
    setIntentos((prev) => prev + 1);

    // Timeout de 20 segundos
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal(
        'Tiempo de espera agotado',
        'Revisa tu conexión a internet e intenta de nuevo.',
        'error'
      );
    }, 20000);

    try {
      console.log('🔍 Buscando cliente con teléfono:', telefonoLimpio);

      const { data: cliente, error } = await supabase
        .from('clients')
        .select('id, nombre, telefono, verificado')
        .eq('telefono', telefonoLimpio)
        .maybeSingle();

      if (error?.message?.includes('Failed to fetch')) {
        throw new Error('Sin conexión a internet');
      }

      if (error) throw error;

      // Cliente no registrado
      if (!cliente) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        showModal(
          'No registrado',
          'Este número no está registrado. ¿Quieres crear una cuenta?',
          'confirm',
          () => router.push('/register-client')
        );
        setLoading(false);
        return;
      }

      // Cliente no verificado
      if (!cliente.verificado) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        showModal(
          'Cuenta no verificada',
          'Por favor completa tu registro primero.',
          'confirm',
          () => router.push('/register-client')
        );
        setLoading(false);
        return;
      }

      // Guardar sesión
      await storage.setItem('cliente_id', cliente.id);
      await storage.setItem('cliente_nombre', cliente.nombre);
      await storage.setItem('cliente_telefono', cliente.telefono);
      await storage.setItem('user_rol', 'client');

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      showModal('✅ Bienvenido', `Hola ${cliente.nombre}`, 'success', () => {
        router.replace('/(cliente)');
      });

    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('Login error:', error.message);
      
      let mensaje = error.message || 'Error al iniciar sesión';
      if (error.message?.includes('network')) {
        mensaje = 'Problemas de conexión. Verifica tu internet.';
      }
      
      showModal('Error de inicio de sesión', mensaje, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (verificandoSesion) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[colors.background, colors.card]}
      style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}
    >
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: 'rgba(255,107,53,0.1)',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: 'rgba(255,107,53,0.3)',
        }}>
          <Feather name="user" size={40} color={colors.primary} />
        </View>
        <Text style={[global.headerTitle, { fontSize: 32, letterSpacing: 2 }]}>CUTTRACK</Text>
        <Text style={[global.text, { color: colors.textMuted, fontSize: 12, marginTop: 4 }]}>
          Agenda tu corte sin esperar
        </Text>
      </View>

      <View style={{
        backgroundColor: colors.glass,
        borderRadius: 24,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <Feather name="phone" size={14} color={colors.gold} />
          <Text style={{ color: colors.gold, fontSize: 14 }}>Tu número de teléfono</Text>
        </View>
        
        <TextInput
          style={[global.input, { backgroundColor: colors.card }]}
          placeholder="Ej: 3016669455"
          placeholderTextColor={colors.textMuted}
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
          editable={!loading}
        />
      </View>

      <GameButton 
        title="Continuar"
        variant="primary"
        onPress={handleLogin}
        loading={loading}
        style={{ marginBottom: spacing.md }}
        icon="arrow-right"
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.card }} />
        <Text style={{ color: colors.textMuted, paddingHorizontal: spacing.base, fontSize: 12 }}>¿Nuevo en CUTTRACK?</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.card }} />
      </View>

      <GameButton 
        title="Registrarme"
        variant="secondary"
        onPress={() => router.push('/register-client')}
        style={{ marginBottom: spacing.md }}
        icon="user-plus"
      />

      <GameButton 
        title="Volver"
        variant="secondary"
        onPress={() => router.push('/')}
        icon="arrow-left"
      />

      {/* Modal personalizado */}
      <CustomModal
        visible={modal.visible}
        onClose={hideModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm || undefined}
        confirmText={modal.type === 'confirm' ? 'Continuar' : 'Aceptar'}
        cancelText="Cancelar"
      />
    </LinearGradient>
  );
}
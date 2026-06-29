import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary';
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';

export default function OwnerLogin() {
  const { colors, global, spacing } = useGameStyles();
  const { getIcon } = useBusinessDictionary();
  
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  const [modal, setModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm',
    onConfirm: null as (() => void) | null,
  });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'confirm' = 'confirm', onConfirm?: () => void) => {
    setModal({ visible: true, title, message, type, onConfirm: onConfirm || null });
  };

  const hideModal = () => {
    setModal((prev) => ({ ...prev, visible: false }));
  };

  // 🔥 FUNCIONES DEFINIDAS
  const handleIdentificadorChange = (text: string) => {
    setIdentificador(text);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
  };

  useEffect(() => {
    const verificarSesion = async () => {
      try {
        const userRol = await storage.getItem('user_rol');
        
        if (userRol === 'owner') {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            console.log('✅ Sesión de dueño válida en Supabase');
            router.replace('/(admin)');
            return;
          }
          
          console.log('🔄 Intentando restaurar sesión de dueño...');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (!refreshError && refreshedSession) {
            console.log('✅ Sesión de dueño restaurada correctamente');
            router.replace('/(admin)');
            return;
          }
          
          console.log('⚠️ Sesión de dueño expirada, limpiando...');
          await storage.multiRemove(['user_rol', 'owner_email', 'owner_id']);
        }
        
        else if (userRol === 'barber') {
          const barberoId = await storage.getItem('barbero_id');
          const barberoNombre = await storage.getItem('barbero_nombre');
          
          if (barberoId && barberoNombre) {
            console.log('✅ Sesión de barbero encontrada:', barberoNombre);
            router.replace('/(barbero)');
            return;
          } else {
            await storage.multiRemove(['user_rol', 'barbero_id', 'barbero_nombre', 'barbero_telefono', 'barbero_barbershop_id']);
          }
        }
        
        else if (userRol === 'client') {
          const clienteId = await storage.getItem('cliente_id');
          if (clienteId) {
            console.log('⚠️ Sesión de cliente detectada. Limpiando...');
            await storage.multiRemove(['user_rol', 'cliente_id', 'cliente_nombre', 'cliente_telefono']);
          }
        }
        
      } catch (error) {
        console.error('Error al verificar sesión:', error);
        await storage.multiRemove(['user_rol', 'owner_email', 'owner_id', 'barbero_id', 'barbero_nombre']);
      } finally {
        setVerificandoSesion(false);
      }
    };
    
    verificarSesion();
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleLogin = async () => {
    if (!identificador.trim()) {
      showModal('Campos incompletos', 'Ingresa tu correo o número de teléfono', 'error');
      return;
    }
    if (!password.trim()) {
      showModal('Campos incompletos', 'Ingresa tu contraseña', 'error');
      return;
    }

    if (intentos >= 5) {
      showModal('Demasiados intentos', 'Espera 5 minutos antes de intentar de nuevo.', 'warning');
      return;
    }

    setLoading(true);
    setIntentos((prev) => prev + 1);

    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet e intenta de nuevo.', 'error');
    }, 20000);

    try {
      const soloNumeros = identificador.replace(/[^0-9]/g, '');
      const esTelefono = soloNumeros.length >= 10 && identificador.match(/^[0-9]+$/);

      if (esTelefono) {
        console.log('🔍 Intentando login de barbero con teléfono:', soloNumeros);

        const { data: barbero, error: barberoError } = await supabase
          .from('barbers')
          .select('id, nombre, telefono, activo, barbershop_id, password')
          .eq('telefono', soloNumeros)
          .maybeSingle();

        if (barberoError?.message?.includes('Failed to fetch')) {
          throw new Error('Sin conexión a internet');
        }

        if (barberoError || !barbero) {
          throw new Error('Barbero no encontrado con ese número');
        }

        if (!barbero.activo) {
          throw new Error('Tu cuenta está desactivada. Contacta al administrador');
        }

        const contrasenaGuardadaKey = `barbero_password_${barbero.id}`;
        const contrasenaGuardadaStorage = await storage.getItem(contrasenaGuardadaKey);
        const contrasenaGuardadaBD = barbero.password;

        let esContrasenaValida = false;

        if (contrasenaGuardadaStorage) {
          esContrasenaValida = password === contrasenaGuardadaStorage;
        } else if (contrasenaGuardadaBD) {
          esContrasenaValida = password === contrasenaGuardadaBD;
        } else {
          esContrasenaValida = password === barbero.telefono;
        }

        if (!esContrasenaValida) {
          throw new Error('Contraseña incorrecta');
        }

        await storage.setItem('barbero_id', barbero.id);
        await storage.setItem('barbero_nombre', barbero.nombre);
        await storage.setItem('barbero_telefono', barbero.telefono);
        await storage.setItem('barbero_barbershop_id', barbero.barbershop_id);
        await storage.setItem('user_rol', 'barber');

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        showModal('✅ Bienvenido', `${barbero.nombre}`, 'success', () => {
          router.replace('/(barbero)');
        });
      } else {
        console.log('🔍 Intentando login de dueño con email:', identificador.trim());

        const { data, error } = await supabase.auth.signInWithPassword({
          email: identificador.trim(),
          password: password.trim(),
        });

        if (error) {
          switch (error.message) {
            case 'Invalid login credentials':
              throw new Error('Correo o contraseña incorrectos');
            case 'Email not confirmed':
              throw new Error('Confirma tu correo antes de iniciar sesión');
            case 'User not found':
              throw new Error('No existe una cuenta con este correo');
            default:
              throw new Error(error.message);
          }
        }

        if (!data.user) {
          throw new Error('Error al obtener datos del usuario');
        }

        const { data: user, error: userError } = await supabase
          .from('users')
          .select('rol')
          .eq('id', data.user.id)
          .single();

        if (userError || !user) {
          throw new Error('Usuario no encontrado en el sistema');
        }

        if (user.rol !== 'owner') {
          throw new Error('Acceso no autorizado. Esta área es solo para dueños.');
        }

        await storage.setItem('user_rol', 'owner');
        await storage.setItem('owner_email', identificador.trim());
        await storage.setItem('owner_id', data.user.id);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        showModal('✅ Bienvenido', 'Has iniciado sesión correctamente', 'success', () => {
          router.replace('/(admin)');
        });
      }
    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('Login error:', error.message);
      showModal('Error de inicio de sesión', error.message || 'Credenciales incorrectas', 'error');
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
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'rgba(255,107,53,0.1)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: 'rgba(255,107,53,0.3)',
          }}
        >
          <Feather name={getIcon('business') as any} size={40} color={colors.primary} />
        </View>
        <Text style={[global.headerTitle, { fontSize: 32, letterSpacing: 2 }]}>CUTTRACK</Text>
        <Text
          style={[
            global.text,
            { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 },
          ]}
        >
          Ingresa a tu cuenta
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.glass,
          borderRadius: 24,
          padding: spacing.lg,
          marginBottom: spacing.lg,
          borderWidth: 1,
          borderColor: colors.glassBorder,
        }}
      >
        <TextInput
          style={[global.input, { backgroundColor: colors.card, marginBottom: spacing.md }]}
          placeholder="Email o número de teléfono"
          placeholderTextColor={colors.textMuted}
          value={identificador}
          onChangeText={handleIdentificadorChange}
          autoCapitalize="none"
          keyboardType="default"
          editable={!loading}
        />

        <TextInput
          style={[global.input, { backgroundColor: colors.card }]}
          placeholder="Contraseña"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={handlePasswordChange}
          editable={!loading}
        />
      </View>

      <GameButton
        title="Iniciar Sesión"
        variant="primary"
        onPress={handleLogin}
        loading={loading}
        style={{ marginBottom: spacing.md }}
        icon="log-in"
      />

      <GameButton
        title="¿No tienes negocio? Regístrate"
        variant="secondary"
        onPress={() => router.push('/register-owner')}
        style={{ marginBottom: spacing.sm }}
        icon="user-plus"
      />

      <GameButton
        title="Volver"
        variant="secondary"
        onPress={() => router.push('/')}
        icon="arrow-left"
      />

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
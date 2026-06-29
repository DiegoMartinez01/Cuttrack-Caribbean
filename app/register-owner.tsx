import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabase/client';
import { useGameStyles } from './hooks/useGameStyles';
import { CustomModal } from './styles/components/ui/CustomModal';
import { GameButton } from './styles/components/ui/GameButton';
import { GameCard } from './styles/components/ui/GameCard';

// 🔥 Tipos de negocio disponibles
const businessTypes = [
  { id: 'barberia', label: 'Barbería', icon: 'scissors', description: 'Cortes de pelo, barbas, etc.' },
  { id: 'gimnasio', label: 'Gimnasio', icon: 'dumbbell', description: 'Clases, entrenamientos personales' },
  { id: 'lavadero', label: 'Lavadero', icon: 'car', description: 'Lavado de autos, detalles' },
  { id: 'spa', label: 'Spa', icon: 'spa', description: 'Masajes, tratamientos' },
  { id: 'taller', label: 'Taller mecánico', icon: 'wrench', description: 'Reparaciones, mantenimiento' },
  { id: 'salon', label: 'Salón de belleza', icon: 'scissors', description: 'Peluquería, estética' },
];

export default function RegisterOwner() {
  const { colors, global, spacing } = useGameStyles();
  const [nombreBarberia, setNombreBarberia] = useState('');
  const [nombreDueño, setNombreDueño] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [codigo1, setCodigo1] = useState('');
  const [codigo2, setCodigo2] = useState('');
  const [loading, setLoading] = useState(false);
  // 🔥 NUEVO: Estado para el tipo de negocio
  const [businessType, setBusinessType] = useState('barberia');
  
  const timeoutRef = useRef<number | null>(null);

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

  const handleRegister = async () => {
    // ============================================
    // VALIDACIONES BÁSICAS
    // ============================================
    if (!nombreBarberia.trim()) {
      showModal('Campos incompletos', 'Ingresa el nombre de tu negocio', 'error');
      return;
    }
    if (!nombreDueño.trim()) {
      showModal('Campos incompletos', 'Ingresa tu nombre completo', 'error');
      return;
    }
    if (!email.trim()) {
      showModal('Campos incompletos', 'Ingresa tu correo electrónico', 'error');
      return;
    }
    if (!password.trim()) {
      showModal('Campos incompletos', 'Ingresa una contraseña', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showModal('Email inválido', 'Ingresa un correo electrónico válido (ej: nombre@dominio.com)', 'error');
      return;
    }

    if (password.length < 6) {
      showModal('Contraseña débil', 'La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }

    if (codigo1.length !== 4 || codigo2.length !== 4) {
      showModal('Código inválido', 'Cada bloque del código de licencia debe tener exactamente 4 caracteres', 'error');
      return;
    }

    const codigoLicencia = `LIC-${codigo1.toUpperCase()}-${codigo2.toUpperCase()}`;
    console.log('🔍 Código armado:', codigoLicencia);

    setLoading(true);

    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet e intenta de nuevo.', 'error');
    }, 20000);

    try {
      // ============================================
      // 1. VERIFICAR LICENCIA
      // ============================================
      console.log('📡 Verificando licencia...');
      const { data: licencia, error: licenciaError } = await supabase
        .from('licencias')
        .select('codigo, usado')
        .eq('codigo', codigoLicencia)
        .maybeSingle();

      if (licenciaError?.message?.includes('Failed to fetch')) {
        throw new Error('Sin conexión a internet');
      }

      if (licenciaError) {
        console.error('Error de conexión:', licenciaError);
        throw new Error('Error al validar licencia. Intenta de nuevo.');
      }

      if (!licencia) {
        throw new Error('Código de licencia inválido. Verifica el código e intenta de nuevo.');
      }

      if (licencia.usado) {
        throw new Error('Esta licencia ya fue utilizada. Cada código es único y válido para un solo negocio.');
      }

      // ============================================
      // 2. VERIFICAR EMAIL EXISTENTE
      // ============================================
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', email.trim())
        .maybeSingle();

      if (existingUser) {
        throw new Error('Este correo electrónico ya está registrado. Usa otro o inicia sesión.');
      }

      // ============================================
      // 3. CREAR USUARIO EN SUPABASE AUTH
      // ============================================
      console.log('📡 Creando usuario en Auth...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) {
        switch (authError.message) {
          case 'User already registered':
            throw new Error('Este correo ya está registrado. Inicia sesión o usa otro.');
          case 'Password should be at least 6 characters':
            throw new Error('La contraseña debe tener al menos 6 caracteres.');
          default:
            throw new Error(authError.message);
        }
      }

      if (!authData.user) {
        throw new Error('Error al crear el usuario. Intenta de nuevo.');
      }

      // ============================================
      // 4. CREAR NEGOCIO (con business_type)
      // ============================================
      console.log('📡 Creando negocio con tipo:', businessType);
      const codigoUnico = 'CUT-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { data: barbershop, error: barbershopError } = await supabase
        .from('barbershops')
        .insert({
          nombre: nombreBarberia.trim(),
          nombre_dueno: nombreDueño.trim(),
          email: email.trim(),
          telefono: telefono.trim() || null,
          direccion: direccion.trim() || null,
          codigo_licencia: codigoLicencia,
          codigo_unico: codigoUnico,
          business_type: businessType, // 🔥 NUEVO: tipo de negocio
          activo: true,
        })
        .select()
        .single();

      if (barbershopError) {
        console.error('Error al crear negocio:', barbershopError);
        throw new Error('Error al crear el negocio. Intenta de nuevo.');
      }

      // ============================================
      // 5. MARCAR LICENCIA COMO USADA
      // ============================================
      const { error: updateError } = await supabase
        .from('licencias')
        .update({ usado: true, usado_por: barbershop.id })
        .eq('codigo', codigoLicencia);

      if (updateError) {
        console.error('Error al marcar licencia:', updateError);
      }

      // ============================================
      // 6. CREAR USUARIO EN TABLA USERS
      // ============================================
      const { error: userError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: email.trim(),
        nombre: nombreDueño.trim(),
        rol: 'owner',
        barbershop_id: barbershop.id,
      });

      if (userError) {
        console.error('Error al crear usuario en tabla users:', userError);
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // ============================================
      // 7. ÉXITO - MOSTRAR MODAL Y REDIRIGIR
      // ============================================
      const tipoNegocio = businessTypes.find(t => t.id === businessType)?.label || 'Negocio';
      
      showModal(
        '✅ Negocio registrado',
        `"${nombreBarberia}" (${tipoNegocio}) ha sido creado exitosamente.\n\n📋 Código de invitación: ${codigoUnico}\n\nAhora puedes iniciar sesión.`,
        'success',
        () => {
          router.replace('/login');
        }
      );

    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('Error en registro:', error.message);
      
      let mensaje = error.message || 'Error al registrar negocio';
      
      if (error.message?.includes('duplicate key')) {
        mensaje = 'Ya existe un negocio registrado con estos datos.';
      } else if (error.message?.includes('network')) {
        mensaje = 'Problemas de conexión. Verifica tu internet e intenta de nuevo.';
      }
      
      showModal('Error al registrar', mensaje, 'error');
    } finally {
      setLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const cleanup = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return (
    <LinearGradient
      colors={[colors.background, colors.card]}
      style={{ flex: 1 }}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
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
            <Feather name="scissors" size={40} color={colors.primary} />
          </View>
          <Text style={[global.headerTitle, { fontSize: 28, letterSpacing: 2 }]}>CUTTRACK</Text>
          <Text style={[global.text, { color: colors.textMuted, fontSize: 12, marginTop: 4 }]}>
            Activa tu negocio en minutos
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
          <TextInput
            style={[global.input, { backgroundColor: colors.card, marginBottom: spacing.md }]}
            placeholder="Nombre del negocio *"
            placeholderTextColor={colors.textMuted}
            value={nombreBarberia}
            onChangeText={setNombreBarberia}
            editable={!loading}
          />

          <TextInput
            style={[global.input, { backgroundColor: colors.card, marginBottom: spacing.md }]}
            placeholder="Nombre del dueño *"
            placeholderTextColor={colors.textMuted}
            value={nombreDueño}
            onChangeText={setNombreDueño}
            editable={!loading}
          />

          <TextInput
            style={[global.input, { backgroundColor: colors.card, marginBottom: spacing.md }]}
            placeholder="Email del dueño *"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={[global.input, { backgroundColor: colors.card, marginBottom: spacing.md }]}
            placeholder="Contraseña * (mínimo 6 caracteres)"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />

          <TextInput
            style={[global.input, { backgroundColor: colors.card, marginBottom: spacing.md }]}
            placeholder="Teléfono (opcional)"
            placeholderTextColor={colors.textMuted}
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            editable={!loading}
          />

          <TextInput
            style={[global.input, { backgroundColor: colors.card, marginBottom: spacing.md }]}
            placeholder="Dirección (opcional)"
            placeholderTextColor={colors.textMuted}
            value={direccion}
            onChangeText={setDireccion}
            editable={!loading}
          />

          {/* 🔥 NUEVO: Selector de tipo de negocio */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold', marginBottom: spacing.sm }}>
              Tipo de negocio *
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {businessTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: businessType === type.id ? colors.primary : colors.glass,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 30,
                    borderWidth: 1,
                    borderColor: businessType === type.id ? colors.primary : colors.glassBorder,
                  }}
                  onPress={() => setBusinessType(type.id)}
                >
                  <Feather name={type.icon as any} size={16} color={businessType === type.id ? '#fff' : colors.gold} />
                  <Text style={{ color: businessType === type.id ? '#fff' : colors.text, fontSize: 13 }}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: spacing.xs }}>
              Esto determinará los términos que verán tus clientes (ej: "barbero", "entrenador", etc.)
            </Text>
          </View>

          <GameCard variant="game" style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Feather name="key" size={14} color={colors.gold} />
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold' }}>
                Código de licencia (obligatorio)
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ color: colors.gold, fontSize: 18, fontWeight: 'bold' }}>LIC-</Text>
              <TextInput
                style={[global.input, { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', letterSpacing: 2, backgroundColor: colors.card }]}
                placeholder="XXXX"
                placeholderTextColor={colors.textMuted}
                maxLength={4}
                value={codigo1}
                onChangeText={(text) => setCodigo1(text.toUpperCase())}
                autoCapitalize="characters"
                editable={!loading}
              />
              <Text style={{ color: colors.gold, fontSize: 18, fontWeight: 'bold' }}>-</Text>
              <TextInput
                style={[global.input, { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', letterSpacing: 2, backgroundColor: colors.card }]}
                placeholder="XXXX"
                placeholderTextColor={colors.textMuted}
                maxLength={4}
                value={codigo2}
                onChangeText={(text) => setCodigo2(text.toUpperCase())}
                autoCapitalize="characters"
                editable={!loading}
              />
            </View>
          </GameCard>
        </View>

        <GameButton 
          title="Registrar Negocio"
          variant="primary"
          onPress={handleRegister}
          loading={loading}
          style={{ marginBottom: spacing.md }}
          icon="user-plus"
        />

        <GameButton 
          title="Volver al login"
          variant="secondary"
          onPress={() => router.replace('/login')}
          icon="arrow-left"
        />
      </ScrollView>

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
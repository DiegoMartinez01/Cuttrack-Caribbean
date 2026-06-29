import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, Share, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary';
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';
import { GameCard } from '../styles/components/ui/GameCard';
import { ImageUploader } from '../styles/components/ui/ImageUploader';
 
export default function PerfilAdmin() {
  const { colors, global, spacing } = useGameStyles();
  // 🔥 HOOK MULTI-TENANT
  const { 
    getIcon, 
    employeePlural, 
    servicePlural, 
    appointmentPlural,
    serviceName,
    employeeName,
    appointmentName
  } = useBusinessDictionary();
  
  const [barbershopData, setBarbershopData] = useState<{ 
    nombre: string; 
    email: string; 
    codigo_unico: string;
    nombre_dueno: string;
    logo_url?: string;
    mensaje_bienvenida?: string;
  } | null>(null);
  const [adminFotoUrl, setAdminFotoUrl] = useState<string | null>(null);
  const [estadisticas, setEstadisticas] = useState({
    barberos: 0,
    servicios: 0,
    citasCompletadas: 0,
    citasPendientes: 0,
    clientes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  
  const [mensajeBienvenida, setMensajeBienvenida] = useState('');
  const [editandoMensaje, setEditandoMensaje] = useState(false);
  const [guardandoMensaje, setGuardandoMensaje] = useState(false);

  // 🔥 NUEVO: Estado para el modal del código de invitación
  const [invitationModalVisible, setInvitationModalVisible] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [customModal, setCustomModal] = useState({
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
    setCustomModal({ visible: true, title, message, type, onConfirm: onConfirm || null });
  };

  const hideModal = () => {
    setCustomModal((prev) => ({ ...prev, visible: false }));
  };

  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    cargarDatos();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const { data: userDataAuth } = await supabase.auth.getUser();
      if (!userDataAuth.user) throw new Error('No hay usuario');

      setAdminId(userDataAuth.user.id);

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userDataAuth.user.id)
        .single();

      if (userError) throw userError;

      if (user?.foto_url) {
        setAdminFotoUrl(user.foto_url);
      }

      const shopId = user.barbershop_id;
      setBarbershopId(shopId);
      
      if (shopId) {
        const { data: barbershop, error: barbershopError } = await supabase
          .from('barbershops')
          .select('nombre, email, codigo_unico, nombre_dueno, logo_url, mensaje_bienvenida')
          .eq('id', shopId)
          .single();

        if (barbershopError) throw barbershopError;

        if (barbershop) {
          setBarbershopData({
            nombre: barbershop.nombre,
            email: barbershop.email,
            codigo_unico: barbershop.codigo_unico,
            nombre_dueno: barbershop.nombre_dueno || 'No registrado',
            logo_url: barbershop.logo_url,
            mensaje_bienvenida: barbershop.mensaje_bienvenida,
          });
          setMensajeBienvenida(barbershop.mensaje_bienvenida || 'Bienvenido');
        }

        await cargarEstadisticas(shopId);
      }

    } catch (error: any) {
      console.error('Error cargando perfil:', error);
      showModal('Error', error.message || 'No se pudieron cargar los datos', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const cargarEstadisticas = async (shopId: string) => {
    try {
      const { count: barberosCount } = await supabase
        .from('barbers')
        .select('*', { count: 'exact', head: true })
        .eq('barbershop_id', shopId)
        .eq('activo', true);

      const { count: serviciosCount } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('barbershop_id', shopId)
        .eq('activo', true);

      const { data: barberos } = await supabase
        .from('barbers')
        .select('id')
        .eq('barbershop_id', shopId);

      const barberosIds = barberos?.map(b => b.id) || [];

      let citasCompletadas = 0;
      let citasPendientes = 0;
      let clientesCount = 0;

      if (barberosIds.length > 0) {
        const { count: completadasCount } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .in('barbero_id', barberosIds)
          .eq('estado', 'completada');

        citasCompletadas = completadasCount || 0;

        const { count: pendientesCount } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .in('barbero_id', barberosIds)
          .eq('estado', 'pendiente');

        citasPendientes = pendientesCount || 0;

        const { data: clientesData } = await supabase
          .from('clients')
          .select('id')
          .eq('barbershop_id', shopId);

        clientesCount = clientesData?.length || 0;
      }

      setEstadisticas({
        barberos: barberosCount || 0,
        servicios: serviciosCount || 0,
        citasCompletadas,
        citasPendientes,
        clientes: clientesCount,
      });

    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const handleAdminFotoUploaded = async (url: string) => {
    try {
      if (!adminId) return;

      const { error } = await supabase
        .from('users')
        .update({ foto_url: url })
        .eq('id', adminId);

      if (error) throw error;

      setAdminFotoUrl(url);
      showModal('✅ Foto actualizada', 'Tu foto de perfil ha sido actualizada', 'success');
    } catch (error) {
      console.error('Error guardando foto:', error);
      showModal('Error', 'No se pudo guardar la foto de perfil', 'error');
    }
  };

  const handleAdminFotoDeleted = async () => {
    try {
      if (!adminId) return;

      const { error } = await supabase
        .from('users')
        .update({ foto_url: null })
        .eq('id', adminId);

      if (error) throw error;

      setAdminFotoUrl(null);
      showModal('✅ Foto eliminada', 'Tu foto de perfil ha sido eliminada', 'success');
    } catch (error) {
      console.error('Error eliminando foto:', error);
      showModal('Error', 'No se pudo eliminar la foto de perfil', 'error');
    }
  };

  const handleLogoUploaded = async (url: string) => {
    try {
      if (!barbershopId) return;

      const { error } = await supabase
        .from('barbershops')
        .update({ logo_url: url })
        .eq('id', barbershopId);

      if (error) throw error;

      setBarbershopData(prev => prev ? { ...prev, logo_url: url } : prev);
      showModal('✅ Logo actualizado', 'El logo de tu negocio ha sido actualizado', 'success');
    } catch (error) {
      console.error('Error guardando logo:', error);
      showModal('Error', 'No se pudo guardar el logo', 'error');
    }
  };

  const handleLogoDeleted = async () => {
    try {
      if (!barbershopId) return;

      const { error } = await supabase
        .from('barbershops')
        .update({ logo_url: null })
        .eq('id', barbershopId);

      if (error) throw error;

      setBarbershopData(prev => prev ? { ...prev, logo_url: undefined } : prev);
      showModal('✅ Logo eliminado', 'El logo ha sido eliminado', 'success');
    } catch (error) {
      console.error('Error eliminando logo:', error);
      showModal('Error', 'No se pudo eliminar el logo', 'error');
    }
  };

  const guardarMensajeBienvenida = async () => {
    if (!barbershopId) return;
    
    setGuardandoMensaje(true);
    timeoutRef.current = setTimeout(() => {
      setGuardandoMensaje(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const { error } = await supabase
        .from('barbershops')
        .update({ mensaje_bienvenida: mensajeBienvenida.trim() || 'Bienvenido' })
        .eq('id', barbershopId);
      
      if (error) throw error;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      showModal('✅ Mensaje actualizado', 'El mensaje de bienvenida ha sido actualizado', 'success');
      setEditandoMensaje(false);
      
    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      showModal('Error', error.message || 'No se pudo guardar el mensaje', 'error');
    } finally {
      setGuardandoMensaje(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarDatos();
  }, []);

  const handleLogout = () => {
    showModal(
      'Cerrar sesión',
      '¿Estás seguro de que quieres salir?',
      'confirm',
      async () => {
        await storage.multiRemove(['user_rol', 'owner_email', 'owner_id']);
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
      }
    );
  };

  // 🔥 FUNCIONES PARA EL QR Y CÓDIGO DE INVITACIÓN
  const copiarCodigo = async (codigo: string) => {
    try {
      await Clipboard.setStringAsync(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      showModal('✅ Código copiado', 'El código de invitación ha sido copiado al portapapeles', 'success');
    } catch (error) {
      console.error('Error al copiar:', error);
      showModal('Error', 'No se pudo copiar el código', 'error');
    }
  };

  const compartirCodigo = async (codigo: string, nombre: string) => {
    try {
      await Share.share({
        message: `📌 ¡Únete a ${nombre} en CUTTRACK!\n\n🔑 Código de invitación: ${codigo}\n\n📱 Descarga la app y regístrate con este código.\n\n👉 https://cuttrack.app/download`,
      });
    } catch (error) {
      console.error('Error al compartir:', error);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={global.container}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh} 
          colors={[colors.primary]} 
          tintColor={colors.primary} 
        />
      }
      contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
    >
      {/* Logo del negocio */}
      <View style={{ alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md }}>
        <ImageUploader
          onImageUploaded={handleLogoUploaded}
          onImageDeleted={handleLogoDeleted}
          currentImage={barbershopData?.logo_url}
          aspect={[1, 1]}
        />
      </View>

      {/* Nombre de empresa */}
      <View style={[global.header, { alignItems: 'center', marginBottom: spacing.md, borderBottomWidth: 0 }]}>
        <Text style={[global.headerTitle, { fontSize: 28, letterSpacing: 2 }]}>{barbershopData?.nombre || 'Mi Negocio'}</Text>
        <Text style={global.headerSubtitle}>Dueño: {barbershopData?.nombre_dueno || 'Administrador'}</Text>
      </View>

      {/* 🔥 NUEVO: Botón para mostrar código de invitación con QR */}
      <GameCard variant="game" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setInvitationModalVisible(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 12,
              backgroundColor: 'rgba(255,107,53,0.2)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Feather name="share-2" size={24} color={colors.gold} />
            </View>
            <View>
              <Text style={[global.text, { fontWeight: 'bold', fontSize: 16 }]}>Invitar clientes</Text>
              <Text style={global.textSecondary}>Comparte el código de invitación</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={colors.primary} />
        </TouchableOpacity>
      </GameCard>

      {/* Mensaje de bienvenida (editable) */}
      <GameCard variant="game" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Feather name="message-circle" size={16} color={colors.gold} />
          <Text style={[global.textSecondary, { fontWeight: 'bold' }]}>Mensaje de bienvenida</Text>
        </View>
        
        {editandoMensaje ? (
          <>
            <TextInput
              style={[global.input, { backgroundColor: colors.glass, marginBottom: spacing.sm }]}
              value={mensajeBienvenida}
              onChangeText={setMensajeBienvenida}
              placeholder="Ej: ¡Bienvenido! Agenda tu cita aquí"
              placeholderTextColor={colors.textMuted}
              multiline
              editable={!guardandoMensaje}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <GameButton 
                title="Cancelar"
                variant="danger"
                compact
                onPress={() => {
                  setEditandoMensaje(false);
                  setMensajeBienvenida(barbershopData?.mensaje_bienvenida || 'Bienvenido');
                }}
                style={{ flex: 1 }}
              />
              <GameButton 
                title={guardandoMensaje ? 'Guardando...' : 'Guardar'}
                variant="primary"
                compact
                onPress={guardarMensajeBienvenida}
                disabled={guardandoMensaje}
                style={{ flex: 1 }}
              />
            </View>
          </>
        ) : (
          <TouchableOpacity onPress={() => setEditandoMensaje(true)} activeOpacity={0.7}>
            <View style={{ 
              backgroundColor: colors.glass, 
              padding: spacing.md, 
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.glassBorder,
            }}>
              <Text style={[global.text, { marginBottom: spacing.xs }]}>
                {mensajeBienvenida || 'Bienvenido'}
              </Text>
              <Text style={{ color: colors.primary, fontSize: 11, marginTop: 4 }}>
                ✏️ Toca para editar
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </GameCard>

      {/* Foto del administrador */}
      <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
        <ImageUploader
          onImageUploaded={handleAdminFotoUploaded}
          onImageDeleted={handleAdminFotoDeleted}
          currentImage={adminFotoUrl}
          aspect={[1, 1]}
        />
        <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: spacing.xs }}>Administrador</Text>
      </View>

      <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Feather name="mail" size={16} color={colors.gold} />
          <Text style={global.textSecondary}>Email del negocio</Text>
        </View>
        <Text style={global.text}>{barbershopData?.email || 'No disponible'}</Text>
      </GameCard>

      <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <Feather name="bar-chart-2" size={20} color={colors.gold} />
          <Text style={[global.text, { fontSize: 16, fontWeight: 'bold' }]}>Estadísticas</Text>
        </View>
        
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
          <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
            <Feather name={getIcon('employee') as any} size={24} color={colors.gold} />
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{estadisticas.barberos}</Text>
            <Text style={global.textSecondary}>{employeePlural || 'Empleados'}</Text>
          </GameCard>
          <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
            <Feather name={getIcon('service') as any} size={24} color={colors.gold} />
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{estadisticas.servicios}</Text>
            <Text style={global.textSecondary}>{servicePlural || 'Servicios'}</Text>
          </GameCard>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
          <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
            <Feather name="users" size={24} color={colors.gold} />
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{estadisticas.clientes}</Text>
            <Text style={global.textSecondary}>Clientes</Text>
          </GameCard>
          <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
            <Feather name="check-circle" size={24} color={colors.success} />
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{estadisticas.citasCompletadas}</Text>
            <Text style={global.textSecondary}>{appointmentPlural || 'Citas'} completadas</Text>
          </GameCard>
        </View>

        <GameCard variant="elevated" style={{ alignItems: 'center' }}>
          <Feather name="clock" size={24} color={colors.warning} />
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{estadisticas.citasPendientes}</Text>
          <Text style={global.textSecondary}>{appointmentPlural || 'Citas'} pendientes</Text>
        </GameCard>
      </View>

      <GameButton 
        title="Cerrar sesión"
        variant="danger"
        onPress={handleLogout}
        style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing['3xl'] }}
        icon="log-out"
      />

      {/* 🔥 MODAL CON QR + CÓDIGO COPIABLE */}
      <Modal
        visible={invitationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInvitationModalVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.85)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          activeOpacity={1}
          onPress={() => setInvitationModalVisible(false)}
        >
          <View style={{
            width: '90%',
            borderRadius: 24,
            padding: 24,
            backgroundColor: colors.card,
            alignItems: 'center',
            position: 'relative',
          }}>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                padding: 4,
                zIndex: 10,
              }}
              onPress={() => setInvitationModalVisible(false)}
            >
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>

            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: colors.gold,
              marginBottom: 8,
              textAlign: 'center',
            }}>
              📌 Código de invitación
            </Text>
            <Text style={{
              fontSize: 13,
              color: colors.textSecondary,
              textAlign: 'center',
              marginBottom: 24,
              paddingHorizontal: 8,
            }}>
              Comparte este código con tus clientes para que se registren en {barbershopData?.nombre || 'tu negocio'}
            </Text>

            {/* QR Code */}
            <View style={{
              padding: 16,
              borderRadius: 16,
              marginBottom: 24,
              alignItems: 'center',
              backgroundColor: 'white',
            }}>
              <QRCode
                value={barbershopData?.codigo_unico || 'CUT-XXXX'}
                size={180}
                color={colors.primary}
                backgroundColor="white"
              />
            </View>

            {/* Código copiable */}
            <View style={{ width: '100%', marginBottom: 16 }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '500',
                color: colors.textSecondary,
                marginBottom: 6,
              }}>
                Código:
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.glassBorder,
                backgroundColor: colors.glass,
              }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  letterSpacing: 2,
                  color: colors.primary,
                }}>
                  {barbershopData?.codigo_unico || 'Cargando...'}
                </Text>
                <TouchableOpacity
                  onPress={() => copiarCodigo(barbershopData?.codigo_unico || '')}
                  style={{ padding: 4 }}
                >
                  <Feather name="copy" size={18} color={colors.gold} />
                </TouchableOpacity>
              </View>
            </View>

            <GameButton
              title="Compartir código"
              variant="primary"
              onPress={() => {
                if (barbershopData) {
                  compartirCodigo(barbershopData.codigo_unico, barbershopData.nombre);
                }
              }}
              icon="share-2"
              style={{ marginTop: spacing.sm, width: '100%' }}
            />

            <GameButton
              title="Cerrar"
              variant="secondary"
              onPress={() => setInvitationModalVisible(false)}
              style={{ marginTop: spacing.sm, width: '100%' }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <CustomModal
        visible={customModal.visible}
        onClose={hideModal}
        title={customModal.title}
        message={customModal.message}
        type={customModal.type}
        onConfirm={customModal.onConfirm || undefined}
        confirmText={customModal.type === 'confirm' ? 'Continuar' : 'Aceptar'}
        cancelText="Cancelar"
      />
    </ScrollView>
  );
}
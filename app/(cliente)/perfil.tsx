import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';
import { GameCard } from '../styles/components/ui/GameCard';
import { ImageUploader } from '../styles/components/ui/ImageUploader';

export default function PerfilCliente() {
  const { colors, global, spacing } = useGameStyles();
  const [clienteData, setClienteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barbershopNombre, setBarbershopNombre] = useState('');
  const [clienteId, setClienteId] = useState<string | null>(null);

  const timeoutRef = useRef<number | null>(null);

  // Estado del modal personalizado
  const [customModal, setCustomModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm',
    onConfirm: null as (() => void) | null,
  });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'confirm' = 'confirm', onConfirm?: () => void) => {
    setCustomModal({ visible: true, title, message, type, onConfirm: onConfirm || null });
  };

  const hideModal = () => {
    setCustomModal((prev) => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    cargarDatosCliente();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const cargarDatosCliente = async () => {
    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const id = await storage.getItem('cliente_id');
      const clienteNombre = await storage.getItem('cliente_nombre');
      const clienteTelefono = await storage.getItem('cliente_telefono');
      const barbershopId = await storage.getItem('cliente_barbershop_id');
      
      if (!id) {
        console.log('⚠️ No hay cliente logueado');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        router.replace('/client/login');
        return;
      }
      
      setClienteId(id);

      const { data: cliente, error: clienteError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (clienteError) throw clienteError;

      setClienteData({
        id: cliente.id,
        nombre: clienteNombre || cliente.nombre,
        telefono: clienteTelefono || cliente.telefono,
        creditos: cliente.creditos || 0,
        verificado: cliente.verificado,
        foto_url: cliente.foto_url,
        created_at: cliente.created_at,
      });

      if (barbershopId || cliente.barbershop_id) {
        const shopId = barbershopId || cliente.barbershop_id;
        const { data: barbershop } = await supabase
          .from('barbershops')
          .select('nombre')
          .eq('id', shopId)
          .single();
        
        if (barbershop) {
          setBarbershopNombre(barbershop.nombre);
        }
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('Error al cargar perfil:', error);
      showModal('Error', error.message || 'No se pudieron cargar los datos del perfil', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarDatosCliente();
  }, []);

  const handleFotoUploaded = async (url: string) => {
    try {
      if (!clienteId) return;

      const { error } = await supabase
        .from('clients')
        .update({ foto_url: url })
        .eq('id', clienteId);

      if (error) throw error;

      setClienteData({ ...clienteData, foto_url: url });
      showModal('✅ Foto actualizada', 'Tu foto de perfil ha sido actualizada', 'success');
    } catch (error) {
      console.error('Error guardando foto:', error);
      showModal('Error', 'No se pudo guardar la foto de perfil', 'error');
    }
  };

  const handleFotoDeleted = async () => {
    try {
      if (!clienteId) return;

      const { error } = await supabase
        .from('clients')
        .update({ foto_url: null })
        .eq('id', clienteId);

      if (error) throw error;

      setClienteData({ ...clienteData, foto_url: null });
      showModal('✅ Foto eliminada', 'Tu foto de perfil ha sido eliminada', 'success');
    } catch (error) {
      console.error('Error eliminando foto:', error);
      showModal('Error', 'No se pudo eliminar la foto de perfil', 'error');
    }
  };

  const handleLogout = () => {
    showModal('Cerrar sesión', '¿Estás seguro de que quieres salir?', 'confirm', async () => {
      await storage.multiRemove([
        'cliente_id', 
        'cliente_nombre', 
        'cliente_telefono', 
        'cliente_barbershop_id',
        'user_rol'
      ]);
      router.replace('/client/login');
    });
  };

  const formatFecha = (fecha: string) => {
    if (!fecha) return 'No disponible';
    const date = new Date(fecha);
    const dias = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${dias[date.getMonth()]} ${date.getFullYear()}`;
  };

  if (loading && !refreshing) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!clienteData) {
    return (
      <View style={global.container}>
        <Text style={global.emptyText}>No se pudieron cargar los datos</Text>
        <GameButton 
          title="Volver al login"
          variant="secondary"
          onPress={() => router.replace('/client/login')}
          style={{ marginTop: spacing.lg, marginHorizontal: spacing.lg }}
        />
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
      <View style={{ alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md }}>
        <ImageUploader
          onImageUploaded={handleFotoUploaded}
          onImageDeleted={handleFotoDeleted}
          currentImage={clienteData?.foto_url}
          aspect={[1, 1]}
        />
      </View>

      <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
        <Text style={[global.headerTitle, { fontSize: 28, letterSpacing: 1, color: colors.primary }]}>
          {clienteData?.nombre || 'Cliente'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
          <Feather name="user" size={12} color={colors.textMuted} />
          <Text style={[global.headerSubtitle, { fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' }]}>
            Cliente
          </Text>
        </View>
      </View>

      <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Feather name="phone" size={14} color={colors.gold} />
          <Text style={[global.textSecondary, { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 }]}>Teléfono</Text>
        </View>
        <Text style={[global.text, { fontSize: 15 }]}>{clienteData?.telefono || 'No disponible'}</Text>
      </GameCard>

      <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Feather name="home" size={14} color={colors.gold} />
          <Text style={[global.textSecondary, { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 }]}>Barbería</Text>
        </View>
        <Text style={[global.text, { fontSize: 15 }]}>{barbershopNombre || 'Cargando...'}</Text>
      </GameCard>

      <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Feather name="dollar-sign" size={14} color={colors.gold} />
          <Text style={[global.textSecondary, { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 }]}>Créditos</Text>
        </View>
        <Text style={[global.text, { fontSize: 15, fontWeight: 'bold', color: colors.gold }]}>
          ${clienteData?.creditos?.toLocaleString('es-CO') || 0}
        </Text>
      </GameCard>

      <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Feather name="calendar" size={14} color={colors.gold} />
          <Text style={[global.textSecondary, { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 }]}>Miembro desde</Text>
        </View>
        <Text style={[global.text, { fontSize: 15 }]}>{formatFecha(clienteData?.created_at)}</Text>
      </GameCard>

      <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Feather name="check-circle" size={14} color={clienteData?.verificado ? colors.success : colors.warning} />
          <Text style={[global.textSecondary, { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 }]}>Estado</Text>
        </View>
        <Text style={[global.text, { fontSize: 15, color: clienteData?.verificado ? colors.success : colors.warning }]}>
          {clienteData?.verificado ? 'Verificado' : 'Pendiente de verificación'}
        </Text>
      </GameCard>

      <GameButton 
        title="Cerrar sesión"
        variant="danger"
        onPress={handleLogout}
        style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing['3xl'] }}
        icon="log-out"
      />

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
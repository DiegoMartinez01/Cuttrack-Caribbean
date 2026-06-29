import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { supabase } from '../../services/supabase/client';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary'; // 🔥 NUEVO
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';
import { GameCard } from '../styles/components/ui/GameCard';
import { ImageUploader } from '../styles/components/ui/ImageUploader';

interface Servicio {
  id: string;
  nombre: string;
  duracion_min: number;
  precio: number;
  activo: boolean;
  foto_url?: string;
  descripcion?: string;
  created_at: string;
}

export default function AdminServicios() {
  const { colors, global, spacing } = useGameStyles();
  // 🔥 NUEVO: Hook de multi-tenant
  const { servicePlural, getIcon } = useBusinessDictionary();
  
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDuracion, setEditDuracion] = useState('');
  const [editPrecio, setEditPrecio] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editFotoUrl, setEditFotoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaDuracion, setNuevaDuracion] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  const [nuevaFotoUrl, setNuevaFotoUrl] = useState('');
  const [agregando, setAgregando] = useState(false);

  const [customModal, setCustomModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm',
    onConfirm: null as (() => void) | null,
  });

  const modalTimeoutRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const showModal = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'confirm' = 'confirm',
    onConfirm?: () => void
  ) => {
    if (modalTimeoutRef.current) {
      clearTimeout(modalTimeoutRef.current);
      modalTimeoutRef.current = null;
    }
    
    setCustomModal({ visible: true, title, message, type, onConfirm: onConfirm || null });
    
    if (type === 'success') {
      const timeout = setTimeout(() => {
        hideModal();
      }, 2000);
      modalTimeoutRef.current = timeout;
    }
  };

  const hideModal = () => {
    setCustomModal((prev) => ({ ...prev, visible: false }));
    if (modalTimeoutRef.current) {
      clearTimeout(modalTimeoutRef.current);
      modalTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    cargarBarbershopId();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (barbershopId) {
      cargarServicios();
    }
  }, [barbershopId]);

  const cargarBarbershopId = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('No hay usuario');

      const { data: adminUser } = await supabase
        .from('users')
        .select('barbershop_id')
        .eq('id', userData.user.id)
        .single();

      if (!adminUser?.barbershop_id) {
        throw new Error('No se encontró el negocio');
      }

      setBarbershopId(adminUser.barbershop_id);
    } catch (error) {
      console.error('Error cargando barbershop_id:', error);
      setLoading(false);
    }
  };

  const cargarServicios = async () => {
    if (!barbershopId) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('nombre');
    
    if (error) {
      showModal('Error', `No se pudieron cargar los ${(servicePlural || 'servicios').toLowerCase()}`, 'error');
    } else {
      setServicios(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarServicios();
  };

  const handleFotoUploaded = async (url: string, servicioId: string) => {
    if (!barbershopId) return;

    const { error } = await supabase
      .from('services')
      .update({ foto_url: url })
      .eq('id', servicioId)
      .eq('barbershop_id', barbershopId);

    if (error) {
      showModal('Error', 'No se pudo guardar la foto del servicio', 'error');
    } else {
      setEditFotoUrl(url);
      cargarServicios();
      showModal('✅ Foto actualizada', 'La foto del servicio se ha actualizado', 'success');
    }
  };

  const handleFotoDeleted = async (servicioId: string) => {
    if (!barbershopId) return;

    const { error } = await supabase
      .from('services')
      .update({ foto_url: null })
      .eq('id', servicioId)
      .eq('barbershop_id', barbershopId);

    if (error) {
      showModal('Error', 'No se pudo eliminar la foto', 'error');
    } else {
      setEditFotoUrl('');
      cargarServicios();
      showModal('✅ Foto eliminada', 'La foto del servicio ha sido eliminada', 'success');
    }
  };

  const guardarEdicion = async (id: string) => {
    if (!editNombre.trim()) {
      showModal('Error', `El nombre del ${(servicePlural || 'servicio').slice(0, -1).toLowerCase()} es obligatorio`, 'error');
      return;
    }
    const duracion = parseInt(editDuracion);
    if (isNaN(duracion) || duracion < 5) {
      showModal('Error', 'Duración inválida (mínimo 5 minutos)', 'error');
      return;
    }
    const precio = parseInt(editPrecio);
    if (isNaN(precio) || precio < 1000) {
      showModal('Error', 'Precio inválido (mínimo $1,000 COP)', 'error');
      return;
    }
    
    const updateData: any = {
      nombre: editNombre.trim(),
      duracion_min: duracion,
      precio: precio
    };
    
    if (editDescripcion !== undefined) {
      updateData.descripcion = editDescripcion.trim() || null;
    }
    
    const { error } = await supabase
      .from('services')
      .update(updateData)
      .eq('id', id)
      .eq('barbershop_id', barbershopId);
    
    if (error) {
      showModal('Error', `No se pudo actualizar el ${(servicePlural || 'servicio').slice(0, -1).toLowerCase()}`, 'error');
    } else {
      showModal('✅ Éxito', `${(servicePlural || 'Servicio').slice(0, -1)} actualizado correctamente`, 'success');
      cargarServicios();
    }
    setEditandoId(null);
    setEditDescripcion('');
    setEditFotoUrl('');
  };

  const toggleActivo = async (servicio: Servicio) => {
    const nuevoEstado = !servicio.activo;
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    
    showModal(
      `${nuevoEstado ? 'Activar' : 'Desactivar'} ${(servicePlural || 'servicio').slice(0, -1).toLowerCase()}`,
      `¿Estás seguro de ${accion} "${servicio.nombre}"?`,
      'confirm',
      async () => {
        const { error } = await supabase
          .from('services')
          .update({ activo: nuevoEstado })
          .eq('id', servicio.id)
          .eq('barbershop_id', barbershopId);
        
        if (error) {
          showModal('Error', 'No se pudo actualizar el estado', 'error');
        } else {
          showModal('✅ Éxito', `${(servicePlural || 'Servicio').slice(0, -1)} ${nuevoEstado ? 'activado' : 'desactivado'}`, 'success');
          cargarServicios();
        }
      }
    );
  };

  const agregarServicio = async () => {
    if (!nuevoNombre.trim()) {
      showModal('Error', `Ingresa el nombre del ${(servicePlural || 'servicio').slice(0, -1).toLowerCase()}`, 'error');
      return;
    }
    const duracion = parseInt(nuevaDuracion);
    if (isNaN(duracion) || duracion < 5) {
      showModal('Error', 'Duración inválida (mínimo 5 minutos)', 'error');
      return;
    }
    const precio = parseInt(nuevoPrecio);
    if (isNaN(precio) || precio < 1000) {
      showModal('Error', 'Precio inválido (mínimo $1,000 COP)', 'error');
      return;
    }

    setAgregando(true);
    timeoutRef.current = setTimeout(() => {
      setAgregando(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const { error } = await supabase
        .from('services')
        .insert({
          nombre: nuevoNombre.trim(),
          duracion_min: duracion,
          precio: precio,
          activo: true,
          barbershop_id: barbershopId,
          foto_url: nuevaFotoUrl || null,
          descripcion: nuevaDescripcion.trim() || null
        });
      
      if (error) throw error;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      showModal('✅ Éxito', `${(servicePlural || 'Servicio').slice(0, -1)} agregado correctamente`, 'success', () => {
        setNuevoNombre('');
        setNuevaDuracion('');
        setNuevoPrecio('');
        setNuevaDescripcion('');
        setNuevaFotoUrl('');
        setModalVisible(false);
        cargarServicios();
      });

    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      showModal('Error', error.message || `No se pudo agregar el ${(servicePlural || 'servicio').slice(0, -1).toLowerCase()}`, 'error');
    } finally {
      setAgregando(false);
    }
  };

  const eliminarServicio = async (servicio: Servicio) => {
    const { count: citasPendientes, error: citasError } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('service_id', servicio.id)
      .in('estado', ['pendiente', 'confirmada']);

    if (citasError) {
      console.error('Error verificando citas:', citasError);
    }

    if (citasPendientes && citasPendientes > 0) {
      showModal(
        '⚠️ No se puede eliminar',
        `El ${(servicePlural || 'servicio').slice(0, -1).toLowerCase()} tiene ${citasPendientes} cita(s) pendiente(s). Primero debe atender o cancelar estas citas.`,
        'warning'
      );
      return;
    }

    const { count: citasCompletadas, error: completadasError } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('service_id', servicio.id)
      .eq('estado', 'completada');

    const tieneHistorial = (citasCompletadas && citasCompletadas > 0);

    showModal(
      `Eliminar ${(servicePlural || 'servicio').slice(0, -1).toLowerCase()}`,
      `¿Estás seguro de eliminar "${servicio.nombre}"?${tieneHistorial ? '\n\n⚠️ Este servicio tiene historial de citas completadas. El historial se conservará.' : ''}\n\nEsta acción no se puede deshacer.`,
      'confirm',
      async () => {
        const { error } = await supabase
          .from('services')
          .delete()
          .eq('id', servicio.id)
          .eq('barbershop_id', barbershopId);
        
        if (error) {
          showModal('Error', `No se pudo eliminar el ${(servicePlural || 'servicio').slice(0, -1).toLowerCase()}`, 'error');
        } else {
          showModal('✅ Éxito', `${(servicePlural || 'Servicio').slice(0, -1)} eliminado`, 'success');
          cargarServicios();
        }
      }
    );
  };

  const formatPrecio = (precio: number) => {
    return `$${precio.toLocaleString('es-CO')}`;
  };

  const iniciarEdicion = (servicio: Servicio) => {
    hideModal();
    setEditandoId(servicio.id);
    setEditNombre(servicio.nombre);
    setEditDuracion(servicio.duracion_min.toString());
    setEditPrecio(servicio.precio.toString());
    setEditDescripcion(servicio.descripcion || '');
    setEditFotoUrl(servicio.foto_url || '');
  };

  if (loading && !refreshing) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando {(servicePlural || 'servicios').toLowerCase()}...</Text>
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
    >
      <View style={[global.header, { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: spacing.lg }]}>
        <GameButton 
          title={`Agregar ${(servicePlural || 'Servicio').slice(0, -1)}`}
          variant="primary"
          onPress={() => setModalVisible(true)}
          icon="plus"
          compact
        />
      </View>
      
      {/* Estadísticas */}
      <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg }}>
        <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
          <Feather name={getIcon('service') as any} size={20} color={colors.gold} />
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{servicios.length}</Text>
          <Text style={global.textSecondary}>Total</Text>
        </GameCard>
        <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
          <Feather name="check-circle" size={20} color={colors.success} />
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{servicios.filter(s => s.activo).length}</Text>
          <Text style={global.textSecondary}>Activos</Text>
        </GameCard>
        <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
          <Feather name="x-circle" size={20} color={colors.error} />
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{servicios.filter(s => !s.activo).length}</Text>
          <Text style={global.textSecondary}>Inactivos</Text>
        </GameCard>
      </View>
      
      {servicios.length === 0 ? (
        <View style={global.emptyContainer}>
          <Feather name={getIcon('service') as any} size={48} color={colors.textMuted} />
          <Text style={global.emptyText}>No hay {(servicePlural || 'servicios').toLowerCase()} cargados</Text>
          <Text style={global.emptySubtext}>Agrega tu primer {(servicePlural || 'servicio').slice(0, -1).toLowerCase()}</Text>
        </View>
      ) : (
        servicios.map((servicio) => (
          <GameCard 
            key={servicio.id} 
            variant="elevated" 
            style={{ 
              marginHorizontal: spacing.lg, 
              marginBottom: spacing.md, 
              opacity: servicio.activo ? 1 : 0.6,
              borderLeftWidth: 4,
              borderLeftColor: servicio.activo ? colors.success : colors.error,
            }}
          >
            {editandoId === servicio.id ? (
              <View>
                <Text style={{ color: colors.gold, fontSize: 12, marginBottom: spacing.xs }}>Foto del servicio</Text>
                <ImageUploader
                  onImageUploaded={(url) => handleFotoUploaded(url, servicio.id)}
                  onImageDeleted={() => handleFotoDeleted(servicio.id)}
                  currentImage={servicio.foto_url}
                  aspect={[1, 1]}
                />

                <Text style={[global.text, { color: colors.gold, fontSize: 12, marginBottom: spacing.xs, marginTop: spacing.sm }]}>Nombre</Text>
                <TextInput 
                  style={global.input} 
                  value={editNombre} 
                  onChangeText={setEditNombre} 
                  placeholder="Ej: Corte Clásico" 
                  placeholderTextColor={colors.textMuted}
                />
                
                <Text style={[global.text, { color: colors.gold, fontSize: 12, marginBottom: spacing.xs, marginTop: spacing.sm }]}>Duración (minutos)</Text>
                <TextInput 
                  style={global.input} 
                  value={editDuracion} 
                  onChangeText={setEditDuracion} 
                  placeholder="Ej: 30" 
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric" 
                />
                
                <Text style={[global.text, { color: colors.gold, fontSize: 12, marginBottom: spacing.xs, marginTop: spacing.sm }]}>Precio (COP)</Text>
                <TextInput 
                  style={global.input} 
                  value={editPrecio} 
                  onChangeText={setEditPrecio} 
                  placeholder="Ej: 25000" 
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric" 
                />

                <Text style={[global.text, { color: colors.gold, fontSize: 12, marginBottom: spacing.xs, marginTop: spacing.sm }]}>Descripción (opcional)</Text>
                <TextInput 
                  style={[global.input, { textAlignVertical: 'top', minHeight: 80 }]}
                  value={editDescripcion} 
                  onChangeText={setEditDescripcion} 
                  placeholder="Describe el servicio..." 
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
                
                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                  <GameButton title="Guardar" variant="primary" onPress={() => guardarEdicion(servicio.id)} style={{ flex: 1 }} />
                  <GameButton title="Cancelar" variant="danger" onPress={() => {
                    setEditandoId(null);
                    setEditDescripcion('');
                    setEditFotoUrl('');
                  }} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {servicio.foto_url ? (
                  <Image 
                    source={{ uri: servicio.foto_url }} 
                    style={{ width: 70, height: 70, borderRadius: 12 }}
                  />
                ) : (
                  <View style={{ 
                    width: 70, 
                    height: 70, 
                    borderRadius: 12, 
                    backgroundColor: colors.glass,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <Feather name={getIcon('service') as any} size={28} color={colors.textSecondary} />
                  </View>
                )}
                
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                    <Text style={[global.text, { fontSize: 16, fontWeight: 'bold', textDecorationLine: servicio.activo ? 'none' : 'line-through' }]}>
                      {servicio.nombre}
                    </Text>
                    {!servicio.activo && (
                      <View style={[styles.badgeInactivo, { backgroundColor: colors.error }]}>
                        <Text style={styles.badgeInactivoText}>Inactivo</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Feather name="clock" size={12} color={colors.textSecondary} />
                    <Text style={global.textSecondary}>{servicio.duracion_min} min</Text>
                    <Feather name="dollar-sign" size={12} color={colors.gold} />
                    <Text style={{ color: colors.gold, fontWeight: 'bold' }}>{formatPrecio(servicio.precio)}</Text>
                  </View>
                  {servicio.descripcion && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Feather name="file-text" size={10} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                        {servicio.descripcion}
                      </Text>
                    </View>
                  )}
                  
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                    <GameButton 
                      title="Editar"
                      variant="primary"
                      compact
                      icon="edit-2"
                      onPress={() => iniciarEdicion(servicio)}
                      style={{ flex: 1, minWidth: 80 }}
                    />
                    
                    <GameButton 
                      title={servicio.activo ? 'Desactivar' : 'Activar'}
                      variant={servicio.activo ? 'danger' : 'activate'}
                      compact
                      icon={servicio.activo ? "x-circle" : "check-circle"}
                      onPress={() => toggleActivo(servicio)}
                      style={{ flex: 1, minWidth: 90 }}
                    />

                    <GameButton 
                      title="Eliminar"
                      variant="danger"
                      compact
                      icon="trash-2"
                      onPress={() => eliminarServicio(servicio)}
                      style={{ flex: 1, minWidth: 80 }}
                    />
                  </View>
                </View>
              </View>
            )}
          </GameCard>
        ))
      )}

      {/* Modal para agregar servicio */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Agregar {(servicePlural || 'Servicio').slice(0, -1)}</Text>
            
            <Text style={{ color: colors.gold, fontSize: 12, marginBottom: spacing.xs }}>Foto (opcional)</Text>
            <ImageUploader
              onImageUploaded={setNuevaFotoUrl}
              currentImage={nuevaFotoUrl}
              aspect={[1, 1]}
            />

            <Text style={[global.text, { color: colors.gold, fontSize: 12, marginBottom: spacing.xs, marginTop: spacing.sm }]}>Nombre</Text>
            <TextInput 
              style={global.input} 
              placeholder="Ej: Corte Clásico" 
              placeholderTextColor={colors.textMuted}
              value={nuevoNombre} 
              onChangeText={setNuevoNombre} 
            />
            
            <Text style={[global.text, { color: colors.gold, fontSize: 12, marginBottom: spacing.xs, marginTop: spacing.sm }]}>Duración (minutos)</Text>
            <TextInput 
              style={global.input} 
              placeholder="Ej: 30" 
              placeholderTextColor={colors.textMuted}
              value={nuevaDuracion} 
              onChangeText={setNuevaDuracion} 
              keyboardType="numeric" 
            />
            
            <Text style={[global.text, { color: colors.gold, fontSize: 12, marginBottom: spacing.xs, marginTop: spacing.sm }]}>Precio (COP)</Text>
            <TextInput 
              style={global.input} 
              placeholder="Ej: 25000" 
              placeholderTextColor={colors.textMuted}
              value={nuevoPrecio} 
              onChangeText={setNuevoPrecio} 
              keyboardType="numeric" 
            />

            <Text style={[global.text, { color: colors.gold, fontSize: 12, marginBottom: spacing.xs, marginTop: spacing.sm }]}>Descripción (opcional)</Text>
            <TextInput 
              style={[global.input, { textAlignVertical: 'top', minHeight: 80 }]}
              placeholder="Describe el servicio..." 
              placeholderTextColor={colors.textMuted}
              value={nuevaDescripcion} 
              onChangeText={setNuevaDescripcion} 
              multiline
              numberOfLines={3}
            />
            
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <GameButton 
                title="Cancelar"
                variant="danger"
                onPress={() => {
                  setModalVisible(false);
                  setNuevaFotoUrl('');
                  setNuevaDescripcion('');
                }}
              />
              <GameButton 
                title={agregando ? 'Guardando...' : 'Agregar'}
                variant="primary"
                onPress={agregarServicio}
                disabled={agregando}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal personalizado global */}
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

const styles = StyleSheet.create({
  badgeInactivo: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeInactivoText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.85)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    borderRadius: 16, 
    padding: 20, 
    width: '85%', 
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
});
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary';
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';
import { GameCard } from '../styles/components/ui/GameCard';

export default function SeleccionarServicio() {
  const { colors, global, spacing } = useGameStyles();
  const { serviceName, servicePlural, getIcon } = useBusinessDictionary();
  
  const params = useLocalSearchParams();
  const barberoId = params.barberoId as string;
  const barberoNombre = params.barberoNombre as string;
  
  const [servicios, setServicios] = useState<any[]>([]);
  const [servicioId, setServicioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<any>(null);

  const timeoutRef = useRef<number | null>(null);

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
    if (!barberoId) {
      console.error('❌ Error: No se recibió barberoId');
      showModal('Error', 'No se pudo identificar el barbero', 'error', () => router.back());
      return;
    }
    cargarServicios();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [barberoId]);

  const cargarServicios = async () => {
    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const { data: barberoData, error: barberoError } = await supabase
        .from('barbers')
        .select('id, nombre, activo, archivado')
        .eq('id', barberoId)
        .single();

      if (barberoError || !barberoData) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        showModal('Error', `El barbero seleccionado no existe`, 'error', () => router.back());
        return;
      }

      if (!barberoData.activo || barberoData.archivado) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        showModal('Error', `${barberoNombre} no está disponible actualmente`, 'error', () => router.back());
        return;
      }

      const { data: barberServices, error: barberError } = await supabase
        .from('barber_services')
        .select('service_id')
        .eq('barber_id', barberoId);
      
      if (barberError) throw barberError;
      
      const serviceIds = barberServices?.map(bs => bs.service_id) || [];
      
      if (serviceIds.length === 0) {
        setServicios([]);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setLoading(false);
        return;
      }
      
      const { data: serviciosData, error: serviciosError } = await supabase
        .from('services')
        .select('id, nombre, duracion_min, precio, activo, foto_url, descripcion')
        .in('id', serviceIds)
        .order('activo', { ascending: false })
        .order('nombre');
      
      if (serviciosError) throw serviciosError;
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setServicios(serviciosData || []);
      
    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('❌ Error cargando servicios:', error);
      showModal('Error', error.message || 'No se pudieron cargar los servicios', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarServicios();
  }, [barberoId]);

  const verDetalle = (servicio: any) => {
    setServicioSeleccionado(servicio);
    setModalVisible(true);
  };

  const seleccionarDesdeModal = () => {
    if (servicioSeleccionado && servicioSeleccionado.activo) {
      setServicioId(servicioSeleccionado.id);
      setModalVisible(false);
    } else if (servicioSeleccionado && !servicioSeleccionado.activo) {
      showModal(
        '⚠️ Servicio no disponible',
        `${servicioSeleccionado.nombre} no está disponible actualmente. Pronto estará de vuelta.`,
        'warning'
      );
    }
  };

  const continuar = () => {
    if (!servicioId) return;
    const servicio = servicios.find(s => s.id === servicioId);
    if (!servicio?.activo) {
      showModal(`${(serviceName || 'Servicio')} no disponible`, `Este ${(serviceName || 'servicio').toLowerCase()} no está activo actualmente`, 'warning');
      return;
    }
    
    router.push({
      pathname: '/(cliente)/seleccionar-horario',
      params: {
        barberoId,
        barberoNombre: barberoNombre,
        servicioId,
        servicioNombre: servicio?.nombre,
        servicioDuracion: String(servicio?.duracion_min),
        servicioPrecio: String(servicio?.precio),
      }
    });
  };

  const handlePressServicio = (serv: any) => {
    if (serv.activo) {
      verDetalle(serv);
    } else {
      showModal(
        '⏳ Servicio en mantenimiento',
        `${serv.nombre} no está disponible por el momento. ¡Pronto volverá!`,
        'warning'
      );
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando {(servicePlural || 'servicios').toLowerCase()} disponibles...</Text>
      </View>
    );
  }

  if (servicios.length === 0 && !loading) {
    return (
      <View style={global.container}>
        <View style={[global.header, { alignItems: 'center', justifyContent: 'center' }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', left: spacing.lg, padding: 4 }}>
            <Feather name="arrow-left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Feather name={getIcon('service') as any} size={20} color={colors.gold} />
            <Text style={global.headerTitle}>{servicePlural || 'Servicios'}</Text>
          </View>
        </View>
        
        <ScrollView
          contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
        >
          <View style={{ alignItems: 'center', padding: spacing.xl }}>
            <Feather name="alert-circle" size={64} color={colors.textMuted} />
            <Text style={global.emptyText}>Este barbero no tiene {(servicePlural || 'servicios').toLowerCase()} activos</Text>
            <Text style={global.emptySubtext}>El administrador debe asignarle {(servicePlural || 'servicios').toLowerCase()}</Text>
            <GameButton 
              title="Volver"
              variant="primary"
              onPress={() => router.back()}
              style={{ marginTop: spacing.xl }}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  const serviciosActivos = servicios.filter(s => s.activo === true);
  const serviciosInactivos = servicios.filter(s => s.activo === false);

  return (
    <View style={global.container}>
      <View style={[global.header, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Feather name={getIcon('service') as any} size={20} color={colors.gold} />
            <Text style={global.headerTitle}>Elige {(serviceName || 'servicio').toLowerCase()}</Text>
          </View>
          <Text style={[global.headerSubtitle, { marginTop: 2 }]}>{barberoNombre}</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
          <Feather name="refresh-cw" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={{ padding: spacing.lg }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        {serviciosActivos.map((serv) => {
          const isSelected = servicioId === serv.id;
          return (
            <TouchableOpacity
              key={serv.id}
              activeOpacity={0.7}
              onPress={() => handlePressServicio(serv)}
            >
              <GameCard 
                variant={isSelected ? "game" : "elevated"} 
                style={{ 
                  marginBottom: spacing.md,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? colors.primary : 'rgba(255,107,53,0.2)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  {serv.foto_url ? (
                    <Image 
                      source={{ uri: serv.foto_url }} 
                      style={{ width: 60, height: 60, borderRadius: 12 }}
                    />
                  ) : (
                    <View style={{ 
                      width: 60, 
                      height: 60, 
                      borderRadius: 12, 
                      backgroundColor: colors.glass,
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      <Feather name={getIcon('service') as any} size={28} color={colors.textSecondary} />
                    </View>
                  )}
                  
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', flex: 1 }}>
                        {serv.nombre}
                      </Text>
                      {isSelected && (
                        <View style={{ 
                          backgroundColor: colors.primary, 
                          borderRadius: 12, 
                          paddingHorizontal: 6, 
                          paddingVertical: 2 
                        }}>
                          <Text style={{ color: colors.text, fontSize: 10, fontWeight: 'bold' }}>✓ SELECCIONADO</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Feather name="clock" size={12} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{serv.duracion_min} min</Text>
                      <Feather name="dollar-sign" size={12} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>${serv.precio.toLocaleString('es-CO')}</Text>
                    </View>
                    {serv.descripcion && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Feather name="file-text" size={10} color={colors.textMuted} />
                        <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                          {serv.descripcion}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </GameCard>
            </TouchableOpacity>
          );
        })}

        {serviciosInactivos.length > 0 && (
          <>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: spacing.sm, 
              marginVertical: spacing.md,
              marginHorizontal: spacing.sm,
            }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.glassBorder }} />
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: 'bold' }}>
                ⏳ No disponible por ahora
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.glassBorder }} />
            </View>

            {serviciosInactivos.map((serv) => (
              <TouchableOpacity
                key={serv.id}
                activeOpacity={0.9}
                onPress={() => handlePressServicio(serv)}
              >
                <GameCard 
                  variant="elevated" 
                  style={{ 
                    marginBottom: spacing.md,
                    borderWidth: 1,
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    opacity: 0.7,
                    backgroundColor: colors.glass,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    {serv.foto_url ? (
                      <Image 
                        source={{ uri: serv.foto_url }} 
                        style={{ width: 60, height: 60, borderRadius: 12, opacity: 0.5 }}
                      />
                    ) : (
                      <View style={{ 
                        width: 60, 
                        height: 60, 
                        borderRadius: 12, 
                        backgroundColor: colors.glass,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Feather name={getIcon('service') as any} size={28} color={colors.textMuted} />
                      </View>
                    )}
                    
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ 
                          color: colors.textMuted, 
                          fontSize: 16, 
                          fontWeight: 'bold',
                          textDecorationLine: 'line-through',
                        }}>
                          {serv.nombre}
                        </Text>
                        <View style={{ 
                          backgroundColor: colors.warning, 
                          paddingHorizontal: 6, 
                          paddingVertical: 2, 
                          borderRadius: 8,
                        }}>
                          <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>PRÓXIMAMENTE</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Feather name="clock" size={12} color={colors.textMuted} />
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{serv.duracion_min} min</Text>
                        <Feather name="dollar-sign" size={12} color={colors.textMuted} />
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>${serv.precio.toLocaleString('es-CO')}</Text>
                      </View>
                      {serv.descripcion && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Feather name="file-text" size={10} color={colors.textMuted} />
                          <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                            {serv.descripcion}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <Feather name="clock" size={16} color={colors.warning} />
                  </View>
                </GameCard>
              </TouchableOpacity>
            ))}
          </>
        )}
        
        <GameButton 
          title={servicioId ? 'Continuar' : `Selecciona un ${(serviceName || 'servicio').toLowerCase()}`}
          variant="primary"
          onPress={continuar}
          disabled={!servicioId}
          style={{ marginTop: spacing.lg, marginBottom: spacing['3xl'] }}
        />
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <TouchableOpacity 
              style={[styles.closeButton, { backgroundColor: colors.error }]}
              onPress={() => setModalVisible(false)}
            >
              <Feather name="x" size={18} color="white" />
            </TouchableOpacity>

            {servicioSeleccionado && (
              <>
                {servicioSeleccionado.foto_url ? (
                  <Image 
                    source={{ uri: servicioSeleccionado.foto_url }} 
                    style={[styles.modalImage, { opacity: servicioSeleccionado.activo ? 1 : 0.5 }]}
                  />
                ) : (
                  <View style={[styles.modalImage, { backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' }]}>
                    <Feather name={getIcon('service') as any} size={48} color={colors.textSecondary} />
                  </View>
                )}

                <Text style={[styles.modalTitle, { color: servicioSeleccionado.activo ? colors.text : colors.textMuted }]}>
                  {servicioSeleccionado.nombre}
                  {!servicioSeleccionado.activo && (
                    <Text style={{ fontSize: 14, color: colors.warning, marginLeft: 8 }}> (No disponible)</Text>
                  )}
                </Text>

                <View style={styles.modalInfoRow}>
                  <View style={[styles.modalInfoBadge, { backgroundColor: colors.glass }]}>
                    <Feather name="clock" size={14} color={colors.gold} />
                    <Text style={[styles.modalInfoText, { color: colors.gold }]}>
                      {servicioSeleccionado.duracion_min} min
                    </Text>
                  </View>
                  <View style={[styles.modalInfoBadge, { backgroundColor: colors.glass }]}>
                    <Feather name="dollar-sign" size={14} color={colors.gold} />
                    <Text style={[styles.modalInfoText, { color: colors.gold }]}>
                      ${servicioSeleccionado.precio.toLocaleString('es-CO')}
                    </Text>
                  </View>
                </View>

                {servicioSeleccionado.descripcion && (
                  <View style={styles.modalDescSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Feather name="file-text" size={14} color={colors.primary} />
                      <Text style={[styles.modalDescTitle, { color: colors.primary }]}>Descripción</Text>
                    </View>
                    <Text style={[styles.modalDescText, { color: colors.textSecondary }]}>
                      {servicioSeleccionado.descripcion}
                    </Text>
                  </View>
                )}

                <View style={styles.modalButtons}>
                  <View style={{ flex: 1 }}>
                    <GameButton 
                      title="Cancelar"
                      variant="danger"
                      onPress={() => setModalVisible(false)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <GameButton 
                      title={servicioSeleccionado.activo ? "Seleccionar" : "No disponible"}
                      variant={servicioSeleccionado.activo ? "primary" : "secondary"}
                      onPress={seleccionarDesdeModal}
                      disabled={!servicioSeleccionado.activo}
                    />
                  </View>
                </View>
              </>
            )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 20,
    resizeMode: 'cover',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold' as const,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  modalInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalInfoText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  modalDescSection: {
    marginBottom: 24,
  },
  modalDescTitle: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    marginBottom: 6,
  },
  modalDescText: {
    fontSize: 13,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
});
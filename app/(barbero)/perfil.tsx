import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary'; // 🔥 NUEVO
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';
import { GameCard } from '../styles/components/ui/GameCard';
import { ImageUploader } from '../styles/components/ui/ImageUploader';

export default function PerfilBarbero() {
  const { colors, global, spacing } = useGameStyles();
  // 🔥 NUEVO: Hook de multi-tenant
  const { employeeName, servicePlural, getIcon } = useBusinessDictionary();
  
  const [barberoData, setBarberoData] = useState<any>(null);
  const [servicios, setServicios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<any>(null);
  
  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [yaCambioPassword, setYaCambioPassword] = useState(false);

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
    cargarDatosBarbero();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const cargarDatosBarbero = async () => {
    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const barberoId = await storage.getItem('barbero_id');
      
      if (!barberoId) {
        console.error('❌ No se encontró barbero_id en sesión');
        showModal('Error', 'No hay sesión activa. Inicia sesión nuevamente.', 'error', () => {
          router.replace('/(auth)/login');
        });
        return;
      }

      const keyPassword = `barbero_password_${barberoId}`;
      const contrasenaGuardada = await storage.getItem(keyPassword);
      
      if (contrasenaGuardada) {
        setYaCambioPassword(true);
      }

      const { data: barbero, error: barberoError } = await supabase
        .from('barbers')
        .select('*')
        .eq('id', barberoId)
        .single();

      if (barberoError) throw barberoError;
      
      setBarberoData(barbero);

      await cargarServiciosBarbero(barberoId);

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

  const cargarServiciosBarbero = async (barberoId: string) => {
    try {
      const { data: asignaciones, error: asignError } = await supabase
        .from('barber_services')
        .select('service_id')
        .eq('barber_id', barberoId);

      if (asignError) throw asignError;

      if (!asignaciones || asignaciones.length === 0) {
        setServicios([]);
        return;
      }

      const serviceIds = asignaciones.map(a => a.service_id);

      const { data: serviciosData, error: servError } = await supabase
        .from('services')
        .select('*')
        .in('id', serviceIds)
        .eq('activo', true)
        .order('nombre');

      if (servError) throw servError;

      setServicios(serviciosData || []);

    } catch (error) {
      console.error('Error cargando servicios del barbero:', error);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarDatosBarbero();
  }, []);

  const handleFotoUploaded = async (url: string) => {
    try {
      const barberoId = barberoData?.id;
      if (!barberoId) return;

      const { error } = await supabase
        .from('barbers')
        .update({ foto_url: url })
        .eq('id', barberoId);

      if (error) throw error;

      setBarberoData({ ...barberoData, foto_url: url });
      showModal('✅ Foto actualizada', 'Tu foto de perfil ha sido actualizada', 'success');
    } catch (error) {
      console.error('Error guardando foto:', error);
      showModal('Error', 'No se pudo guardar la foto de perfil', 'error');
    }
  };

  const handleFotoDeleted = async () => {
    try {
      const barberoId = barberoData?.id;
      if (!barberoId) return;

      const { error } = await supabase
        .from('barbers')
        .update({ foto_url: null })
        .eq('id', barberoId);

      if (error) throw error;

      setBarberoData({ ...barberoData, foto_url: null });
      showModal('✅ Foto eliminada', 'Tu foto de perfil ha sido eliminada', 'success');
    } catch (error) {
      console.error('Error eliminando foto:', error);
      showModal('Error', 'No se pudo eliminar la foto de perfil', 'error');
    }
  };

  const verificarContrasenaActual = async (contrasena: string): Promise<boolean> => {
    const key = `barbero_password_${barberoData?.id}`;
    const contrasenaGuardadaStorage = await storage.getItem(key);
    const telefonoBarbero = barberoData?.telefono;
    const contrasenaGuardadaBD = barberoData?.password;
    
    if (contrasenaGuardadaStorage) {
      return contrasena === contrasenaGuardadaStorage;
    }
    
    if (contrasenaGuardadaBD) {
      return contrasena === contrasenaGuardadaBD;
    }
    
    return contrasena === telefonoBarbero;
  };

  const cambiarPassword = async () => {
    if (!passwordActual) {
      showModal('Error', 'Ingresa tu contraseña actual', 'error');
      return;
    }
    if (nuevaPassword.length < 6) {
      showModal('Error', 'La nueva contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      showModal('Error', 'Las nuevas contraseñas no coinciden', 'error');
      return;
    }

    setCambiandoPassword(true);
    
    try {
      const contrasenaActualValida = await verificarContrasenaActual(passwordActual);
      
      if (!contrasenaActualValida) {
        showModal('Error', 'Contraseña actual incorrecta', 'error');
        setCambiandoPassword(false);
        return;
      }

      const key = `barbero_password_${barberoData?.id}`;
      
      await storage.setItem(key, nuevaPassword);
      
      const { error: updateError } = await supabase
        .from('barbers')
        .update({ password: nuevaPassword })
        .eq('id', barberoData?.id);
      
      if (updateError) {
        console.error('Error guardando en BD:', updateError);
      }
      
      setBarberoData({ ...barberoData, password: nuevaPassword });
      setYaCambioPassword(true);
      
      showModal('✅ Contraseña actualizada', 'Tu contraseña ha sido cambiada exitosamente.', 'success');
      
      setShowPasswordForm(false);
      setPasswordActual('');
      setNuevaPassword('');
      setConfirmarPassword('');
      
    } catch (error: any) {
      showModal('Error', error.message || 'No se pudo cambiar la contraseña', 'error');
    } finally {
      setCambiandoPassword(false);
    }
  };

  const handleLogout = () => {
    showModal('Cerrar sesión', '¿Estás seguro de que quieres salir?', 'confirm', async () => {
      const barberoId = barberoData?.id;
      const keysToRemove = [
        'barbero_id', 
        'barbero_nombre', 
        'barbero_telefono', 
        'barbero_barbershop_id',
        'user_rol'
      ];
      
      if (barberoId) {
        keysToRemove.push(`barbero_password_${barberoId}`);
      }
      
      await storage.multiRemove(keysToRemove);
      router.replace('/(auth)/login');
    });
  };

  const abrirModalServicio = (servicio: any) => {
    setServicioSeleccionado(servicio);
    setModalVisible(true);
  };

  if (loading && !refreshing) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!barberoData) {
    return (
      <View style={global.container}>
        <Text style={global.emptyText}>No se pudieron cargar los datos</Text>
        <GameButton 
          title="Volver al login"
          variant="secondary"
          onPress={() => router.replace('/(auth)/login')}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  const nombreMostrar = barberoData?.nombre || employeeName || 'Empleado';
  const telefonoMostrar = barberoData?.telefono || 'No disponible';
  const calificacionPromedio = barberoData?.calificacion_promedio || 0;
  const estrellas = '⭐'.repeat(Math.floor(calificacionPromedio)) + '☆'.repeat(5 - Math.floor(calificacionPromedio));

  return (
    <>
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
            currentImage={barberoData?.foto_url}
            aspect={[1, 1]}
          />
        </View>

        <View style={[global.header, { marginBottom: spacing.xl }]}>
          <Text style={global.headerTitle}>{nombreMostrar}</Text>
          <Text style={global.headerSubtitle}>{employeeName || 'Empleado'}</Text>
        </View>

        <GameCard variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Feather name="phone" size={16} color={colors.gold} />
            <Text style={global.textSecondary}>Teléfono</Text>
          </View>
          <Text style={global.text}>{telefonoMostrar}</Text>
        </GameCard>

        <GameCard variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Feather name="clock" size={16} color={colors.gold} />
            <Text style={global.textSecondary}>Horario de atención</Text>
          </View>
          <Text style={global.text}>
            {barberoData?.horario_inicio || '09:00'} - {barberoData?.horario_fin || '19:00'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>
            📝 Puedes solicitar cambios al administrador
          </Text>
        </GameCard>

        <GameCard variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Feather name="circle" size={16} color={barberoData?.activo ? colors.success : colors.error} />
            <Text style={global.textSecondary}>Estado</Text>
          </View>
          <Text style={[global.text, barberoData?.activo ? { color: colors.success } : { color: colors.error }]}>
            {barberoData?.activo ? 'Activo' : 'Inactivo'}
          </Text>
          {!barberoData?.activo && (
            <Text style={{ color: colors.warning, fontSize: 12, marginTop: 4 }}>
              ⚠️ Contacta al administrador para reactivar tu cuenta
            </Text>
          )}
        </GameCard>

        <GameCard variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Feather name="star" size={16} color={colors.gold} />
            <Text style={global.textSecondary}>Calificación promedio</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }}>
            <Text style={[global.headerTitle, { fontSize: 18, color: colors.gold }]}>
              {calificacionPromedio > 0 ? calificacionPromedio.toFixed(1) : 'Sin calificaciones'}
            </Text>
            {calificacionPromedio > 0 && (
              <Text style={{ fontSize: 16, color: colors.gold }}>{estrellas}</Text>
            )}
          </View>
          {calificacionPromedio > 0 && (
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>
              Basado en {barberoData?.total_reseñas || 0} reseña{barberoData?.total_reseñas !== 1 ? 's' : ''}
            </Text>
          )}
        </GameCard>

        <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Feather name={getIcon('service') as any} size={20} color={colors.gold} />
            <Text style={[global.text, { fontSize: 16, fontWeight: 'bold' }]}>Mis {servicePlural || 'Servicios'}</Text>
          </View>
          
          {servicios.length === 0 ? (
            <GameCard variant="elevated">
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                No tienes {(servicePlural || 'servicios').toLowerCase()} asignados aún
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.xs }}>
                Consulta con el administrador
              </Text>
            </GameCard>
          ) : (
            servicios.map((servicio) => (
              <TouchableOpacity
                key={servicio.id}
                activeOpacity={0.7}
                onPress={() => abrirModalServicio(servicio)}
              >
                <GameCard variant="elevated" style={{ marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    {servicio.foto_url ? (
                      <Image 
                        source={{ uri: servicio.foto_url }} 
                        style={{ width: 50, height: 50, borderRadius: 10 }}
                      />
                    ) : (
                      <View style={{ 
                        width: 50, 
                        height: 50, 
                        borderRadius: 10, 
                        backgroundColor: colors.glass,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Feather name={getIcon('service') as any} size={24} color={colors.gold} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[global.text, { fontWeight: 'bold' }]}>{servicio.nombre}</Text>
                        <Feather name="info" size={16} color={colors.primary} />
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        ⏱️ {servicio.duracion_min} min • ${servicio.precio.toLocaleString('es-CO')}
                      </Text>
                    </View>
                  </View>
                </GameCard>
              </TouchableOpacity>
            ))
          )}
        </View>

        {!showPasswordForm ? (
          <GameButton 
            title="🔐 Cambiar contraseña"
            variant="secondary"
            onPress={() => setShowPasswordForm(true)}
            style={{ marginVertical: spacing.md, marginHorizontal: spacing.lg }}
          />
        ) : (
          <GameCard variant="game" style={{ marginVertical: spacing.md, marginHorizontal: spacing.lg }}>
            <Text style={[global.textSecondary, { textAlign: 'center', marginBottom: spacing.md }]}>
              {yaCambioPassword 
                ? '📝 Ingresa tu contraseña actual y la nueva contraseña' 
                : '📝 Tu contraseña actual es tu número de teléfono. Cámbiala por una nueva.'}
            </Text>
            
            <TextInput
              style={global.input}
              placeholder="Contraseña actual"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={passwordActual}
              onChangeText={setPasswordActual}
            />
            
            <TextInput
              style={global.input}
              placeholder="Nueva contraseña (mínimo 6 caracteres)"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={nuevaPassword}
              onChangeText={setNuevaPassword}
            />
            
            <TextInput
              style={global.input}
              placeholder="Confirmar nueva contraseña"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={confirmarPassword}
              onChangeText={setConfirmarPassword}
            />
            
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <GameButton 
                title="Cancelar"
                variant="danger"
                onPress={() => setShowPasswordForm(false)}
                style={{ flex: 1 }}
              />
              <GameButton 
                title={cambiandoPassword ? 'Guardando...' : 'Guardar'}
                variant="primary"
                onPress={cambiarPassword}
                disabled={cambiandoPassword}
                style={{ flex: 1 }}
              />
            </View>
          </GameCard>
        )}

        <GameButton 
          title="🚪 Cerrar sesión"
          variant="danger"
          onPress={handleLogout}
          style={{ marginTop: spacing.xl, marginBottom: spacing['3xl'], marginHorizontal: spacing.lg }}
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
                    style={styles.modalImage}
                  />
                ) : (
                  <View style={[styles.modalImage, { backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' }]}>
                    <Feather name={getIcon('service') as any} size={48} color={colors.textSecondary} />
                  </View>
                )}

                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {servicioSeleccionado.nombre}
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
                      title="Cerrar"
                      variant="primary"
                      onPress={() => setModalVisible(false)}
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
    </>
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
    fontWeight: 'bold',
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
    fontWeight: '600',
  },
  modalDescSection: {
    marginBottom: 24,
  },
  modalDescTitle: {
    fontSize: 14,
    fontWeight: 'bold',
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
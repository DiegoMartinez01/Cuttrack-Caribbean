import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../services/supabase/client';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary';
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';

interface Barbero {
  id: string;
  nombre: string;
  telefono: string;
  activo: boolean;
  archivado: boolean;
  horario_inicio: string;
  horario_fin: string;
  foto_url?: string;
  created_at: string;
  descanso_inicio?: string;
  descanso_fin?: string;
  tieneCitasPendientes?: boolean;
}

export default function BarberosScreen() {
  const { colors, global, spacing } = useGameStyles();
  const { employeePlural, getIcon } = useBusinessDictionary();
  
  const [barberosActivos, setBarberosActivos] = useState<Barbero[]>([]);
  const [barberosArchivados, setBarberosArchivados] = useState<Barbero[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  
  const [modalHorarioVisible, setModalHorarioVisible] = useState(false);
  const [barberoEditando, setBarberoEditando] = useState<Barbero | null>(null);
  const [horarioInicio, setHorarioInicio] = useState('09:00');
  const [horarioFin, setHorarioFin] = useState('19:00');
  const [guardandoHorario, setGuardandoHorario] = useState(false);

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

  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    cargarBarberos();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const cargarBarberos = async () => {
    setCargandoLista(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('No hay usuario logueado');

      const { data: adminUser } = await supabase
        .from('users')
        .select('barbershop_id')
        .eq('id', userData.user.id)
        .single();

      if (!adminUser?.barbershop_id) {
        throw new Error('No se encontró el negocio');
      }

      setBarbershopId(adminUser.barbershop_id);

      const { data, error } = await supabase
        .from('barbers')
        .select('*')
        .eq('barbershop_id', adminUser.barbershop_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const barberosConEstado = await Promise.all((data || []).map(async (b) => {
        let tieneCitasPendientes = false;
        
        if (!b.archivado && b.activo) {
          const { count, error: countError } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('barbero_id', b.id)
            .in('estado', ['pendiente', 'confirmada']);
          
          if (!countError && count && count > 0) {
            tieneCitasPendientes = true;
          }
        }
        
        return { ...b, tieneCitasPendientes };
      }));
      
      setBarberosActivos(barberosConEstado.filter(b => !b.archivado && b.activo) || []);
      setBarberosArchivados(barberosConEstado.filter(b => b.archivado || !b.activo) || []);
      
    } catch (error: any) {
      console.error('Error al cargar empleados:', error);
      showModal('Error', error.message || 'No se pudieron cargar los empleados', 'error');
    } finally {
      setCargandoLista(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarBarberos();
  }, []);

  const confirmarAgregarBarbero = async () => {
    if (!nombre.trim()) {
      showModal('Error', `El nombre del ${(employeePlural || 'empleado').slice(0, -1).toLowerCase()} es obligatorio`, 'error');
      return;
    }
    if (!telefono.trim()) {
      showModal('Error', `El teléfono del ${(employeePlural || 'empleado').slice(0, -1).toLowerCase()} es obligatorio`, 'error');
      return;
    }
    if (telefono.replace(/[^0-9]/g, '').length < 10) {
      showModal('Error', 'Ingresa un número de teléfono válido (10 dígitos)', 'error');
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const { data: existeBarbero } = await supabase
        .from('barbers')
        .select('id')
        .eq('telefono', telefono.trim())
        .maybeSingle();

      if (existeBarbero) {
        throw new Error(`Este número de teléfono ya está registrado como ${(employeePlural || 'empleado').slice(0, -1).toLowerCase()}`);
      }

      const passwordTemp = telefono.replace(/[^0-9]/g, '');
      const emailFalso = `${passwordTemp}@empleado.cuttrack`;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailFalso,
        password: passwordTemp,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Error al crear usuario');

      const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .insert({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          barbershop_id: barbershopId,
          activo: true,
          archivado: false,
          horario_inicio: '09:00',
          horario_fin: '19:00',
        })
        .select()
        .single();

      if (barberError) throw barberError;

      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: emailFalso,
          telefono: telefono.trim(),
          nombre: nombre.trim(),
          rol: 'barber',
          barbershop_id: barbershopId,
          barbero_id: barber.id,
        });

      if (userError) throw userError;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      showModal(
        `✅ ${(employeePlural || 'Empleado').slice(0, -1)} agregado`,
        `${nombre} ha sido registrado exitosamente.\n📱 Usuario: ${telefono}\n🔑 Contraseña: ${passwordTemp}`,
        'success',
        () => {
          setNombre('');
          setTelefono('');
          setModalVisible(false);
          cargarBarberos();
        }
      );

    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('❌ Error al agregar empleado:', error);
      showModal('Error', error.message || 'Error al crear empleado', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 FUNCIÓN CORREGIDA - El modal ahora se cierra correctamente
  const desactivarBarbero = async (barbero: Barbero) => {
    const { data: citasPendientes, error: citasError } = await supabase
      .from('appointments')
      .select('id')
      .eq('barbero_id', barbero.id)
      .in('estado', ['pendiente', 'confirmada']);

    if (citasError) {
      console.error('Error verificando citas:', citasError);
      showModal('Error', 'No se pudieron verificar las citas', 'error');
      return;
    }

    if (citasPendientes && citasPendientes.length > 0) {
      router.push({
        pathname: '/(admin)/reasignar-citas/[id]',
        params: { id: barbero.id, origen: 'archivar' }
      });
      return;
    }

    showModal(
      `Archivar ${(employeePlural || 'empleado').slice(0, -1).toLowerCase()}`,
      `¿Estás seguro de archivar a ${barbero.nombre}? Esta acción es irreversible.`,
      'confirm',
      async () => {
        try {
          const { error } = await supabase
            .from('barbers')
            .update({ 
              activo: false, 
              archivado: true,
              archivado_en: new Date().toISOString()
            })
            .eq('id', barbero.id);

          if (error) throw error;
          
          // 🔥 Cerrar modal de confirmación antes de mostrar éxito
          hideModal();
          
          await cargarBarberos();
          showModal(`✅ ${(employeePlural || 'Empleado').slice(0, -1)} archivado`, `${barbero.nombre} ha sido archivado.`, 'success');
        } catch (error: any) {
          hideModal();
          showModal('Error', error.message, 'error');
        }
      }
    );
  };

  const eliminarBarberoPermanente = async (barbero: Barbero) => {
    const { data: citasPendientes, error: citasError } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('barbero_id', barbero.id)
      .in('estado', ['pendiente', 'confirmada']);

    if (citasError) {
      console.error('Error verificando citas:', citasError);
    }

    if (Array.isArray(citasPendientes) && citasPendientes.length > 0) {
      showModal(
        '⚠️ No se puede eliminar',
        `El ${(employeePlural || 'empleado').slice(0, -1).toLowerCase()} tiene ${citasPendientes.length} cita(s) pendiente(s).`,
        'warning'
      );
      return;
    }

    const { data: citasCompletadas } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('barbero_id', barbero.id)
      .eq('estado', 'completada');

    const tieneHistorial = citasCompletadas && citasCompletadas.length > 0;

    showModal(
      `Eliminar ${(employeePlural || 'empleado').slice(0, -1).toLowerCase()}`,
      `¿Estás seguro de eliminar a "${barbero.nombre}"?${tieneHistorial ? '\n\n⚠️ Este empleado tiene historial de citas completadas.' : ''}\n\nEsta acción no se puede deshacer.`,
      'confirm',
      async () => {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('barbero_id', barbero.id)
          .single();
        
        if (userData) {
          await supabase.auth.admin.deleteUser(userData.id);
          await supabase.from('users').delete().eq('barbero_id', barbero.id);
        }
        
        const { error } = await supabase
          .from('barbers')
          .delete()
          .eq('id', barbero.id)
          .eq('barbershop_id', barbershopId);
        
        if (error) {
          showModal('Error', 'No se pudo eliminar el empleado', 'error');
        } else {
          cargarBarberos();
          showModal(`✅ ${(employeePlural || 'Empleado').slice(0, -1)} eliminado`, `${barbero.nombre} ha sido eliminado permanentemente.`, 'success');
        }
      }
    );
  };

  const asignarServicios = (barberoId: string, barberoNombre: string) => {
    router.push({
      pathname: '/(admin)/asignar-servicios/[id]',
      params: { id: barberoId, nombre: barberoNombre }
    });
  };

  const abrirModalHorario = (barbero: Barbero) => {
    setBarberoEditando(barbero);
    setHorarioInicio(barbero.horario_inicio || '09:00');
    setHorarioFin(barbero.horario_fin || '19:00');
    setModalHorarioVisible(true);
  };

  const guardarHorario = async () => {
    if (!barberoEditando) return;
    
    if (horarioInicio >= horarioFin) {
      showModal('Error', 'La hora de inicio debe ser menor que la hora de fin', 'error');
      return;
    }
    
    setGuardandoHorario(true);
    
    try {
      const [nuevaHoraInicio, nuevaHoraInicioMin] = horarioInicio.split(':').map(Number);
      const [nuevaHoraFin, nuevaHoraFinMin] = horarioFin.split(':').map(Number);
      
      const { data: citasPendientes, error: citasError } = await supabase
        .from('appointments')
        .select('id, fecha_hora')
        .eq('barbero_id', barberoEditando.id)
        .eq('estado', 'pendiente')
        .gte('fecha_hora', new Date().toISOString().split('T')[0]);
      
      if (citasError) throw citasError;
      
      const citasFueraHorario = citasPendientes?.filter(cita => {
        const fechaCita = new Date(cita.fecha_hora);
        const horaCita = fechaCita.getHours();
        const minCita = fechaCita.getMinutes();
        
        const horaInicioNum = nuevaHoraInicio + (nuevaHoraInicioMin || 0) / 60;
        const horaFinNum = nuevaHoraFin + (nuevaHoraFinMin || 0) / 60;
        const horaCitaNum = horaCita + minCita / 60;
        
        return horaCitaNum < horaInicioNum || horaCitaNum >= horaFinNum;
      }) || [];
      
      if (citasFueraHorario.length > 0) {
        setModalHorarioVisible(false);
        
        setCustomModal({
          visible: true,
          title: '⚠️ Horario conflictivo',
          message: `${citasFueraHorario.length} cita(s) quedarán fuera del nuevo horario de ${horarioInicio} a ${horarioFin}. ¿Deseas reasignarlas?`,
          type: 'confirm',
          onConfirm: () => {
            router.push({
              pathname: '/(admin)/reasignar-citas/[id]',
              params: { 
                id: barberoEditando.id, 
                origen: 'horario',
                nuevoHorarioInicio: horarioInicio,
                nuevoHorarioFin: horarioFin
              }
            });
          }
        });
        
        setGuardandoHorario(false);
        return;
      }
      
      const { error } = await supabase
        .from('barbers')
        .update({
          horario_inicio: horarioInicio,
          horario_fin: horarioFin,
        })
        .eq('id', barberoEditando.id);
      
      if (error) throw error;
      
      showModal('✅ Horario actualizado', `Horario de ${barberoEditando.nombre} actualizado`, 'success', () => {
        cargarBarberos();
        setModalHorarioVisible(false);
        setBarberoEditando(null);
      });
      
    } catch (error: any) {
      showModal('Error', error.message || 'No se pudo actualizar el horario', 'error');
    } finally {
      setGuardandoHorario(false);
    }
  };

  const eliminarDescanso = async (barbero: Barbero) => {
    showModal(
      'Terminar descanso',
      `¿Quieres que ${barbero.nombre} termine su descanso antes de lo previsto?`,
      'confirm',
      async () => {
        const { error } = await supabase
          .from('barbers')
          .update({ descanso_inicio: null, descanso_fin: null })
          .eq('id', barbero.id);
        
        if (error) {
          showModal('Error', 'No se pudo terminar el descanso', 'error');
        } else {
          showModal('✅ Descanso terminado', `${barbero.nombre} ya está disponible nuevamente`, 'success');
          cargarBarberos();
        }
      }
    );
  };

  const estaEnDescanso = (barbero: Barbero): boolean => {
    if (!barbero.descanso_inicio || !barbero.descanso_fin) return false;
    const hoy = new Date().toISOString().split('T')[0];
    return barbero.descanso_inicio <= hoy && barbero.descanso_fin >= hoy;
  };

  const renderBarberoActivo = ({ item }: { item: Barbero }) => {
    const enDescanso = estaEnDescanso(item);
    const tieneCitas = item.tieneCitasPendientes;
    
    return (
      <View style={[
        styles.barberoCard,
        {
          backgroundColor: colors.card,
          borderLeftWidth: 4,
          borderLeftColor: enDescanso ? colors.warning : (tieneCitas ? colors.warning : colors.success),
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }
      ]}>
        {item.foto_url ? (
          <Image 
            source={{ uri: item.foto_url }} 
            style={styles.barberoFoto}
          />
        ) : (
          <View style={[styles.barberoFotoPlaceholder, { backgroundColor: colors.glass }]}>
            <Feather name="user" size={28} color={colors.textSecondary} />
          </View>
        )}
        
        <View style={styles.barberoInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.barberoNombre, { color: colors.text }]}>{item.nombre}</Text>
            {tieneCitas && (
              <View style={{ backgroundColor: colors.warning, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>📋 CON CITAS</Text>
              </View>
            )}
          </View>
          <Text style={[styles.barberoTelefono, { color: colors.textSecondary }]}>
            <Feather name="phone" size={12} color={colors.textSecondary} /> {item.telefono}
          </Text>
          <View style={styles.horarioInfo}>
            <Feather name="clock" size={10} color={colors.gold} />
            <Text style={[styles.horarioText, { color: colors.gold }]}>
              {item.horario_inicio || '09:00'} - {item.horario_fin || '19:00'}
            </Text>
          </View>
          
          {enDescanso && (
            <View style={[styles.badgeDescanso, { backgroundColor: colors.warning }]}>
              <Feather name="calendar" size={10} color="#fff" />
              <Text style={styles.badgeDescansoText}>
                Descanso: {item.descanso_inicio} al {item.descanso_fin}
              </Text>
            </View>
          )}
          
          <View style={[styles.badgeActivo, { backgroundColor: enDescanso ? colors.warning : (tieneCitas ? colors.warning : colors.success) }]}>
            <Text style={styles.badgeActivoText}>
              {enDescanso ? 'De descanso' : (tieneCitas ? 'Con citas pendientes' : 'Activo')}
            </Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'column', gap: 6 }}>
          <GameButton 
            title="Servicios"
            variant="primary"
            compact
            icon={getIcon('service') as any}
            onPress={() => asignarServicios(item.id, item.nombre)}
            style={{ minWidth: 90 }}
          />
          
          <GameButton 
            title="Horario"
            variant="primary"
            compact
            icon="clock"
            onPress={() => abrirModalHorario(item)}
            style={{ minWidth: 90 }}
          />
          
          {enDescanso ? (
            <GameButton 
              title="Terminar"
              variant="restore"
              compact
              icon="calendar"
              onPress={() => eliminarDescanso(item)}
              style={{ minWidth: 90 }}
            />
          ) : (
            <GameButton 
              title="Descanso"
              variant="secondary"
              compact
              icon="calendar"
              onPress={() => {
                router.push({
                  pathname: '/(admin)/dar-descanso/[id]',
                  params: { id: item.id }
                });
              }}
              style={{ minWidth: 90 }}
            />
          )}
          
          <GameButton 
            title="Archivar"
            variant="danger"
            compact
            icon="archive"
            onPress={() => desactivarBarbero(item)}
            style={{ minWidth: 90 }}
          />
        </View>
      </View>
    );
  };

  const renderBarberoArchivado = ({ item }: { item: Barbero }) => (
    <View style={[
      styles.barberoCard,
      styles.barberoCardArchivado,
      {
        backgroundColor: colors.card,
        borderLeftWidth: 4,
        borderLeftColor: colors.warning,
        opacity: 0.7,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }
    ]}>
      {item.foto_url ? (
        <Image 
          source={{ uri: item.foto_url }} 
          style={[styles.barberoFoto, styles.barberoFotoArchivado]}
        />
      ) : (
        <View style={[styles.barberoFotoPlaceholder, styles.barberoFotoPlaceholderArchivado, { backgroundColor: colors.glass }]}>
          <Feather name="user" size={28} color={colors.textMuted} />
        </View>
      )}
      
      <View style={styles.barberoInfo}>
        <Text style={[styles.barberoNombre, styles.textoArchivado, { color: colors.textMuted }]}>{item.nombre}</Text>
        <Text style={[styles.barberoTelefono, styles.textoArchivado, { color: colors.textMuted }]}>
          <Feather name="phone" size={12} color={colors.textMuted} /> {item.telefono}
        </Text>
        <View style={[styles.badgeArchivado, { backgroundColor: colors.warning }]}>
          <Text style={styles.badgeArchivadoText}>Archivado</Text>
        </View>
      </View>
      
      <View style={{ flexDirection: 'column', gap: 6 }}>
        <GameButton 
          title="Eliminar"
          variant="danger"
          compact
          icon="trash-2"
          onPress={() => eliminarBarberoPermanente(item)}
          style={{ minWidth: 90 }}
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[global.header, { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: spacing.lg }]}>
        <GameButton 
          title={`Agregar ${(employeePlural || 'Empleado').slice(0, -1)}`}
          variant="primary"
          onPress={() => setModalVisible(true)}
          icon="plus"
          compact
        />
      </View>

      <TouchableOpacity 
        style={[styles.toggleArchivados, { backgroundColor: colors.glass }]}
        onPress={() => setMostrarArchivados(!mostrarArchivados)}
      >
        <Feather name="folder" size={14} color={colors.gold} />
        <Text style={[styles.toggleArchivadosText, { color: colors.gold }]}>
          {mostrarArchivados ? 'Ocultar archivados' : `Ver archivados (${barberosArchivados.length})`}
        </Text>
      </TouchableOpacity>

      {cargandoLista && !refreshing ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={barberosActivos}
          keyExtractor={(item) => item.id}
          renderItem={renderBarberoActivo}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={[colors.primary]} 
              tintColor={colors.primary} 
            />
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay {(employeePlural || 'empleados').toLowerCase()} activos</Text>
          }
          ListFooterComponent={
            mostrarArchivados && barberosArchivados.length > 0 ? (
              <View style={styles.archivadosSection}>
                <Text style={[styles.archivadosTitle, { color: colors.gold }]}>{employeePlural || 'Empleados'} Archivados</Text>
                {barberosArchivados.map((item) => (
                  <View key={item.id}>
                    {renderBarberoArchivado({ item })}
                  </View>
                ))}
              </View>
            ) : null
          }
        />
      )}

      {/* Modal Agregar Barbero */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Agregar {(employeePlural || 'Empleado').slice(0, -1)}</Text>
            
            <TextInput
              placeholder="Nombre completo *"
              placeholderTextColor={colors.textMuted}
              value={nombre}
              onChangeText={setNombre}
              style={[styles.input, { backgroundColor: colors.glass, color: colors.text }]}
              editable={!loading}
            />
            
            <TextInput
              placeholder="Teléfono * (ej: 3001234567)"
              placeholderTextColor={colors.textMuted}
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
              style={[styles.input, { backgroundColor: colors.glass, color: colors.text }]}
              editable={!loading}
            />
            
            <View style={[styles.infoBox, { backgroundColor: colors.glass }]}>
              <Feather name="info" size={12} color={colors.gold} />
              <Text style={[styles.infoText, { color: colors.gold }]}>
                La contraseña será el número de teléfono
              </Text>
            </View>
            
            <View style={styles.modalButtons}>
              <GameButton 
                title={loading ? 'Guardando...' : 'Guardar'}
                variant="primary"
                onPress={confirmarAgregarBarbero}
                disabled={loading}
              />
              <GameButton 
                title="Cancelar"
                variant="danger"
                onPress={() => setModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Editar Horario */}
      <Modal visible={modalHorarioVisible} transparent animationType="slide" onRequestClose={() => setModalHorarioVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Horario de {barberoEditando?.nombre}</Text>
            
            <Text style={[styles.fieldLabel, { color: colors.gold }]}>Hora de inicio</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.glass, color: colors.text }]}
              placeholder="Ej: 09:00"
              placeholderTextColor={colors.textMuted}
              value={horarioInicio}
              onChangeText={setHorarioInicio}
              maxLength={5}
              editable={!guardandoHorario}
            />
            
            <Text style={[styles.fieldLabel, { color: colors.gold }]}>Hora de fin</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.glass, color: colors.text }]}
              placeholder="Ej: 19:00"
              placeholderTextColor={colors.textMuted}
              value={horarioFin}
              onChangeText={setHorarioFin}
              maxLength={5}
              editable={!guardandoHorario}
            />
            
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              📝 Formato 24 horas (ej: 09:00, 18:30)
            </Text>
            
            <View style={styles.modalButtons}>
              <GameButton 
                title={guardandoHorario ? 'Guardando...' : 'Guardar'}
                variant="primary"
                onPress={guardarHorario}
                disabled={guardandoHorario}
              />
              <GameButton 
                title="Cancelar"
                variant="danger"
                onPress={() => setModalHorarioVisible(false)}
              />
            </View>
          </View>
        </View>
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
  container: {
    flex: 1,
    padding: 20,
  },
  toggleArchivados: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  toggleArchivadosText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  barberoCard: {
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  barberoCardArchivado: {
    opacity: 0.7,
  },
  barberoFoto: {
    width: 55,
    height: 55,
    borderRadius: 28,
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  barberoFotoArchivado: {
    opacity: 0.5,
  },
  barberoFotoPlaceholder: {
    width: 55,
    height: 55,
    borderRadius: 28,
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barberoFotoPlaceholderArchivado: {
    opacity: 0.5,
  },
  barberoInfo: {
    flex: 1,
  },
  barberoNombre: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  barberoTelefono: {
    fontSize: 12,
    marginBottom: 4,
  },
  horarioInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  horarioText: {
    fontSize: 11,
  },
  textoArchivado: {
    textDecorationLine: 'line-through',
  },
  badgeActivo: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeActivoText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  badgeDescanso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeDescansoText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  badgeArchivado: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeArchivadoText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
  },
  archivadosSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#2D2D3A',
    paddingTop: 16,
  },
  archivadosTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    marginBottom: 4,
    marginTop: 8,
    fontWeight: 'bold',
  },
  input: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center',
  },
});
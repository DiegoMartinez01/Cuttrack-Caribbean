import { Feather } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, Text, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary';
import { useGameStyles } from '../hooks/useGameStyles';
import { useNotifications } from '../hooks/useNotifications'; // 🔥 NUEVO: Notificaciones
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';
import { GameCard } from '../styles/components/ui/GameCard';

export default function MisCitas() {
  const { colors, global, spacing } = useGameStyles();
  
  // 🔥 HOOKS
  const { 
    appointmentName,
    appointmentPlural,
    employeeName,
    employeePlural,
    serviceName,
    statusCompleted,
    statusPending,
    statusCancelled,
    actionCancel,
    actionRate,
    actionBook,
    getIcon,
    selectService
  } = useBusinessDictionary();

  const { notify } = useNotifications(); // 🔥 NUEVO: Notificaciones

  const [citas, setCitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [totalCitas, setTotalCitas] = useState(0);
  const itemsPorPagina = 10;

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
    cargarClienteId();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (clienteId) {
        cargarCitas(true);
      }
    }, [clienteId])
  );

  const cargarClienteId = async () => {
    try {
      const id = await storage.getItem('cliente_id');
      if (!id) {
        setLoading(false);
        return;
      }
      setClienteId(id);
      cargarCitas(true);
    } catch (error) {
      console.error('Error cargando cliente ID:', error);
      setLoading(false);
    }
  };

  const cargarCitas = async (resetPagina: boolean = true) => {
    if (!clienteId) return;
    
    if (resetPagina) {
      setPagina(0);
      setCitas([]);
      setLoading(true);
    } else {
      setCargandoMas(true);
    }

    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setCargandoMas(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const desde = resetPagina ? 0 : pagina * itemsPorPagina;
      const hasta = desde + itemsPorPagina - 1;
      
      const { data, error, count } = await supabase
        .from('appointments')
        .select(`
          id,
          fecha_hora,
          estado,
          total,
          calificacion_cliente,
          comentario_cliente,
          foto_resena,
          barbers (id, nombre, foto_url),
          services (id, nombre, duracion_min, foto_url)
        `, { count: 'exact' })
        .eq('cliente_id', clienteId)
        .order('fecha_hora', { ascending: false })
        .range(desde, hasta);
      
      if (error) throw error;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (resetPagina) {
        setCitas(data || []);
      } else {
        setCitas(prev => [...prev, ...(data || [])]);
      }
      setTotalCitas(count || 0);

    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('❌ Error cargando citas:', error);
      showModal('Error', error.message || `No se pudieron cargar tus ${(appointmentPlural || 'citas').toLowerCase()}`, 'error');
    } finally {
      setLoading(false);
      setCargandoMas(false);
      setRefreshing(false);
    }
  };

  const cargarSiguientePagina = () => {
    if (!cargandoMas && !loading && citas.length < totalCitas) {
      const siguientePagina = pagina + 1;
      setPagina(siguientePagina);
      cargarCitas(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPagina(0);
    cargarCitas(true);
  }, [clienteId]);

  const cancelarCita = async (citaId: string, fechaHora: string, cita: any) => {
    const ahora = new Date();
    const citaDate = new Date(fechaHora);
    const diffHoras = (citaDate.getTime() - ahora.getTime()) / (1000 * 60 * 60);
    
    if (diffHoras < 2) {
      showModal(
        `${actionCancel || 'Cancelación'} no permitida`,
        `Solo puedes ${(actionCancel || 'cancelar').toLowerCase()} ${(appointmentName || 'citas').toLowerCase()} con al menos 2 horas de anticipación.`,
        'warning'
      );
      return;
    }
    
    showModal(
      `${actionCancel || 'Cancelar'} ${(appointmentName || 'cita').toLowerCase()}`, 
      `¿Estás seguro de ${(actionCancel || 'cancelar').toLowerCase()} esta ${(appointmentName || 'cita').toLowerCase()}?`, 
      'confirm', 
      async () => {
        const { error } = await supabase
          .from('appointments')
          .update({ estado: 'cancelada' })
          .eq('id', citaId)
          .eq('cliente_id', clienteId);
        
        if (error) {
          showModal('Error', `No se pudo ${(actionCancel || 'cancelar').toLowerCase()} la ${(appointmentName || 'cita').toLowerCase()}`, 'error');
        } else {
          // 🔥 ENVIAR NOTIFICACIÓN DE CANCELACIÓN
          try {
            await notify(
              'APPOINTMENT_CANCELLED',
              `❌ ${(appointmentName || 'Cita').toUpperCase()} cancelada`,
              `Has cancelado tu ${(appointmentName || 'cita').toLowerCase()} con ${cita.barbers?.nombre || (employeeName || 'Barbero')}`,
              { appointmentId: citaId }
            );
          } catch (notifError) {
            console.log('⚠️ Error en notificación (no crítico):', notifError);
          }

          showModal(`✅ ${(appointmentName || 'Cita').toUpperCase()} ${(actionCancel || 'cancelada').toUpperCase()}`, 
            `Tu ${(appointmentName || 'cita').toLowerCase()} ha sido ${(actionCancel || 'cancelada').toLowerCase()} exitosamente`, 
            'success', 
            () => cargarCitas(true)
          );
        }
      }
    );
  };

  const irACalificar = (citaId: string) => {
    router.push(`/(cliente)/calificar/${citaId}` as Href);
  };

  const formatHora = (fechaHora: string) => {
    const fecha = new Date(fechaHora);
    const hora = fecha.getHours();
    const minuto = fecha.getMinutes();
    const ampm = hora >= 12 ? 'PM' : 'AM';
    const hora12 = hora % 12 || 12;
    return `${hora12}:${minuto.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatFechaCompleta = (fechaHora: string) => {
    const fecha = new Date(fechaHora);
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dias[fecha.getDay()]} ${fecha.getDate()} ${meses[fecha.getMonth()]}`;
  };

  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'pendiente': return colors.secondary;
      case 'confirmada': return colors.info;
      case 'completada': return colors.success;
      case 'cancelada': return colors.error;
      case 'no_asistio': return colors.warning;
      default: return colors.textMuted;
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch(estado) {
      case 'pendiente': return statusPending || 'Pendiente';
      case 'confirmada': return 'Confirmada';
      case 'completada': return statusCompleted || 'Completada';
      case 'cancelada': return statusCancelled || 'Cancelada';
      case 'no_asistio': return 'No asistió';
      default: return estado;
    }
  };

  const renderCita = ({ item: cita }: { item: any }) => {
    const puedeCalificar = cita.estado === 'completada' && !cita.calificacion_cliente;
    const yaCalifico = cita.estado === 'completada' && cita.calificacion_cliente > 0;
    const esPasada = new Date(cita.fecha_hora) < new Date();
    const appointmentLabel = appointmentName || 'cita';
    const employeeLabel = employeeName || 'Barbero';
    const serviceLabel = serviceName || 'Servicio';
    
    return (
      <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {/* Foto del empleado */}
          {cita.barbers?.foto_url ? (
            <Image 
              source={{ uri: cita.barbers.foto_url }} 
              style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.primary }}
            />
          ) : (
            <View style={{ 
              width: 60, 
              height: 60, 
              borderRadius: 30, 
              backgroundColor: colors.glass,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.glassBorder,
            }}>
              <Feather name="user" size={28} color={colors.textSecondary} />
            </View>
          )}
          
          <View style={{ flex: 1 }}>
            {/* Encabezado: Servicio + Estado */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                {cita.services?.foto_url ? (
                  <Image 
                    source={{ uri: cita.services.foto_url }} 
                    style={{ width: 20, height: 20, borderRadius: 4 }}
                  />
                ) : (
                  <Feather name={getIcon('service') as any} size={12} color={colors.gold} />
                )}
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 14 }}>
                  {cita.services?.nombre || serviceLabel}
                </Text>
              </View>
              <View style={{ backgroundColor: getEstadoColor(cita.estado), paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 12 }}>
                <Text style={{ color: colors.background, fontSize: 9, fontWeight: 'bold' }}>{getEstadoTexto(cita.estado)}</Text>
              </View>
            </View>
            
            {/* Nombre del empleado */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              <Feather name="user" size={12} color={colors.textSecondary} />
              <Text style={{ color: colors.text, fontSize: 14 }}>{cita.barbers?.nombre || employeeLabel}</Text>
            </View>
            
            {/* Fecha y hora */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              <Feather name="calendar" size={12} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                {formatFechaCompleta(cita.fecha_hora)} - {formatHora(cita.fecha_hora)}
              </Text>
            </View>
            
            {/* Precio */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Feather name="dollar-sign" size={12} color={colors.gold} />
              <Text style={{ color: colors.gold, fontWeight: 'bold' }}>${cita.total?.toLocaleString('es-CO')}</Text>
            </View>
            
            {/* Acciones según estado */}
            {(cita.estado === 'pendiente' || cita.estado === 'confirmada') && !esPasada && (
              <GameButton 
                title={`${actionCancel || 'Cancelar'} ${appointmentLabel.toLowerCase()}`}
                variant="danger"
                compact
                onPress={() => cancelarCita(cita.id, cita.fecha_hora, cita)}
                style={{ marginTop: spacing.xs }}
              />
            )}
            
            {puedeCalificar && (
              <GameButton 
                title={`⭐ ${actionRate || 'Calificar'} experiencia`}
                variant="primary"
                compact
                icon="star"
                onPress={() => irACalificar(cita.id)}
                style={{ marginTop: spacing.xs }}
              />
            )}
            
            {yaCalifico && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(16,185,129,0.15)', padding: spacing.sm, borderRadius: 12, marginTop: spacing.xs }}>
                <Feather name="star" size={14} color={colors.success} />
                <Text style={{ color: colors.success, fontWeight: 'bold', fontSize: 11 }}>
                  Ya {(actionRate || 'calificaste').toLowerCase()} ({'⭐'.repeat(cita.calificacion_cliente)})
                </Text>
              </View>
            )}

            {esPasada && cita.estado !== 'completada' && cita.estado !== 'cancelada' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(245,158,11,0.15)', padding: spacing.sm, borderRadius: 12, marginTop: spacing.xs }}>
                <Feather name="clock" size={14} color={colors.warning} />
                <Text style={{ color: colors.warning, fontWeight: 'bold', fontSize: 11 }}>
                  {appointmentLabel} no {(statusCompleted || 'completada').toLowerCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
      </GameCard>
    );
  };

  if (loading && !refreshing && citas.length === 0) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando tus {(appointmentPlural || 'citas').toLowerCase()}...</Text>
      </View>
    );
  }

  // 🔥 ESTADO VACÍO MEJORADO
  if (totalCitas === 0 && !loading) {
    return (
      <View style={[global.container, { justifyContent: 'center', alignItems: 'center', padding: spacing.xl }]}>
        {/* Icono grande con borde punteado */}
        <View style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: 'rgba(255,107,53,0.08)',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.xl,
          borderWidth: 2,
          borderColor: 'rgba(255,107,53,0.2)',
          borderStyle: 'dashed',
        }}>
          <Feather name="calendar" size={56} color={colors.gold} />
        </View>
        
        <Text style={[global.headerTitle, { fontSize: 24, textAlign: 'center', marginBottom: spacing.sm }]}>
          ¡Sin {(appointmentPlural || 'citas').toLowerCase()}!
        </Text>
        
        <Text style={[global.text, { 
          color: colors.textSecondary, 
          fontSize: 14, 
          textAlign: 'center', 
          marginBottom: spacing.xl,
          paddingHorizontal: spacing.lg,
          lineHeight: 22,
        }]}>
          {`No tienes ${(appointmentPlural || 'citas').toLowerCase()} agendadas aún.\n\n${(actionBook || 'Agenda')} tu primer ${(serviceName || 'servicio').toLowerCase()} y comienza a disfrutar de ${(employeePlural || 'nuestros profesionales').toLowerCase()}.`}
        </Text>
        
        <GameButton 
          title={`${(actionBook || 'Agendar')} ahora`}
          variant="primary"
          onPress={() => router.push('/(cliente)')}
          icon="calendar"
          style={{ 
            minWidth: 200,
            paddingVertical: 14,
          }}
        />
        
        <Text style={{ 
          color: colors.textMuted, 
          fontSize: 10, 
          marginTop: spacing.lg,
          textAlign: 'center',
        }}>
          {employeePlural || 'Nuestros profesionales'} te esperan
        </Text>
      </View>
    );
  }

  return (
    <View style={global.container}>
      {/* Header */}
      <View style={global.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="list" size={24} color={colors.gold} />
          <Text style={global.headerTitle}>Mis {(appointmentPlural || 'Citas')}</Text>
        </View>
        <Text style={global.headerSubtitle}>
          Total: {totalCitas} {(appointmentName || 'cita').toLowerCase()}{totalCitas !== 1 ? 's' : ''}
        </Text>
      </View>
      
      <FlatList
        data={citas}
        keyExtractor={(item) => item.id}
        renderItem={renderCita}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[colors.primary]} 
            tintColor={colors.primary} 
          />
        }
        onEndReached={cargarSiguientePagina}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          cargandoMas ? (
            <View style={{ padding: spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>
                Cargando más {(appointmentPlural || 'citas').toLowerCase()}...
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
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
    </View>
  );
}
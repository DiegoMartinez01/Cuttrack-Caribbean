import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary';
import { useGameStyles } from '../hooks/useGameStyles';
import { useNotifications } from '../hooks/useNotifications'; // 🔥 NUEVO: Notificaciones
import CalendarPicker from '../styles/components/ui/CalendarPicker';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';
import { GameCard } from '../styles/components/ui/GameCard';

export default function BarberAgenda() {
  const { colors, global, spacing } = useGameStyles();
  const { employeeName, appointmentPlural, getIcon } = useBusinessDictionary();
  const { notify } = useNotifications(); // 🔥 NUEVO: Notificaciones
  
  const [citas, setCitas] = useState<any[]>([]);
  const [cargandoCitas, setCargandoCitas] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [barberoId, setBarberoId] = useState<string | null>(null);
  const [barberoNombre, setBarberoNombre] = useState<string>('');
  const [porcentajeComision, setPorcentajeComision] = useState<number>(70);
  const [pagina, setPagina] = useState(0);
  const [totalCitas, setTotalCitas] = useState(0);
  const itemsPorPagina = 4;
  const [citasAnteriores, setCitasAnteriores] = useState<any[]>([]);
  
  const [enDescanso, setEnDescanso] = useState(false);
  const [descansoHasta, setDescansoHasta] = useState<string>('');
  const [verificandoDescanso, setVerificandoDescanso] = useState(true);
  
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

  const timeoutRef = useRef<number | null>(null);
  
  const obtenerFechaLocal = (): string => {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };
  
  const fechaHoy = obtenerFechaLocal();
  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechaHoy);
  const [resumenDia, setResumenDia] = useState({ total: 0, completadas: 0, pendientes: 0 });

  const esFechaPasada = fechaSeleccionada < fechaHoy;
  const totalPaginas = Math.ceil(totalCitas / itemsPorPagina);

  useEffect(() => {
    cargarBarberoId();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (barberoId && fechaSeleccionada) {
      cargarCitas(true);
      cargarResumenDia();
    }
  }, [fechaSeleccionada, barberoId]);

  useFocusEffect(
    useCallback(() => {
      if (barberoId && fechaSeleccionada) {
        cargarCitas(true);
        cargarResumenDia();
      }
    }, [barberoId, fechaSeleccionada])
  );

  const cargarBarberoId = async () => {
    try {
      const id = await storage.getItem('barbero_id');
      const nombre = await storage.getItem('barbero_nombre');
      if (!id) {
        router.replace('/(auth)/login');
        return;
      }
      setBarberoId(id);
      setBarberoNombre(nombre || employeeName || 'Barbero');
      
      const { data: barbero } = await supabase
        .from('barbers')
        .select('porcentaje_comision')
        .eq('id', id)
        .single();
      
      if (barbero?.porcentaje_comision !== undefined) {
        setPorcentajeComision(barbero.porcentaje_comision);
      }
      
      await verificarDescanso(id);
    } catch (error) {
      console.error('Error cargando barbero ID:', error);
    }
  };

  const verificarDescanso = async (id: string) => {
    setVerificandoDescanso(true);
    try {
      const { data: barbero, error } = await supabase
        .from('barbers')
        .select('descanso_inicio, descanso_fin')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      const hoy = obtenerFechaLocal();
      const enDescansoActivo = barbero?.descanso_inicio && barbero?.descanso_fin &&
                                 barbero.descanso_inicio <= hoy && barbero.descanso_fin >= hoy;
      
      setEnDescanso(enDescansoActivo || false);
      if (enDescansoActivo && barbero?.descanso_fin) {
        setDescansoHasta(barbero.descanso_fin);
      }
    } catch (error) {
      console.error('Error verificando descanso:', error);
    } finally {
      setVerificandoDescanso(false);
    }
  };

  const cargarResumenDia = async () => {
    if (!barberoId) return;
    try {
      const inicioDia = new Date(`${fechaSeleccionada}T00:00:00`).toISOString();
      const finDia = new Date(`${fechaSeleccionada}T23:59:59`).toISOString();
      
      const { data: citasDia } = await supabase
        .from('appointments')
        .select('estado')
        .eq('barbero_id', barberoId)
        .gte('fecha_hora', inicioDia)
        .lte('fecha_hora', finDia);
      
      const total = citasDia?.length || 0;
      const completadas = citasDia?.filter(c => c.estado === 'completada').length || 0;
      const pendientes = citasDia?.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada').length || 0;
      setResumenDia({ total, completadas, pendientes });
    } catch (error) {
      console.error('Error cargando resumen:', error);
    }
  };

  const cargarCitas = async (resetPagina: boolean = true) => {
    if (!barberoId) return;
    
    if (resetPagina) {
      setPagina(0);
      setCitas([]);
    }
    
    setCargandoCitas(true);
    timeoutRef.current = setTimeout(() => {
      setCargandoCitas(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);
    
    const inicioDia = new Date(`${fechaSeleccionada}T00:00:00`).toISOString();
    const finDia = new Date(`${fechaSeleccionada}T23:59:59`).toISOString();
    const estadosFiltro = esFechaPasada 
      ? ['completada', 'cancelada', 'no_asistio']
      : ['pendiente', 'confirmada', 'completada'];
    
    const desde = resetPagina ? 0 : pagina * itemsPorPagina;
    const hasta = desde + itemsPorPagina - 1;
    
    const { data, error, count } = await supabase
      .from('appointments')
      .select(`id, fecha_hora, estado, total, clients (nombre, telefono, foto_url), services (nombre, duracion_min, precio)`, { count: 'exact' })
      .eq('barbero_id', barberoId)
      .in('estado', estadosFiltro)
      .gte('fecha_hora', inicioDia)
      .lte('fecha_hora', finDia)
      .order('fecha_hora', { ascending: true })
      .range(desde, hasta);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    if (error) {
      showModal('Error', `No se pudieron cargar ${(appointmentPlural || 'citas').toLowerCase()}`, 'error');
    } else {
      // 🔥 Detectar nuevas citas para notificar
      if (resetPagina && citasAnteriores.length > 0 && data) {
        const idsAnteriores = new Set(citasAnteriores.map(c => c.id));
        const nuevasCitas = data.filter(c => !idsAnteriores.has(c.id));
        
        // 🔥 Enviar notificación por cada nueva cita
        for (const cita of nuevasCitas) {
          if (cita.estado === 'pendiente' || cita.estado === 'confirmada') {
            try {
              await notify(
                'APPOINTMENT_CONFIRMED',
                '📅 ¡Nuevo trabajo!',
                `${cita.clients?.[0]?.nombre || 'Cliente'} agendó ${cita.services?.[0]?.nombre || 'servicio'} a las ${formatHora(cita.fecha_hora)}`,
                { appointmentId: cita.id }
              );
            } catch (notifError) {
              console.log('⚠️ Error en notificación (no crítico):', notifError);
            }
          }
        }
      }
      
      setCitasAnteriores(data || []);
      
      if (resetPagina) {
        setCitas(data || []);
      } else {
        setCitas([...citas, ...(data || [])]);
      }
      setTotalCitas(count || 0);
    }
    setCargandoCitas(false);
    setRefreshing(false);
  };

  const cargarSiguientePagina = () => {
    if (!cargandoCitas && citas.length < totalCitas) {
      const siguientePagina = pagina + 1;
      setPagina(siguientePagina);
      cargarCitas(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarCitas(true);
    cargarResumenDia();
  }, [barberoId, fechaSeleccionada]);

  const cambiarPagina = (nuevaPagina: number) => {
    if (nuevaPagina < 0 || nuevaPagina >= totalPaginas) return;
    setPagina(nuevaPagina);
    cargarCitas(true);
  };

  const completarCita = async (citaId: string, total: number, clienteNombre: string) => {
    if (esFechaPasada) {
      showModal('No disponible', 'No puedes modificar citas de días pasados', 'warning');
      return;
    }
    
    showModal('Completar cita', '¿Ya atendiste a este cliente?', 'confirm', async () => {
      const ganancia = total * (porcentajeComision / 100);
      
      const { error } = await supabase
        .from('appointments')
        .update({ 
          estado: 'completada',
          ganancia_barbero: ganancia
        })
        .eq('id', citaId)
        .eq('barbero_id', barberoId);
      
      if (error) {
        showModal('Error', 'No se pudo completar la cita', 'error');
      } else {
        // 🔥 ENVIAR NOTIFICACIÓN DE CITA COMPLETADA (GANANCIA)
        try {
          await notify(
            'APPOINTMENT_COMPLETED',
            '💰 ¡Ganaste!',
            `${clienteNombre || 'Cliente'} - +$${ganancia.toLocaleString('es-CO')}`,
            { appointmentId: citaId, amount: ganancia }
          );
        } catch (notifError) {
          console.log('⚠️ Error en notificación (no crítico):', notifError);
        }
        
        cargarCitas(true);
        cargarResumenDia();
        showModal('✅ Cita completada', `Ganancia: $${ganancia.toLocaleString('es-CO')} (${porcentajeComision}% de comisión)`, 'success');
      }
    });
  };

  const cancelarCita = async (citaId: string) => {
    if (esFechaPasada) {
      showModal('No disponible', 'No puedes modificar citas de días pasados', 'warning');
      return;
    }
    
    showModal('Cancelar cita', '¿Estás seguro de cancelar esta cita?', 'confirm', async () => {
      const { error } = await supabase
        .from('appointments')
        .update({ estado: 'cancelada' })
        .eq('id', citaId)
        .eq('barbero_id', barberoId);
      
      if (error) {
        showModal('Error', 'No se pudo cancelar la cita', 'error');
      } else {
        cargarCitas(true);
        cargarResumenDia();
        showModal('✅ Cita cancelada', 'La cita ha sido cancelada', 'success');
      }
    });
  };

  const formatHora = (fechaHora: string) => {
    const fecha = new Date(fechaHora);
    const hora = fecha.getHours();
    const minuto = fecha.getMinutes();
    const ampm = hora >= 12 ? 'PM' : 'AM';
    const hora12 = hora % 12 || 12;
    return `${hora12}:${minuto.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatFecha = (fechaStr: string) => {
    const [year, month, day] = fechaStr.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const fecha = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    return `${dias[fecha.getUTCDay()]} ${parseInt(day)} de ${meses[parseInt(month)-1]}`;
  };

  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'completada': return colors.success;
      case 'cancelada': return colors.error;
      case 'no_asistio': return colors.warning;
      default: return colors.gold;
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch(estado) {
      case 'completada': return 'Completada ✓';
      case 'cancelada': return 'Cancelada ✗';
      case 'no_asistio': return 'No asistió ⚠';
      case 'confirmada': return 'Confirmada';
      default: return 'Pendiente ⏳';
    }
  };

  const renderCita = ({ item: cita }: { item: any }) => (
    <GameCard variant="elevated" style={{ marginBottom: spacing.md, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: 'bold' }}>{formatHora(cita.fecha_hora)}</Text>
        <View style={{ backgroundColor: getEstadoColor(cita.estado), paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 12 }}>
          <Text style={{ color: colors.background, fontSize: 10, fontWeight: 'bold' }}>{getEstadoTexto(cita.estado)}</Text>
        </View>
      </View>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs }}>
        {cita.clients?.foto_url ? (
          <Image 
            source={{ uri: cita.clients.foto_url }} 
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' }}>
            <Feather name="user" size={20} color={colors.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>{cita.clients?.nombre || 'Cliente'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Feather name="phone" size={10} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{cita.clients?.telefono || 'Sin teléfono'}</Text>
          </View>
        </View>
      </View>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,107,53,0.1)', padding: spacing.sm, borderRadius: 12, marginVertical: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name={getIcon('service') as any} size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: 'bold' }}>{cita.services?.nombre || 'Servicio'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="clock" size={12} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{cita.services?.duracion_min || 30} min</Text>
          <Feather name="dollar-sign" size={12} color={colors.gold} />
          <Text style={{ color: colors.gold, fontWeight: 'bold' }}>${cita.total?.toLocaleString('es-CO')}</Text>
        </View>
      </View>
      
      {!esFechaPasada && cita.estado === 'pendiente' && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          <GameButton 
            title="✓ Atendido" 
            variant="primary" 
            onPress={() => completarCita(cita.id, cita.total, cita.clients?.nombre)} 
            style={{ flex: 1, paddingVertical: spacing.sm }} 
          />
          <GameButton 
            title="✗ Cancelar" 
            variant="danger" 
            onPress={() => cancelarCita(cita.id)} 
            style={{ flex: 1, paddingVertical: spacing.sm }} 
          />
        </View>
      )}
      {esFechaPasada && cita.estado === 'completada' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,185,129,0.2)', padding: spacing.sm, borderRadius: 12, marginTop: spacing.xs, gap: spacing.xs }}>
          <Feather name="check-circle" size={14} color={colors.success} />
          <Text style={{ color: colors.success, fontWeight: 'bold' }}>Atendido</Text>
        </View>
      )}
    </GameCard>
  );

  if (!verificandoDescanso && enDescanso) {
    return (
      <View style={global.container}>
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: spacing.xl 
        }}>
          <View style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.glass,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: spacing.lg,
            borderWidth: 2,
            borderColor: colors.warning,
          }}>
            <Feather name="coffee" size={48} color={colors.warning} />
          </View>
          
          <Text style={[global.headerTitle, { fontSize: 28, marginBottom: spacing.sm, color: colors.warning }]}>
            ¡De descanso!
          </Text>
          
          <Text style={[global.text, { color: colors.textSecondary, textAlign: 'center', fontSize: 16, marginBottom: spacing.sm }]}>
            Estás de descanso hasta el
          </Text>
          
          <View style={{
            backgroundColor: colors.glass,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: 12,
            marginBottom: spacing.lg,
          }}>
            <Text style={{ color: colors.gold, fontSize: 18, fontWeight: 'bold' }}>
              {descansoHasta.split('-').reverse().join('/')}
            </Text>
          </View>
          
          <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
            Durante este período no tienes {(appointmentPlural || 'citas').toLowerCase()} asignadas.
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
            Puedes volver a tu agenda cuando termine tu descanso.
          </Text>
        </View>
      </View>
    );
  }

  if (verificandoDescanso) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando...</Text>
      </View>
    );
  }

  return (
    <View style={global.container}>
      <CalendarPicker
        barberoId={barberoId || ''}
        selectedDate={fechaSeleccionada}
        onSelectDate={(date) => {
          setFechaSeleccionada(date);
          setPagina(0);
        }}
      />

      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 }}>
        <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center', padding: spacing.md }}>
          <Feather name="calendar" size={20} color={colors.gold} />
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{resumenDia.total}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Total</Text>
        </GameCard>
        <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center', padding: spacing.md }}>
          <Feather name="check-circle" size={20} color={colors.success} />
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.success, marginTop: 4 }}>{resumenDia.completadas}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Completadas</Text>
        </GameCard>
        <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center', padding: spacing.md }}>
          <Feather name="clock" size={20} color={colors.warning} />
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.warning, marginTop: 4 }}>{resumenDia.pendientes}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Pendientes</Text>
        </GameCard>
      </View>

      <View style={{ alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <TouchableOpacity onPress={onRefresh}>
          <Feather name="refresh-cw" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <Feather name="map-pin" size={14} color={colors.gold} />
          <Text style={{ color: colors.gold, fontSize: 14, fontWeight: 'bold' }}>
            {formatFecha(fechaSeleccionada)} • {totalCitas} {(appointmentPlural || 'cita').toLowerCase()}{totalCitas !== 1 ? 's' : ''}
          </Text>
        </View>

        {cargandoCitas && citas.length === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing.xl }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : totalCitas === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing.xl, backgroundColor: colors.card, borderRadius: 16 }}>
            <Feather name="calendar" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              {esFechaPasada ? `No hay ${(appointmentPlural || 'citas').toLowerCase()} registradas` : `No hay ${(appointmentPlural || 'citas').toLowerCase()} para este día`}
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              data={citas}
              keyExtractor={(item) => item.id}
              renderItem={renderCita}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
              }
              onEndReached={cargarSiguientePagina}
              onEndReachedThreshold={0.5}
            />
            
            {totalPaginas > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xl, gap: spacing.md }}>
                <GameButton 
                  title="← Anterior"
                  variant="secondary"
                  onPress={() => cambiarPagina(pagina - 1)}
                  disabled={pagina === 0}
                  style={{ flex: 1, paddingVertical: spacing.sm }}
                />
                <Text style={{ color: colors.gold }}>{pagina + 1} / {totalPaginas}</Text>
                <GameButton 
                  title="Siguiente →"
                  variant="secondary"
                  onPress={() => cambiarPagina(pagina + 1)}
                  disabled={pagina === totalPaginas - 1}
                  style={{ flex: 1, paddingVertical: spacing.sm }}
                />
              </View>
            )}
          </>
        )}
      </View>

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
    </View>
  );
}
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary';
import { useGameStyles } from '../hooks/useGameStyles';
import { useNotifications } from '../hooks/useNotifications';
import CalendarPicker from '../styles/components/ui/CalendarPicker';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';


interface Horario {
  hora: string;
  disponible: boolean;
  horaFormateada: string;
  esRecomendada: boolean;
  tiempoEspera: string;
}

export default function SeleccionarHorario() {
  const { colors, global, spacing } = useGameStyles();
  const { appointmentName, getIcon } = useBusinessDictionary();
  const { notify, scheduleReminder } = useNotifications();
  
  const params = useLocalSearchParams();
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [horarioSeleccionado, setHorarioSeleccionado] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [minAdvanceHours, setMinAdvanceHours] = useState(1);
  
  const [servicioFoto, setServicioFoto] = useState<string | null>(null);
  const [barberoFoto, setBarberoFoto] = useState<string | null>(null);
  
  const timeoutRef = useRef<number | null>(null);

  const barberoId = (params.barberoId as string) || '';
  const barberoNombre = (params.barberoNombre as string) || '';
  const servicioId = (params.servicioId as string) || '';
  const servicioNombre = (params.servicioNombre as string) || '';
  const servicioDuracion = parseInt(params.servicioDuracion as string) || 30;
  const servicioPrecio = parseInt(params.servicioPrecio as string) || 0;

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

  const obtenerFechaLocal = (): string => {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };

  const hoyStr = obtenerFechaLocal();

  useEffect(() => {
    const cargarFotos = async () => {
      if (servicioId) {
        const { data: servicio } = await supabase
          .from('services')
          .select('foto_url')
          .eq('id', servicioId)
          .single();
        if (servicio?.foto_url) setServicioFoto(servicio.foto_url);
      }
      
      if (barberoId) {
        const { data: barbero } = await supabase
          .from('barbers')
          .select('foto_url')
          .eq('id', barberoId)
          .single();
        if (barbero?.foto_url) setBarberoFoto(barbero.foto_url);
      }
    };
    
    cargarFotos();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [servicioId, barberoId]);

  useEffect(() => {
    if (fechaSeleccionada && barberoId) {
      cargarHorarios();
    }
  }, [fechaSeleccionada, barberoId]);

  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        const { data: barbero } = await supabase
          .from('barbers')
          .select('barbershop_id')
          .eq('id', barberoId)
          .single();
        
        if (barbero?.barbershop_id) {
          const { data: negocio } = await supabase
            .from('barbershops')
            .select('min_advance_hours')
            .eq('id', barbero.barbershop_id)
            .single();
          
          if (negocio?.min_advance_hours !== undefined) {
            setMinAdvanceHours(negocio.min_advance_hours);
          }
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
      }
    };
    
    if (barberoId) {
      cargarConfiguracion();
    }
  }, [barberoId]);

  const calcularTiempoEspera = (hora: string): string => {
    if (!fechaSeleccionada) return '';
    
    const ahora = new Date();
    const [horaCita, minutoCita] = hora.split(':').map(Number);
    
    const fechaCita = new Date(fechaSeleccionada);
    fechaCita.setHours(horaCita, minutoCita, 0);
    
    const diffMs = fechaCita.getTime() - ahora.getTime();
    if (diffMs <= 0) return 'Muy pronto';
    
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `En ${diffMin} min`;
    const diffHoras = Math.floor(diffMin / 60);
    const restoMin = diffMin % 60;
    if (restoMin === 0) return `En ${diffHoras} h`;
    return `En ${diffHoras} h ${restoMin} min`;
  };

  const cargarHorarios = async () => {
    setCargandoHorarios(true);
    timeoutRef.current = setTimeout(() => {
      setCargandoHorarios(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const { data: barberoActualizado, error: barberoError } = await supabase
        .from('barbers')
        .select('buffer_minutes, horario_inicio, horario_fin')
        .eq('id', barberoId)
        .single();

      if (barberoError) throw barberoError;

      const buffer = barberoActualizado?.buffer_minutes || 10;
      let horaInicio = barberoActualizado?.horario_inicio?.slice(0, 5) || '09:00';
      let horaFin = barberoActualizado?.horario_fin?.slice(0, 5) || '19:00';
      
      const inicioDia = new Date(`${fechaSeleccionada}T00:00:00`).toISOString();
      const finDia = new Date(`${fechaSeleccionada}T23:59:59`).toISOString();
      
      const { data: citasExistentes, error: citasError } = await supabase
        .from('appointments')
        .select('fecha_hora')
        .eq('barbero_id', barberoId)
        .in('estado', ['pendiente', 'confirmada'])
        .gte('fecha_hora', inicioDia)
        .lte('fecha_hora', finDia);

      if (citasError) throw citasError;

      const horasOcupadas = citasExistentes?.map(cita => {
        const fechaCita = new Date(cita.fecha_hora);
        return fechaCita.getHours() * 60 + fechaCita.getMinutes();
      }) || [];

      const horariosGenerados = generarHorarios(
        horaInicio, 
        horaFin, 
        servicioDuracion, 
        buffer,
        horasOcupadas
      );
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setHorarios(horariosGenerados);
      
    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('❌ Error en cargarHorarios:', error);
      showModal('Error', error.message || 'No se pudieron cargar los horarios', 'error');
    } finally {
      setCargandoHorarios(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarHorarios();
  }, [fechaSeleccionada, barberoId]);

  const generarHorarios = (
    horaInicio: string, 
    horaFin: string, 
    duracion: number, 
    buffer: number, 
    horasOcupadas: number[]
  ): Horario[] => {
    const horariosArray: Horario[] = [];
    const [hInicio, mInicio] = horaInicio.split(':').map(Number);
    const [hFin, mFin] = horaFin.split(':').map(Number);
    
    let minutosInicio = hInicio * 60 + mInicio;
    const minutosFin = hFin * 60 + mFin;
    const duracionTotal = duracion + buffer;
    
    const ahora = new Date();
    const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();
    let horarioMasCercano: string | null = null;
    let diferenciaMinima = Infinity;
    
    const esFechaHoy = fechaSeleccionada === hoyStr;
    
    while (minutosInicio + duracionTotal <= minutosFin) {
      const hora = Math.floor(minutosInicio / 60);
      const minuto = minutosInicio % 60;
      const horaStr = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
      
      let ocupado = false;
      for (const ocupada of horasOcupadas) {
        if (Math.abs(ocupada - minutosInicio) < duracionTotal) {
          ocupado = true;
          break;
        }
      }
      
      let esHorarioPasado = false;
      if (esFechaHoy) {
        esHorarioPasado = minutosInicio <= minutosActuales;
      }
      
      const disponible = !ocupado && !esHorarioPasado;
      
      if (disponible && esFechaHoy) {
        const diferencia = minutosInicio - minutosActuales;
        if (diferencia > 0 && diferencia < diferenciaMinima) {
          diferenciaMinima = diferencia;
          horarioMasCercano = horaStr;
        }
      }
      
      horariosArray.push({
        hora: horaStr,
        disponible: disponible,
        horaFormateada: formatHora12(horaStr),
        esRecomendada: false,
        tiempoEspera: '',
      });
      
      minutosInicio += 30;
    }
    
    if (horarioMasCercano && esFechaHoy) {
      const horarioRecomendado = horariosArray.find(h => h.hora === horarioMasCercano);
      if (horarioRecomendado) {
        horarioRecomendado.esRecomendada = true;
      }
    }
    
    horariosArray.forEach(h => {
      if (esFechaHoy) {
        h.tiempoEspera = calcularTiempoEspera(h.hora);
      }
    });
    
    return horariosArray;
  };

  const formatHora12 = (hora: string): string => {
    const [h, m] = hora.split(':');
    const horaNum = parseInt(h);
    const ampm = horaNum >= 12 ? 'PM' : 'AM';
    const hora12 = horaNum % 12 || 12;
    return `${hora12}:${m} ${ampm}`;
  };

  const formatFecha = (fechaStr: string): string => {
    const [year, month, day] = fechaStr.split('-');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const fecha = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    return `${dias[fecha.getUTCDay()]}, ${parseInt(day)} ${meses[parseInt(month)-1]}`;
  };

  // 🔥 FUNCIÓN PARA GUARDAR RECORDATORIO EN LA BASE DE DATOS
  const guardarRecordatorio = async (
    citaId: string,
    clientId: string,
    fechaHoraCompleta: string
  ) => {
    const fechaRecordatorio = new Date(new Date(fechaHoraCompleta).getTime() - 2 * 60 * 60 * 1000);
    
    // Solo si la fecha de recordatorio es futura
    if (fechaRecordatorio.getTime() > Date.now()) {
      const { error } = await supabase
        .from('scheduled_notifications')
        .insert({
          appointment_id: citaId,
          user_id: clientId,
          user_rol: 'client',
          type: 'reminder',
          title: `⏰ Recordatorio: ${servicioNombre}`,
          body: `${clienteNombre}, tienes una cita con ${barberoNombre} a las ${formatHora12(horarioSeleccionado)}`,
          data: { appointmentId: citaId, screen: 'mis-citas' },
          scheduled_for: fechaRecordatorio.toISOString(),
        });
      
      if (error) {
        console.log('⚠️ Error guardando recordatorio en BD:', error);
      } else {
        console.log('📅 Recordatorio guardado en BD para:', fechaRecordatorio.toLocaleString());
      }
    } else {
      console.log('⏰ La cita es muy pronto, no se guarda recordatorio');
    }
  };

  const confirmarCita = async () => {
    if (!horarioSeleccionado) {
      showModal('Atención', `Selecciona un horario para continuar`, 'warning');
      return;
    }
    
    setConfirmando(true);
    timeoutRef.current = setTimeout(() => {
      setConfirmando(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const clientId = await storage.getItem('cliente_id');
      if (!clientId) {
        showModal('Error', 'No se encontró tu perfil. Inicia sesión nuevamente.', 'error', () => {
          router.replace('/client/login');
        });
        setConfirmando(false);
        return;
      }
      
      const fechaLocal = new Date(`${fechaSeleccionada}T${horarioSeleccionado}:00`);
      const fechaHoraCompleta = fechaLocal.toISOString();
      
      const { data: nuevaCita, error } = await supabase
        .from('appointments')
        .insert({
          cliente_id: clientId,
          barbero_id: barberoId,
          servicio_id: servicioId,
          fecha_hora: fechaHoraCompleta,
          estado: 'pendiente',
          total: servicioPrecio
        })
        .select('id')
        .single();
      
      if (error) {
        if (error.code === '23505') {
          showModal('⚠️ Horario no disponible', 'Este horario ya fue tomado. Por favor selecciona otro.', 'warning', () => {
            cargarHorarios();
          });
        } else {
          throw error;
        }
        setConfirmando(false);
        return;
      }
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      // 🔥 Obtener el nombre del cliente para las notificaciones
      const clienteNombre = await storage.getItem('cliente_nombre') || 'Cliente';
      const citaId = nuevaCita?.id;

      // 🔥 GUARDAR RECORDATORIO EN LA BASE DE DATOS (para el Cron Job)
      if (citaId && clientId) {
        await guardarRecordatorio(citaId, clientId, fechaHoraCompleta);
      }

      // 🔥 ENVIAR NOTIFICACIONES LOCALES (inmediatas)
      try {
        // 1. Notificación de confirmación
        await notify(
          'APPOINTMENT_CONFIRMED',
          `🎯 ¡${(appointmentName || 'Cita').toUpperCase()} Bloqueada!`,
          `${servicioNombre} con ${barberoNombre} a las ${formatHora12(horarioSeleccionado)}`,
          { appointmentId: citaId }
        );

        // 2. Programar recordatorio local 2 horas antes (fallback)
        await scheduleReminder(
          citaId,
          clienteNombre,
          barberoNombre,
          servicioNombre,
          fechaHoraCompleta
        );
      } catch (notifError) {
        // ⚠️ Si fallan las notificaciones, NO afectan la cita
        console.log('⚠️ Error en notificaciones (no crítico):', notifError);
      }
      
      showModal(
        `✅ ¡${(appointmentName || 'Cita').toUpperCase()} AGENDADA!`,
        `${servicioNombre}\nCon ${barberoNombre}\n📅 ${formatFecha(fechaSeleccionada)} a las ${formatHora12(horarioSeleccionado)}`,
        'success',
        () => router.replace('/(cliente)/mis-citas')
      );
      
    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('Error:', error);
      showModal('Error', error.message || `No se pudo agendar la ${(appointmentName || 'cita').toLowerCase()}`, 'error');
    } finally {
      setConfirmando(false);
    }
  };

  const horariosDisponibles = horarios.filter(h => h.disponible);
  const horarioRecomendado = horariosDisponibles.find(h => h.esRecomendada);
  const esFechaHoy = fechaSeleccionada === hoyStr;
  const esFechaFutura = fechaSeleccionada > hoyStr;

  if (!barberoId) {
    return (
      <View style={global.container}>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: 50 }}>Error: No se recibió información del barbero</Text>
        <GameButton title="Volver" variant="primary" onPress={() => router.back()} style={{ margin: spacing.lg }} />
      </View>
    );
  }

  return (
    <View style={global.container}>
      <LinearGradient
        colors={[colors.primary, colors.darkGold]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: spacing.xl,
          paddingBottom: spacing.lg,
          paddingHorizontal: spacing.lg,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', letterSpacing: 1 }}>
            NUEVA {(appointmentName || 'CITA').toUpperCase()}
          </Text>
          <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
            <Feather name="refresh-cw" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <CalendarPicker
        barberoId={barberoId}
        selectedDate={fechaSeleccionada}
        onSelectDate={(date: string) => {
          setFechaSeleccionada(date);
          setHorarioSeleccionado(null);
        }}
      />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        <View style={{ margin: spacing.lg, marginTop: spacing.xl }}>
          <LinearGradient
            colors={[colors.card, 'rgba(45,45,58,0.9)']}
            style={{
              borderRadius: 20,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: 'rgba(255,107,53,0.3)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              {servicioFoto ? (
                <Image 
                  source={{ uri: servicioFoto }} 
                  style={{ width: 70, height: 70, borderRadius: 12 }}
                />
              ) : (
                <View style={{ 
                  width: 70, 
                  height: 70, 
                  borderRadius: 12, 
                  backgroundColor: 'rgba(255,107,53,0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Feather name={getIcon('service') as any} size={28} color={colors.gold} />
                </View>
              )}
              
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold', letterSpacing: 1 }}>
                  {'SERVICIO'} SELECCIONADO
                </Text>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>
                  {servicioNombre}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="clock" size={12} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{servicioDuracion} min</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="dollar-sign" size={12} color={colors.gold} />
                    <Text style={{ color: colors.gold, fontWeight: 'bold', fontSize: 13 }}>
                      ${servicioPrecio.toLocaleString('es-CO')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, gap: spacing.sm }}>
              {barberoFoto ? (
                <Image 
                  source={{ uri: barberoFoto }} 
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                />
              ) : (
                <Feather name="user" size={18} color={colors.textSecondary} />
              )}
              <Text style={{ color: colors.text, fontSize: 14 }}>
                con <Text style={{ fontWeight: 'bold', color: colors.primary }}>{barberoNombre}</Text>
              </Text>
            </View>
          </LinearGradient>
        </View>

        {fechaSeleccionada && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Feather name="clock" size={14} color={colors.gold} />
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold', letterSpacing: 1 }}>
                HORARIOS DISPONIBLES
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              {formatFecha(fechaSeleccionada)}
            </Text>
            {esFechaHoy && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Feather name="alert-circle" size={10} color={colors.warning} />
                <Text style={{ color: colors.warning, fontSize: 10 }}>
                  Solo puedes agendar horarios que aún no han pasado
                </Text>
              </View>
            )}
            {esFechaFutura && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Feather name="check-circle" size={10} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 10 }}>
                  Puedes agendar cualquier horario disponible
                </Text>
              </View>
            )}
          </View>
        )}

        {fechaSeleccionada && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
            {cargandoHorarios ? (
              <View style={{ alignItems: 'center', padding: spacing.xl }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Cargando horarios...</Text>
              </View>
            ) : horariosDisponibles.length > 0 ? (
              <>
                {horarioRecomendado && (
                  <View style={{ marginBottom: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs }}>
                      <Feather name="zap" size={12} color={colors.success} />
                      <Text style={{ color: colors.success, fontSize: 11 }}>RECOMENDADO</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setHorarioSeleccionado(horarioRecomendado.hora)}
                    >
                      <LinearGradient
                        colors={[colors.success, colors.success]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          paddingHorizontal: 20,
                          paddingVertical: 14,
                          borderRadius: 30,
                          minWidth: 110,
                          alignItems: 'center',
                          shadowColor: colors.success,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 4,
                          elevation: 4,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 14 }}>
                          {horarioRecomendado.horaFormateada}
                        </Text>
                        {horarioRecomendado.tiempoEspera && (
                          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 }}>
                            {horarioRecomendado.tiempoEspera}
                          </Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {horariosDisponibles.map((horario) => {
                    const isSelected = horarioSeleccionado === horario.hora;
                    const isRecommended = horario.esRecomendada;
                    
                    if (isRecommended) return null;
                    
                    return (
                      <TouchableOpacity
                        key={horario.hora}
                        activeOpacity={0.8}
                        onPress={() => setHorarioSeleccionado(horario.hora)}
                      >
                        <LinearGradient
                          colors={isSelected ? [colors.primary, colors.darkGold] : [colors.card, colors.card]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                            borderRadius: 30,
                            borderWidth: isSelected ? 0 : 1,
                            borderColor: 'rgba(255,107,53,0.3)',
                            minWidth: 90,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{
                            color: isSelected ? colors.text : colors.text,
                            fontWeight: isSelected ? 'bold' : '500',
                            fontSize: 14,
                          }}>
                            {horario.horaFormateada}
                          </Text>
                          {horario.tiempoEspera && (
                            <Text style={{
                              color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textMuted,
                              fontSize: 10,
                              marginTop: 2,
                            }}>
                              {horario.tiempoEspera}
                            </Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', padding: spacing.xl, backgroundColor: colors.card, borderRadius: 16 }}>
                <Feather name="calendar" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.error, fontWeight: 'bold', marginTop: spacing.md }}>No hay horarios disponibles</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: spacing.sm }}>
                  {esFechaHoy ? 'Es muy tarde para agendar hoy' : 'Prueba con otra fecha'}
                </Text>
              </View>
            )}
          </View>
        )}

        {!fechaSeleccionada && (
          <View style={{ margin: spacing.lg, alignItems: 'center', padding: spacing.xl }}>
            <Feather name="calendar" size={64} color={colors.textMuted} />
            <Text style={{ color: colors.gold, fontWeight: 'bold', fontSize: 16, marginTop: spacing.md }}>Selecciona una fecha</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: spacing.sm, textAlign: 'center' }}>
              Toca cualquier día disponible en el calendario
            </Text>
          </View>
        )}

        {fechaSeleccionada && horariosDisponibles.length > 0 && (
          <View style={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}>
            <GameButton
              title={
                confirmando 
                  ? `⏳ AGENDANDO...` 
                  : horarioSeleccionado 
                    ? `✔️ CONFIRMAR ${(appointmentName || 'CITA').toUpperCase()} - ${formatHora12(horarioSeleccionado)}`
                    : `✔️ SELECCIONA UN HORARIO`
              }
              variant="primary"
              onPress={confirmarCita}
              disabled={!horarioSeleccionado || confirmando}
              style={{
                paddingVertical: 16,
                borderRadius: 30,
                opacity: !horarioSeleccionado ? 0.6 : 1,
              }}
            />
          </View>
        )}
      </ScrollView>

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
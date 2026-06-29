import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../../services/supabase/client';
import { useGameStyles } from '../../hooks/useGameStyles';
import CalendarPicker from '../../styles/components/ui/CalendarPicker';
import { CustomModal } from '../../styles/components/ui/CustomModal';
import { GameButton } from '../../styles/components/ui/GameButton';
import { GameCard } from '../../styles/components/ui/GameCard';

interface Cita {
  id: string;
  fecha_hora: string;
  cliente_nombre: string;
  servicio_nombre: string;
  servicio_id: string;
  barbero_sugerido_id?: string;
  barbero_sugerido_nombre?: string;
  barbero_seleccionado_id?: string;
  barbero_seleccionado_nombre?: string;
}

interface BarberoDisponible {
  id: string;
  nombre: string;
  foto_url?: string;
  calificacion_promedio: number;
  servicios: string[];
  horario_inicio?: string;
  horario_fin?: string;
}

export default function DarDescansoScreen() {
  const { colors, global, spacing } = useGameStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [barberoNombre, setBarberoNombre] = useState('');
  const [citas, setCitas] = useState<Cita[]>([]);
  const [barberosDisponibles, setBarberosDisponibles] = useState<BarberoDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [mostrarCalendario, setMostrarCalendario] = useState<'inicio' | 'fin' | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [citaEditando, setCitaEditando] = useState<Cita | null>(null);

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
    if (id) {
      cargarDatos();
    }
  }, [id]);

  // 🔥 Función para verificar si un barbero está disponible en un horario específico
  const isBarberoDisponibleEnHorario = (barbero: BarberoDisponible, fechaHora: string): boolean => {
    if (!barbero.horario_inicio || !barbero.horario_fin) return true;
    
    const fecha = new Date(fechaHora);
    const hora = fecha.getHours();
    const minutos = fecha.getMinutes();
    const horaCita = hora + minutos / 60;
    
    const [horaInicio, minInicio] = barbero.horario_inicio.split(':').map(Number);
    const [horaFin, minFin] = barbero.horario_fin.split(':').map(Number);
    const horaInicioNum = horaInicio + (minInicio || 0) / 60;
    const horaFinNum = horaFin + (minFin || 0) / 60;
    
    return horaCita >= horaInicioNum && horaCita < horaFinNum;
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const { data: barbero } = await supabase
        .from('barbers')
        .select('nombre')
        .eq('id', id)
        .single();
      if (barbero) setBarberoNombre(barbero.nombre);

      const { data: userData } = await supabase.auth.getUser();
      const { data: adminUser } = await supabase
        .from('users')
        .select('barbershop_id')
        .eq('id', userData.user?.id)
        .single();

      if (!adminUser?.barbershop_id) throw new Error('No se encontró la barbería');

      const { data: barberosData } = await supabase
        .from('barbers')
        .select('id, nombre, foto_url, calificacion_promedio, horario_inicio, horario_fin')
        .eq('barbershop_id', adminUser.barbershop_id)
        .eq('activo', true)
        .eq('archivado', false)
        .neq('id', id)
        .order('calificacion_promedio', { ascending: false });

      const barberosConServicios: BarberoDisponible[] = await Promise.all((barberosData || []).map(async (b) => {
        const { data: serviciosAsignados } = await supabase
          .from('barber_services')
          .select('service_id')
          .eq('barber_id', b.id);
        
        const serviciosIds = serviciosAsignados?.map(s => s.service_id) || [];
        
        if (serviciosIds.length === 0) {
          return { ...b, servicios: [] };
        }
        
        const { data: serviciosActivos } = await supabase
          .from('services')
          .select('id')
          .in('id', serviciosIds)
          .eq('activo', true);
        
        return {
          ...b,
          servicios: serviciosActivos?.map(s => s.id) || [],
        };
      }));
      
      setBarberosDisponibles(barberosConServicios);

      const hoy = new Date().toISOString().split('T')[0];
      const { data: citasData } = await supabase
        .from('appointments')
        .select(`
          id,
          fecha_hora,
          clients (nombre),
          services (nombre, id)
        `)
        .eq('barbero_id', id)
        .eq('estado', 'pendiente')
        .gte('fecha_hora', hoy)
        .order('fecha_hora', { ascending: true });

      // 🔥 Formatear citas con sugerencia automática (considerando horario laboral)
      const citasFormateadas: Cita[] = (citasData || []).map((item: any) => {
        const servicioId = item.services?.id;
        const fechaHoraCita = item.fecha_hora;
        
        // Buscar barberos que tengan el servicio activo Y estén disponibles en ese horario
        const barberosSugeridos = barberosConServicios.filter(b => 
          b.servicios.includes(servicioId) && 
          isBarberoDisponibleEnHorario(b, fechaHoraCita)
        );
        
        const barberoSugerido = barberosSugeridos.length > 0 ? barberosSugeridos[0] : null;
        
        return {
          id: item.id,
          fecha_hora: item.fecha_hora,
          cliente_nombre: item.clients?.nombre || 'Cliente',
          servicio_nombre: item.services?.nombre || 'Servicio',
          servicio_id: servicioId,
          barbero_sugerido_id: barberoSugerido?.id,
          barbero_sugerido_nombre: barberoSugerido?.nombre,
          barbero_seleccionado_id: barberoSugerido?.id,
          barbero_seleccionado_nombre: barberoSugerido?.nombre,
        };
      });

      setCitas(citasFormateadas);

    } catch (error: any) {
      console.error('Error:', error);
      showModal('Error', error.message || 'No se pudieron cargar los datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const seleccionarFechaInicio = (fecha: string) => {
    setFechaInicio(fecha);
    setMostrarCalendario(null);
  };

  const seleccionarFechaFin = (fecha: string) => {
    setFechaFin(fecha);
    setMostrarCalendario(null);
  };

  const abrirSelectorBarbero = (cita: Cita) => {
    setCitaEditando(cita);
    setModalVisible(true);
  };

  const seleccionarBarberoParaCita = (barberoId: string, barberoNombre: string, servicioId: string) => {
    const barberoElegido = barberosDisponibles.find(b => b.id === barberoId);
    
    if (!barberoElegido) {
      showModal('⚠️ No disponible', 'Este barbero no está disponible', 'warning');
      return;
    }
    
    if (!barberoElegido.servicios.includes(servicioId)) {
      showModal('⚠️ No disponible', 'Este barbero no ofrece este servicio', 'warning');
      return;
    }
    
    // 🔥 Verificar horario laboral para la cita específica
    if (citaEditando && !isBarberoDisponibleEnHorario(barberoElegido, citaEditando.fecha_hora)) {
      showModal('⚠️ Horario no disponible', `${barberoNombre} no trabaja en el horario de esta cita (${barberoElegido.horario_inicio} - ${barberoElegido.horario_fin})`, 'warning');
      return;
    }

    setCitas(prev => prev.map(c => 
      c.id === citaEditando?.id 
        ? { ...c, barbero_seleccionado_id: barberoId, barbero_seleccionado_nombre: barberoNombre }
        : c
    ));
    
    setModalVisible(false);
    setCitaEditando(null);
  };

  const confirmarDescanso = async () => {
    if (!fechaInicio || !fechaFin) {
      showModal('Fechas incompletas', 'Selecciona las fechas de inicio y fin del descanso', 'warning');
      return;
    }

    if (fechaInicio > fechaFin) {
      showModal('Fechas inválidas', 'La fecha de inicio debe ser anterior a la fecha de fin', 'warning');
      return;
    }

    const citasSinBarbero = citas.filter(c => !c.barbero_seleccionado_id);
    if (citasSinBarbero.length > 0) {
      showModal('⚠️ Faltan asignaciones', `${citasSinBarbero.length} cita(s) no tienen barbero asignado. Asigna uno antes de continuar.`, 'warning');
      return;
    }

    setGuardando(true);

    for (const cita of citas) {
      await supabase
        .from('appointments')
        .update({ barbero_id: cita.barbero_seleccionado_id })
        .eq('id', cita.id);
    }

    const { error } = await supabase
      .from('barbers')
      .update({
        descanso_inicio: fechaInicio,
        descanso_fin: fechaFin,
      })
      .eq('id', id);

    if (error) {
      showModal('Error', 'No se pudo guardar el período de descanso', 'error');
    } else {
      showModal(
        '✅ Descanso programado',
        `${barberoNombre} descansará del ${fechaInicio} al ${fechaFin}.\n\n${citas.length} cita(s) han sido reasignadas.`,
        'success',
        () => router.back()
      );
    }

    setGuardando(false);
  };

  const formatFechaHora = (fechaHora: string) => {
    const fecha = new Date(fechaHora);
    return `${fecha.getDate()}/${fecha.getMonth() + 1} - ${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando citas pendientes...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={global.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={{ 
        marginTop: spacing.xl, 
        marginBottom: spacing.lg, 
        paddingHorizontal: spacing.lg,
      }}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            gap: spacing.xs,
            marginBottom: spacing.md,
            alignSelf: 'flex-start',
          }}
        >
          <Feather name="arrow-left" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '500' }}>Volver</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.glass,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.primary,
          }}>
            <Feather name="calendar" size={20} color={colors.primary} />
          </View>
          <Text style={[global.headerTitle, { fontSize: 26, letterSpacing: 1 }]}>
            Dar descanso
          </Text>
        </View>

        <View style={{ 
          marginTop: spacing.xs,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          backgroundColor: colors.glass,
          borderRadius: 20,
          alignSelf: 'flex-start',
        }}>
          <Text style={{ color: colors.gold, fontSize: 13, fontWeight: '600' }}>
            👤 {barberoNombre}
          </Text>
        </View>
        
        <Text style={[global.text, { color: colors.textSecondary, fontSize: 13, marginTop: spacing.sm, lineHeight: 18 }]}>
          Selecciona las fechas que {barberoNombre} estará de descanso y reasigna sus citas pendientes a otros barberos.
        </Text>
      </View>

      {/* Selección de fechas */}
      <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <Feather name="calendar" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15 }}>
            Período de descanso
          </Text>
        </View>

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.glass,
            padding: spacing.md,
            borderRadius: 12,
            marginBottom: spacing.sm,
            borderWidth: 1,
            borderColor: fechaInicio ? colors.primary : colors.glassBorder,
          }}
          onPress={() => setMostrarCalendario('inicio')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Feather name="sunrise" size={16} color={colors.gold} />
            <Text style={{ color: colors.text }}>Fecha inicio</Text>
          </View>
          <Text style={{ color: fechaInicio ? colors.gold : colors.textMuted, fontWeight: fechaInicio ? '600' : '400' }}>
            {fechaInicio || 'Seleccionar'}
          </Text>
        </TouchableOpacity>

        {mostrarCalendario === 'inicio' && (
          <CalendarPicker
            barberoId={id as string}
            onSelectDate={seleccionarFechaInicio}
            selectedDate={fechaInicio}
          />
        )}

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.glass,
            padding: spacing.md,
            borderRadius: 12,
            marginTop: spacing.sm,
            borderWidth: 1,
            borderColor: fechaFin ? colors.primary : colors.glassBorder,
          }}
          onPress={() => setMostrarCalendario('fin')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Feather name="sunset" size={16} color={colors.gold} />
            <Text style={{ color: colors.text }}>Fecha fin</Text>
          </View>
          <Text style={{ color: fechaFin ? colors.gold : colors.textMuted, fontWeight: fechaFin ? '600' : '400' }}>
            {fechaFin || 'Seleccionar'}
          </Text>
        </TouchableOpacity>

        {mostrarCalendario === 'fin' && (
          <CalendarPicker
            barberoId={id as string}
            onSelectDate={seleccionarFechaFin}
            selectedDate={fechaFin}
          />
        )}
      </GameCard>

      {/* Lista de citas */}
      <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="list" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15 }}>
            Citas durante el descanso
          </Text>
          <View style={{ 
            backgroundColor: colors.primary, 
            paddingHorizontal: 8, 
            paddingVertical: 2, 
            borderRadius: 12,
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{citas.length}</Text>
          </View>
        </View>
      </View>

      {citas.length === 0 ? (
        <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.sm }}>
            <Feather name="check-circle" size={48} color={colors.success} />
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>
              No hay citas pendientes
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
              {barberoNombre} no tiene citas pendientes durante el período seleccionado
            </Text>
          </View>
        </GameCard>
      ) : (
        citas.map((cita) => (
          <GameCard key={cita.id} variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' }}>
                <Feather name="user" size={22} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15 }}>{cita.cliente_nombre}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Feather name="clock" size={10} color={colors.textMuted} />
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{formatFechaHora(cita.fecha_hora)}</Text>
                </View>
              </View>
            </View>

            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: spacing.sm, 
              backgroundColor: colors.glass,
              padding: spacing.sm,
              borderRadius: 10,
              marginBottom: spacing.md,
            }}>
              <Feather name="scissors" size={14} color={colors.gold} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>{cita.servicio_nombre}</Text>
            </View>

            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              paddingTop: spacing.sm, 
              borderTopWidth: 1, 
              borderTopColor: colors.glassBorder,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 2 }}>Reasignar a:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name="user-check" size={14} color={colors.primary} />
                  <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 14 }}>
                    {cita.barbero_seleccionado_nombre || 'Sin asignar'}
                  </Text>
                </View>
              </View>
              <GameButton
                title="Cambiar"
                variant="secondary"
                compact
                icon="edit-2"
                onPress={() => abrirSelectorBarbero(cita)}
                style={{ minWidth: 85 }}
              />
            </View>
          </GameCard>
        ))
      )}

      {/* Botón final */}
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, marginBottom: spacing.xl }}>
        <GameButton
          title={guardando ? "Guardando..." : "Confirmar descanso"}
          variant="primary"
          onPress={confirmarDescanso}
          loading={guardando}
          icon="check-circle"
          style={{ borderRadius: 14 }}
        />
      </View>

      {/* Modal selector de barbero MEJORADO */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.85)',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: colors.card,
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.primary,
            maxHeight: '85%',
          }}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Feather name="repeat" size={22} color={colors.primary} />
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                  Reasignar cita
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setModalVisible(false);
                  setCitaEditando(null);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.glass,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Feather name="x" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{
              backgroundColor: colors.glass,
              borderRadius: 16,
              padding: 16,
              marginBottom: 20,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Feather name="user" size={14} color={colors.gold} />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Cliente:</Text>
                <Text style={{ color: colors.gold, fontWeight: 'bold', fontSize: 14 }}>
                  {citaEditando?.cliente_nombre}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Feather name="scissors" size={14} color={colors.gold} />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Servicio:</Text>
                <Text style={{ color: colors.gold, fontWeight: 'bold', fontSize: 14 }}>
                  {citaEditando?.servicio_nombre}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="clock" size={14} color={colors.gold} />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Horario:</Text>
                <Text style={{ color: colors.gold, fontWeight: 'bold', fontSize: 14 }}>
                  {citaEditando?.fecha_hora ? formatFechaHora(citaEditando.fecha_hora) : 'No disponible'}
                </Text>
              </View>
            </View>

            <Text style={{ color: colors.textSecondary, marginBottom: 12, fontSize: 12 }}>
              Selecciona un barbero para reasignar esta cita:
            </Text>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {barberosDisponibles.length === 0 ? (
                <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <Feather name="alert-circle" size={40} color={colors.warning} />
                  <Text style={{ color: colors.text, textAlign: 'center', marginTop: spacing.sm }}>
                    No hay barberos disponibles
                  </Text>
                </View>
              ) : (
                barberosDisponibles.map((item) => {
                  const tieneServicio = item.servicios.includes(citaEditando?.servicio_id || '');
                  const disponibleEnHorario = citaEditando ? isBarberoDisponibleEnHorario(item, citaEditando.fecha_hora) : true;
                  const puede = tieneServicio && disponibleEnHorario;
                  const esSugerido = citaEditando?.barbero_sugerido_id === item.id;
                  
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.glass,
                        padding: 14,
                        borderRadius: 14,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: esSugerido ? colors.primary : colors.glassBorder,
                        opacity: puede ? 1 : 0.6,
                      }}
                      onPress={() => {
                        if (puede && citaEditando) {
                          seleccionarBarberoParaCita(item.id, item.nombre, citaEditando.servicio_id);
                        } else if (!tieneServicio) {
                          showModal('⚠️ No disponible', `${item.nombre} no ofrece el servicio "${citaEditando?.servicio_nombre}"`, 'warning');
                        } else if (!disponibleEnHorario) {
                          showModal('⚠️ Horario no disponible', `${item.nombre} solo trabaja de ${item.horario_inicio} a ${item.horario_fin}`, 'warning');
                        }
                      }}
                      disabled={!puede}
                    >
                      {item.foto_url ? (
                        <Image source={{ uri: item.foto_url }} style={{ width: 50, height: 50, borderRadius: 25, marginRight: 14 }} />
                      ) : (
                        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                          <Feather name="user" size={24} color={colors.textSecondary} />
                        </View>
                      )}
                      
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15 }}>{item.nombre}</Text>
                          {esSugerido && (
                            <View style={{ backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                              <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>⭐ Sugerido</Text>
                            </View>
                          )}
                        </View>
                        {item.calificacion_promedio > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <Feather name="star" size={12} color={colors.gold} />
                            <Text style={{ color: colors.gold, fontSize: 11 }}>{item.calificacion_promedio.toFixed(1)}</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Feather name="clock" size={10} color={colors.textMuted} />
                          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                            {item.horario_inicio || '09:00'} - {item.horario_fin || '19:00'}
                          </Text>
                        </View>
                        {!tieneServicio && (
                          <Text style={{ color: colors.warning, fontSize: 10, marginTop: 2 }}>
                            ❌ No ofrece este servicio
                          </Text>
                        )}
                        {tieneServicio && !disponibleEnHorario && (
                          <Text style={{ color: colors.warning, fontSize: 10, marginTop: 2 }}>
                            ⏰ No trabaja en este horario
                          </Text>
                        )}
                      </View>
                      
                      <Feather name="chevron-right" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            
            <GameButton 
              title="Cancelar" 
              variant="danger" 
              onPress={() => setModalVisible(false)}
              style={{ marginTop: 20 }}
            />
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
        confirmText="Aceptar"
        cancelText="Cancelar"
      />
    </ScrollView>
  );
}
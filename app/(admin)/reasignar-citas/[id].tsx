import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../../services/supabase/client';
import { useGameStyles } from '../../hooks/useGameStyles';
import { CustomModal } from '../../styles/components/ui/CustomModal';
import { GameButton } from '../../styles/components/ui/GameButton';
import { GameCard } from '../../styles/components/ui/GameCard';

interface Cita {
  id: string;
  fecha_hora: string;
  cliente_nombre: string;
  cliente_telefono: string;
  servicio_nombre: string;
  servicio_id: string;
  servicio_duracion: number;
  precio: number;
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

export default function ReasignarCitasScreen() {
  const { colors, global, spacing } = useGameStyles();
  const params = useLocalSearchParams();
  const id = params.id as string;
  const origen = params.origen as string;
  const nuevoHorarioInicio = params.nuevoHorarioInicio as string;
  const nuevoHorarioFin = params.nuevoHorarioFin as string;
  
  const [barberoNombre, setBarberoNombre] = useState('');
  const [citas, setCitas] = useState<Cita[]>([]);
  const [barberosDisponibles, setBarberosDisponibles] = useState<BarberoDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasignando, setReasignando] = useState(false);

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
    
    const disponible = horaCita >= horaInicioNum && horaCita < horaFinNum;
    console.log(`📋 ${barbero.nombre}: Horario ${barbero.horario_inicio}-${barbero.horario_fin}, Cita a las ${horaCita}h → ${disponible ? 'Disponible' : 'No disponible'}`);
    
    return disponible;
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

      const hoy = new Date().toISOString().split('T')[0];
      const { data: citasData, error: citasError } = await supabase
        .from('appointments')
        .select(`
          id,
          fecha_hora,
          total,
          clients (nombre, telefono),
          services (nombre, duracion_min, id)
        `)
        .eq('barbero_id', id)
        .eq('estado', 'pendiente')
        .gte('fecha_hora', hoy)
        .order('fecha_hora', { ascending: true });

      if (citasError) throw citasError;

      let citasFiltradas = citasData || [];

      if (origen === 'horario' && nuevoHorarioInicio && nuevoHorarioFin) {
        const [nuevaHoraInicio, nuevaHoraInicioMin] = nuevoHorarioInicio.split(':').map(Number);
        const [nuevaHoraFin, nuevaHoraFinMin] = nuevoHorarioFin.split(':').map(Number);
        
        citasFiltradas = citasFiltradas.filter(cita => {
          const fechaCita = new Date(cita.fecha_hora);
          const horaCita = fechaCita.getHours();
          const minCita = fechaCita.getMinutes();
          
          const horaInicioNum = nuevaHoraInicio + (nuevaHoraInicioMin || 0) / 60;
          const horaFinNum = nuevaHoraFin + (nuevaHoraFinMin || 0) / 60;
          const horaCitaNum = horaCita + minCita / 60;
          
          return horaCitaNum < horaInicioNum || horaCitaNum >= horaFinNum;
        });
      }

      // 🔥 Para cada barbero, obtener servicios activos Y verificar disponibilidad por horario
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

      // Filtrar barberos disponibles para CADA cita según su horario laboral
      // Para la sugerencia automática, verificamos si el barbero está disponible en el horario de la cita
      const citasFormateadas: Cita[] = citasFiltradas.map((item: any) => {
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
          cliente_telefono: item.clients?.telefono || '',
          servicio_nombre: item.services?.nombre || 'Servicio',
          servicio_id: servicioId,
          servicio_duracion: item.services?.duracion_min || 30,
          precio: item.total || 0,
          barbero_sugerido_id: barberoSugerido?.id,
          barbero_sugerido_nombre: barberoSugerido?.nombre,
          barbero_seleccionado_id: barberoSugerido?.id,
          barbero_seleccionado_nombre: barberoSugerido?.nombre,
        };
      });

      setCitas(citasFormateadas);
      setBarberosDisponibles(barberosConServicios);

    } catch (error: any) {
      console.error('Error:', error);
      showModal('Error', error.message || 'No se pudieron cargar los datos', 'error');
    } finally {
      setLoading(false);
    }
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

  const finalizarReasignacion = async () => {
    const citasSinBarbero = citas.filter(c => !c.barbero_seleccionado_id);
    
    if (citasSinBarbero.length > 0) {
      showModal('⚠️ Faltan asignaciones', `${citasSinBarbero.length} cita(s) no tienen barbero asignado.`, 'warning');
      return;
    }

    setReasignando(true);

    for (const cita of citas) {
      await supabase
        .from('appointments')
        .update({ barbero_id: cita.barbero_seleccionado_id })
        .eq('id', cita.id);
    }

    if (origen === 'horario') {
      const { error } = await supabase
        .from('barbers')
        .update({
          horario_inicio: nuevoHorarioInicio,
          horario_fin: nuevoHorarioFin,
        })
        .eq('id', id);
      
      if (error) {
        showModal('Error', 'No se pudo actualizar el horario', 'error');
      } else {
        showModal('✅ Horario actualizado', `Horario de ${barberoNombre} actualizado a ${nuevoHorarioInicio} - ${nuevoHorarioFin}.\n\n${citas.length} cita(s) han sido reasignadas.`, 'success', () => router.back());
      }
    } else {
      await supabase
        .from('barbers')
        .update({ activo: false, archivado: true, archivado_en: new Date().toISOString() })
        .eq('id', id);
      
      showModal('✅ Barbero archivado', `${barberoNombre} ha sido archivado y sus ${citas.length} cita(s) reasignadas.`, 'success', () => router.back());
    }
    
    setReasignando(false);
  };

  const archivarSinReasignar = async () => {
    if (origen === 'horario') {
      showModal('Cancelar cambio de horario', 'El horario no se modificará. Las citas quedarán como están.', 'warning', () => router.back());
      return;
    }
    
    showModal('Archivar sin reasignar', `${barberoNombre} será archivado y sus ${citas.length} cita(s) quedarán sin atender.`, 'warning', async () => {
      setReasignando(true);
      await supabase
        .from('barbers')
        .update({ activo: false, archivado: true, archivado_en: new Date().toISOString() })
        .eq('id', id);
      showModal('✅ Barbero archivado', `${barberoNombre} ha sido archivado.`, 'success', () => router.back());
      setReasignando(false);
    });
  };

  const formatFechaHora = (fechaHora: string) => {
    const fecha = new Date(fechaHora);
    return `${fecha.getDate()}/${fecha.getMonth() + 1} ${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`;
  };

  const getSubtitulo = () => {
    if (origen === 'horario') {
      return `${barberoNombre} cambiará su horario a ${nuevoHorarioInicio} - ${nuevoHorarioFin}. Reasigna sus ${citas.length} cita(s) fuera de este horario.`;
    }
    return `${barberoNombre} será archivado. Reasigna sus ${citas.length} cita(s) pendiente(s)`;
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
    <View style={global.container}>
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Feather name="arrow-left" size={24} color={colors.primary} />
        </TouchableOpacity>
        
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[global.headerTitle, { fontSize: 18 }]}>
            {origen === 'horario' ? 'Reasignar por horario' : 'Reasignar citas'}
          </Text>
        </View>
        
        <View style={{ width: 40 }} />
      </View>

      <Text style={[global.headerSubtitle, { textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.lg }]}>
        {getSubtitulo()}
      </Text>

      {citas.length === 0 ? (
        <View style={global.emptyContainer}>
          <Feather name="check-circle" size={64} color={colors.success} />
          <Text style={global.emptyText}>
            {origen === 'horario' ? 'No hay citas fuera del nuevo horario' : 'No hay citas pendientes'}
          </Text>
          <GameButton 
            title={origen === 'horario' ? 'Volver y guardar horario' : 'Archivar barbero'} 
            variant="danger" 
            onPress={archivarSinReasignar} 
            style={{ marginTop: spacing.lg }} 
          />
        </View>
      ) : (
        <>
          <FlatList
            data={citas}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
                  <View style={{ width: 45, height: 45, borderRadius: 22.5, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' }}>
                    <Feather name="user" size={22} color={colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item.cliente_nombre}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.cliente_telefono}</Text>
                  </View>
                  <Text style={{ color: colors.gold, fontWeight: 'bold' }}>${item.precio}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                  <Feather name="calendar" size={12} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formatFechaHora(item.fecha_hora)}</Text>
                  <Feather name="scissors" size={12} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.servicio_nombre}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.glassBorder }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Reasignar a:</Text>
                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item.barbero_seleccionado_nombre || 'Sin asignar'}</Text>
                  </View>
                  <GameButton title="Cambiar" variant="secondary" compact icon="edit-2" onPress={() => abrirSelectorBarbero(item)} style={{ minWidth: 90 }} />
                </View>
              </GameCard>
            )}
            contentContainerStyle={{ paddingBottom: spacing.md }}
          />

          <View style={{ padding: spacing.lg, gap: spacing.md, marginBottom: spacing.xl }}>
            <GameButton 
              title={origen === 'horario' ? 'Confirmar reasignación y actualizar horario' : 'Confirmar reasignación y archivar'} 
              variant="primary" 
              onPress={finalizarReasignacion} 
              loading={reasignando} 
              icon="check-circle" 
            />
          </View>
        </>
      )}

      {/* Modal selector de barbero mejorado */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setModalVisible(false);
          setCitaEditando(null);
        }}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="scissors" size={14} color={colors.gold} />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Servicio:</Text>
                <Text style={{ color: colors.gold, fontWeight: 'bold', fontSize: 14 }}>
                  {citaEditando?.servicio_nombre}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
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
              onPress={() => {
                setModalVisible(false);
                setCitaEditando(null);
              }}
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
    </View>
  );
}
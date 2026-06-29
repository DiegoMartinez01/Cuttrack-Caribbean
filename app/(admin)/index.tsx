import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary';
import { useGameStyles } from '../hooks/useGameStyles';
import { useNotifications } from '../hooks/useNotifications'; // 🔥 NUEVO: Notificaciones
import { GameButton } from '../styles/components/ui/GameButton';
import { GameCard } from '../styles/components/ui/GameCard';
import { InvitationModal } from '../styles/components/ui/InvitationModal';

const { width } = Dimensions.get('window');

export default function AdminDashboard() {
  const { colors, global, spacing } = useGameStyles();
  
  // 🔥 HOOKS
  const { 
    getIcon, 
    employeePlural,
    employeeName,
    appointmentPlural,
    appointmentName,
    servicePlural,
    serviceName,
    actionBook,
    statusCompleted,
    statusPending,
    statusCancelled,
  } = useBusinessDictionary();

  const { notify } = useNotifications(); // 🔥 NUEVO: Notificaciones
  
  const [gananciasTotales, setGananciasTotales] = useState(0);
  const [gananciasHoy, setGananciasHoy] = useState(0);
  const [gananciasSemana, setGananciasSemana] = useState(0);
  const [citasHoy, setCitasHoy] = useState<any[]>([]);
  const [citasPendientes, setCitasPendientes] = useState(0);
  const [citasCompletadas, setCitasCompletadas] = useState(0);
  const [ultimasCitas, setUltimasCitas] = useState<any[]>([]);
  const [topBarbero, setTopBarbero] = useState<{ id: string; nombre: string; count: number; foto_url?: string } | null>(null);
  const [rankingBarberos, setRankingBarberos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [barberosIds, setBarberosIds] = useState<string[]>([]);
  const [codigoBarberia, setCodigoBarberia] = useState<string | null>(null);
  const [negocioNombre, setNegocioNombre] = useState<string>('');
  
  // 🔥 Estado para el modal de invitación
  const [invitationModalVisible, setInvitationModalVisible] = useState(false);
  
  // 🔥 Estado para meta de ingresos (evitar notificar varias veces)
  const [metaNotificada, setMetaNotificada] = useState(false);
  const [totalClientes, setTotalClientes] = useState(0);
  const [clientesAnteriores, setClientesAnteriores] = useState(0);
  
  const [paginaCitasHoy, setPaginaCitasHoy] = useState(0);
  const [paginaUltimasCitas, setPaginaUltimasCitas] = useState(0);
  const itemsPorPagina = 4;

  const [modalComisionesVisible, setModalComisionesVisible] = useState(false);
  const [periodoComisiones, setPeriodoComisiones] = useState<'hoy' | 'semana' | 'mes' | 'total'>('hoy');
  const [comisionesPorBarbero, setComisionesPorBarbero] = useState<any[]>([]);
  const [totalComisionesPeriodo, setTotalComisionesPeriodo] = useState(0);
  const [cargandoComisiones, setCargandoComisiones] = useState(false);

  const [datosInicialesCargados, setDatosInicialesCargados] = useState(false);

  useEffect(() => {
    if (!datosInicialesCargados) {
      cargarDatosIniciales();
    }
  }, [datosInicialesCargados]);

  const cargarDatosIniciales = async () => {
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

      const { data: barbershopData } = await supabase
        .from('barbershops')
        .select('nombre, codigo_unico')
        .eq('id', adminUser.barbershop_id)
        .single();

      if (barbershopData) {
        setNegocioNombre(barbershopData.nombre);
        setCodigoBarberia(barbershopData.codigo_unico);
      }

      // 🔥 Obtener total de clientes
      const { count: clientesCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('barbershop_id', adminUser.barbershop_id);

      setTotalClientes(clientesCount || 0);
      setClientesAnteriores(clientesCount || 0);

      const { data: barberosData, error: barberosError } = await supabase
        .from('barbers')
        .select('id, nombre, calificacion_promedio, total_reseñas, foto_url, porcentaje_comision')
        .eq('barbershop_id', adminUser.barbershop_id);

      if (barberosError) throw barberosError;
      
      const ids = (Array.isArray(barberosData) ? barberosData : []).map((b: any) => b.id);
      setBarberosIds(ids);
      
      const ranking = (barberosData || []).sort((a: any, b: any) => 
        (b?.calificacion_promedio || 0) - (a?.calificacion_promedio || 0)
      );
      setRankingBarberos(ranking);

      if (ids.length > 0) {
        await cargarDashboard(ids);
      } else {
        setLoading(false);
      }
      
      setDatosInicialesCargados(true);

    } catch (error: any) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', error.message);
      setLoading(false);
      setDatosInicialesCargados(true);
    }
  };

  const cargarDashboard = async (barberosIdsList: string[]) => {
    console.log('📡 Cargando dashboard con empleados:', barberosIdsList);
    
    if (barberosIdsList.length === 0) {
      setLoading(false);
      return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyStr = hoy.toISOString().split('T')[0];
    
    const semanaAtras = new Date();
    semanaAtras.setDate(semanaAtras.getDate() - 7);
    
    const { data: citasCompletadasData } = await supabase
      .from('appointments')
      .select('total, fecha_hora, estado, barbero_id')
      .in('barbero_id', barberosIdsList)
      .eq('estado', 'completada');
    
    const completadas = citasCompletadasData || [];
    setCitasCompletadas(completadas.length);
    
    const total = completadas.reduce((sum, c) => sum + c.total, 0);
    setGananciasTotales(total);
    
    const hoyCitas = completadas.filter(c => {
      const citaDate = new Date(c.fecha_hora);
      return citaDate.toDateString() === hoy.toDateString();
    });
    setGananciasHoy(hoyCitas.reduce((sum, c) => sum + c.total, 0));
    
    const semanaCitas = completadas.filter(c => {
      const citaDate = new Date(c.fecha_hora);
      return citaDate >= semanaAtras;
    });
    const gananciasSemanaActual = semanaCitas.reduce((sum, c) => sum + c.total, 0);
    setGananciasSemana(gananciasSemanaActual);
    
    // 🔥 NOTIFICACIÓN DE META ALCANZADA (ej: $1,000,000 COP)
    const meta = 1000000; // $1,000,000 COP
    if (gananciasSemanaActual >= meta && !metaNotificada && gananciasSemanaActual > 0) {
      try {
        await notify(
          'PROMOTION',
          '🏆 ¡Meta cumplida!',
          `¡Alcanzaste $${gananciasSemanaActual.toLocaleString('es-CO')} esta semana! 🎉`,
          { amount: gananciasSemanaActual }
        );
        setMetaNotificada(true);
      } catch (notifError) {
        console.log('⚠️ Error en notificación (no crítico):', notifError);
      }
    }
    
    const { data: pendientesData } = await supabase
      .from('appointments')
      .select('id')
      .in('barbero_id', barberosIdsList)
      .eq('estado', 'pendiente');
    setCitasPendientes(pendientesData?.length || 0);
    
    const { data: citasHoyData } = await supabase
      .from('appointments')
      .select(`
        id, fecha_hora, estado, total,
        clients (id, nombre, telefono, foto_url),
        barbers (id, nombre),
        services (nombre, foto_url)
      `)
      .in('barbero_id', barberosIdsList)
      .gte('fecha_hora', `${hoyStr} 00:00:00`)
      .lte('fecha_hora', `${hoyStr} 23:59:59`);
    setCitasHoy(citasHoyData || []);
    
    const { data: ultimasCitasData } = await supabase
      .from('appointments')
      .select(`
        id, fecha_hora, estado, total,
        clients (id, nombre, telefono, foto_url),
        barbers (id, nombre),
        services (nombre, foto_url)
      `)
      .in('barbero_id', barberosIdsList)
      .order('created_at', { ascending: false })
      .limit(20);
    setUltimasCitas(ultimasCitasData || []);
    
    const barberoStats: Record<string, { count: number; nombre: string; foto_url?: string }> = {};
    completadas.forEach(c => { 
      if (c.barbero_id) {
        if (!barberoStats[c.barbero_id]) {
          barberoStats[c.barbero_id] = { count: 0, nombre: '', foto_url: '' };
        }
        barberoStats[c.barbero_id].count++;
      }
    });
    if (Object.keys(barberoStats).length > 0) {
      const topId = Object.entries(barberoStats).sort((a, b) => b[1].count - a[1].count)[0];
      const { data: barberoTop } = await supabase
        .from('barbers')
        .select('nombre, foto_url')
        .eq('id', topId[0])
        .single();
      setTopBarbero({ 
        id: topId[0], 
        nombre: barberoTop?.nombre || 'Desconocido', 
        count: topId[1].count,
        foto_url: barberoTop?.foto_url
      });
    }
    
    // 🔥 DETECTAR NUEVOS CLIENTES
    const { count: clientesCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('barbershop_id', barbershopId);

    if (clientesCount !== null && clientesCount > clientesAnteriores) {
      const nuevos = clientesCount - clientesAnteriores;
      // Obtener el último cliente registrado
      const { data: ultimoCliente } = await supabase
        .from('clients')
        .select('nombre')
        .eq('barbershop_id', barbershopId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (ultimoCliente) {
        try {
          await notify(
            'NEW_CLIENT',
            '👤 ¡Nuevo cliente!',
            `${ultimoCliente.nombre || 'Un cliente'} se sumó a ${negocioNombre}`,
            { clientName: ultimoCliente.nombre }
          );
        } catch (notifError) {
          console.log('⚠️ Error en notificación (no crítico):', notifError);
        }
      }
      setClientesAnteriores(clientesCount);
    }
    setTotalClientes(clientesCount || 0);
    
    setLoading(false);
    setRefreshing(false);
    setPaginaCitasHoy(0);
    setPaginaUltimasCitas(0);
  };

  const cargarComisionesPorPeriodo = async (periodo: 'hoy' | 'semana' | 'mes' | 'total') => {
    if (!barberosIds.length) return;
    
    setCargandoComisiones(true);
    
    let fechaInicio: Date | null = null;
    
    switch (periodo) {
      case 'hoy':
        fechaInicio = new Date();
        fechaInicio.setHours(0, 0, 0, 0);
        break;
      case 'semana':
        fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 7);
        break;
      case 'mes':
        fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 30);
        break;
      case 'total':
        fechaInicio = null;
        break;
    }
    
    let query = supabase
      .from('appointments')
      .select(`
        ganancia_barbero,
        barbero_id,
        barbers (id, nombre, foto_url, porcentaje_comision)
      `)
      .in('barbero_id', barberosIds)
      .eq('estado', 'completada');
    
    if (fechaInicio) {
      query = query.gte('fecha_hora', fechaInicio.toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error cargando comisiones:', error);
      Alert.alert('Error', 'No se pudieron cargar las comisiones');
      setCargandoComisiones(false);
      return;
    }
    
    const mapa = new Map();
    data?.forEach(cita => {
      const barbero = cita.barbers?.[0];
      if (barbero && barbero.id) {
        if (!mapa.has(barbero.id)) {
          mapa.set(barbero.id, {
            id: barbero.id,
            nombre: barbero.nombre,
            foto_url: barbero.foto_url,
            porcentaje: barbero.porcentaje_comision || 100,
            totalComision: 0,
            cantidadCitas: 0
          });
        }
        const item = mapa.get(barbero.id);
        item.totalComision += (cita.ganancia_barbero || 0);
        item.cantidadCitas++;
      }
    });
    
    const comisionesArray = Array.from(mapa.values())
      .sort((a, b) => b.totalComision - a.totalComision);
    
    const total = comisionesArray.reduce((sum, c) => sum + c.totalComision, 0);
    
    setComisionesPorBarbero(comisionesArray);
    setTotalComisionesPeriodo(total);
    setCargandoComisiones(false);
  };

  const abrirModalComisiones = () => {
    setModalComisionesVisible(true);
    setPeriodoComisiones('hoy');
    cargarComisionesPorPeriodo('hoy');
  };

  const cambiarPeriodo = (periodo: 'hoy' | 'semana' | 'mes' | 'total') => {
    setPeriodoComisiones(periodo);
    cargarComisionesPorPeriodo(periodo);
  };

  const getPeriodoTexto = (periodo: string) => {
    switch (periodo) {
      case 'hoy': return 'Hoy';
      case 'semana': return 'Esta semana';
      case 'mes': return 'Este mes';
      case 'total': return 'Total histórico';
      default: return '';
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (barberosIds.length > 0 && datosInicialesCargados) {
        cargarDashboard(barberosIds);
      }
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setMetaNotificada(false); // Resetear meta para que pueda notificar de nuevo
    if (barberosIds.length > 0) {
      cargarDashboard(barberosIds);
    } else {
      setRefreshing(false);
    }
  }, [barberosIds]);

  const handleLogout = async () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        onPress: async () => {
          await storage.multiRemove(['user_rol', 'owner_email']);
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        }
      }
    ]);
  };

  const getItemsPaginados = (items: any[], pagina: number) => {
    const inicio = pagina * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    return items.slice(inicio, fin);
  };

  const totalPaginasCitasHoy = Math.ceil(citasHoy.length / itemsPorPagina);
  const totalPaginasUltimasCitas = Math.ceil(ultimasCitas.length / itemsPorPagina);

  const formatHora = (fechaHora: string) => {
    const fecha = new Date(fechaHora);
    return `${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`;
  };
  
  const formatFecha = (fechaHora: string) => {
    const [year, month, day] = fechaHora.split('T')[0].split('-');
    return `${day}/${month}`;
  };
  
  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'completada': return colors.success;
      case 'cancelada': return colors.error;
      default: return colors.gold;
    }
  };

  const renderEstrellas = (calificacion: number) => {
    const estrellas = [];
    const redondeado = Math.round(calificacion * 2) / 2;
    const estrellasLlenas = Math.floor(redondeado);
    const tieneMedia = redondeado % 1 !== 0;
    
    for (let i = 0; i < estrellasLlenas; i++) {
      estrellas.push('⭐');
    }
    if (tieneMedia) {
      estrellas.push('½');
    }
    for (let i = estrellas.length; i < 5; i++) {
      estrellas.push('☆');
    }
    return estrellas.join('');
  };

  const renderCitaCard = (cita: any) => (
    <GameCard key={cita.id} variant="elevated" style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {cita.clients?.foto_url ? (
          <Image 
            source={{ uri: cita.clients.foto_url }} 
            style={{ width: 50, height: 50, borderRadius: 25 }}
          />
        ) : (
          <View style={{ 
            width: 50, 
            height: 50, 
            borderRadius: 25, 
            backgroundColor: colors.glass,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Feather name="user" size={24} color={colors.textSecondary} />
          </View>
        )}
        
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
            <Text style={[global.text, { fontWeight: 'bold', fontSize: 14 }]}>{cita.clients?.nombre || 'Cliente'}</Text>
            <View style={{ backgroundColor: getEstadoColor(cita.estado), paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 12 }}>
              <Text style={{ color: colors.background, fontSize: 10, fontWeight: 'bold' }}>
                {cita.estado === 'completada' ? (statusCompleted || 'Completada') : 
                 cita.estado === 'cancelada' ? (statusCancelled || 'Cancelada') : 
                 (statusPending || 'Pendiente')}
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
            {cita.services?.foto_url ? (
              <Image 
                source={{ uri: cita.services.foto_url }} 
                style={{ width: 20, height: 20, borderRadius: 4 }}
              />
            ) : (
              <Feather name={getIcon('service') as any} size={12} color={colors.textSecondary} />
            )}
            <Text style={global.textSecondary}>
              {cita.services?.nombre || (serviceName || 'Servicio')} con {cita.barbers?.nombre || (employeeName || 'Barbero')}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
            <Feather name="calendar" size={12} color={colors.textSecondary} />
            <Text style={global.textSecondary}>{formatFecha(cita.fecha_hora)} - {formatHora(cita.fecha_hora)}</Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Feather name="dollar-sign" size={12} color={colors.gold} />
            <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold' }}>${cita.total?.toLocaleString('es-CO') || 0}</Text>
          </View>
        </View>
      </View>
    </GameCard>
  );

  const renderSeccion = (titulo: string, items: any[], pagina: number, setPagina: (p: number) => void, totalPaginas: number, vacioMsg: string, iconName: keyof typeof Feather.glyphMap) => (
    <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Feather name={iconName} size={20} color={colors.gold} />
        <Text style={[global.text, { fontSize: 18, fontWeight: 'bold' }]}>{titulo}</Text>
      </View>
      {items.length === 0 ? (
        <View style={{ alignItems: 'center', padding: spacing.xl, backgroundColor: colors.card, borderRadius: 16 }}>
          <Feather name="calendar" size={32} color={colors.textMuted} />
          <Text style={[global.emptyText, { marginTop: spacing.sm }]}>{vacioMsg}</Text>
        </View>
      ) : (
        <>
          {getItemsPaginados(items, pagina).map((cita) => renderCitaCard(cita))}
          {totalPaginas > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, gap: spacing.md }}>
              <GameButton 
                title="← Anterior"
                variant="secondary"
                onPress={() => setPagina(Math.max(0, pagina - 1))}
                disabled={pagina === 0}
                style={{ flex: 1 }}
              />
              <Text style={{ color: colors.gold }}>{pagina + 1} / {totalPaginas}</Text>
              <GameButton 
                title="Siguiente →"
                variant="secondary"
                onPress={() => setPagina(Math.min(totalPaginas - 1, pagina + 1))}
                disabled={pagina === totalPaginas - 1}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando dashboard...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={global.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={[global.header, { paddingTop: spacing.xl, paddingBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Feather name={getIcon('business') as any} size={28} color={colors.primary} />
            <Text style={[global.headerTitle, { fontSize: 28, letterSpacing: 1 }]}>Dashboard</Text>
          </View>
          <GameButton 
            title="Ver comisiones"
            variant="secondary"
            onPress={abrirModalComisiones}
            compact
            icon="dollar-sign"
          />
        </View>

        <GameCard 
          variant="game" 
          style={{ 
            marginHorizontal: spacing.lg, 
            marginTop: spacing.md, 
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
          }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              <Feather name="key" size={14} color={colors.gold} />
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold' }}>
                Código de invitación
              </Text>
            </View>
            <Text style={{ color: colors.primary, fontSize: 24, fontWeight: 'bold', letterSpacing: 2 }}>
              {codigoBarberia || 'Cargando...'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>
              Compártelo con tus clientes
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <GameButton 
              title="QR"
              variant="primary"
              compact
              icon="maximize-2"
              onPress={() => setInvitationModalVisible(true)}
            />
          </View>
        </GameCard>
        
        <View style={{ flexDirection: 'row', gap: spacing.base, paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
            <Feather name="dollar-sign" size={24} color={colors.gold} />
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>${gananciasTotales.toLocaleString('es-CO')}</Text>
            <Text style={global.textSecondary}>Ganancias totales</Text>
          </GameCard>
          <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
            <Feather name="sun" size={24} color={colors.gold} />
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>${gananciasHoy.toLocaleString('es-CO')}</Text>
            <Text style={global.textSecondary}>Ganancias hoy</Text>
          </GameCard>
        </View>
        
        <View style={{ flexDirection: 'row', gap: spacing.base, paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
            <Feather name="clock" size={20} color={colors.warning} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{citasPendientes}</Text>
            <Text style={global.textSecondary}>{(appointmentPlural || 'Citas')} pendientes</Text>
          </GameCard>
          <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
            <Feather name="calendar" size={20} color={colors.gold} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{citasHoy.length}</Text>
            <Text style={global.textSecondary}>{(appointmentPlural || 'Citas')} hoy</Text>
          </GameCard>
          <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
            <Feather name="check-circle" size={20} color={colors.success} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>{citasCompletadas}</Text>
            <Text style={global.textSecondary}>{(appointmentPlural || 'Citas')} completadas</Text>
          </GameCard>
        </View>
        
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
          <GameCard variant="elevated" style={{ alignItems: 'center' }}>
            <Feather name="trending-up" size={24} color={colors.gold} />
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>${gananciasSemana.toLocaleString('es-CO')}</Text>
            <Text style={global.textSecondary}>Ganancias esta semana</Text>
          </GameCard>
        </View>
        
        {rankingBarberos.length > 0 && (
          <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Feather name="award" size={20} color={colors.gold} />
              <Text style={[global.text, { fontSize: 18, fontWeight: 'bold', color: colors.gold }]}>Ranking por calificación</Text>
            </View>
            {rankingBarberos.map((barbero, index) => {
              const calificacion = barbero.calificacion_promedio || 0;
              const totalReseñas = barbero.total_reseñas || 0;
              return (
                <View key={barbero.id} style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: colors.card, 
                  padding: spacing.md, 
                  borderRadius: 12, 
                  marginBottom: spacing.sm, 
                  gap: spacing.md,
                  borderLeftWidth: 4,
                  borderLeftColor: index === 0 ? colors.gold : index === 1 ? colors.silver : index === 2 ? colors.bronze : colors.card,
                }}>
                  {barbero.foto_url ? (
                    <Image 
                      source={{ uri: barbero.foto_url }} 
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                  ) : (
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' }}>
                      <Feather name="user" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 14 }}>{barbero.nombre}</Text>
                    {calificacion > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold' }}>{calificacion.toFixed(1)}</Text>
                        <Text style={{ fontSize: 10, color: colors.gold }}>{renderEstrellas(calificacion)}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10 }}>({totalReseñas} reseña{totalReseñas !== 1 ? 's' : ''})</Text>
                      </View>
                    ) : (
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Sin calificaciones</Text>
                    )}
                  </View>
                  {index === 0 && <Feather name="award" size={20} color={colors.gold} />}
                </View>
              );
            })}
          </View>
        )}
        
        {topBarbero && (
          <GameCard variant="game" style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              {topBarbero.foto_url ? (
                <Image 
                  source={{ uri: topBarbero.foto_url }} 
                  style={{ width: 60, height: 60, borderRadius: 30 }}
                />
              ) : (
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' }}>
                  <Feather name="user" size={30} color={colors.textSecondary} />
                </View>
              )}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Feather name="star" size={16} color={colors.gold} />
                  <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold', letterSpacing: 1 }}>
                    {employeePlural?.toUpperCase() || 'BARBEROS'} DEL MOMENTO
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>
                  {topBarbero.nombre}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {topBarbero.count} {(appointmentPlural || 'citas').toLowerCase()} completadas
                </Text>
              </View>
            </View>
            <Feather name="award" size={32} color={colors.gold} />
          </GameCard>
        )}
        
        {renderSeccion(
          `${appointmentPlural || 'Citas'} hoy`, 
          citasHoy, 
          paginaCitasHoy, 
          setPaginaCitasHoy, 
          totalPaginasCitasHoy, 
          `No hay ${(appointmentPlural || 'citas').toLowerCase()} para hoy`, 
          'calendar'
        )}
        {renderSeccion(
          `Últimas ${(appointmentPlural || 'citas').toLowerCase()}`, 
          ultimasCitas, 
          paginaUltimasCitas, 
          setPaginaUltimasCitas, 
          totalPaginasUltimasCitas, 
          `No hay ${(appointmentPlural || 'citas').toLowerCase()} aún`, 
          'list'
        )}
      </ScrollView>

      <InvitationModal
        visible={invitationModalVisible}
        onClose={() => setInvitationModalVisible(false)}
        codigoInvitacion={codigoBarberia || ''}
        nombreNegocio={negocioNombre || 'CUTTRACK'}
      />

      <Modal visible={modalComisionesVisible} transparent animationType="slide" onRequestClose={() => setModalComisionesVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.glassBorder }]}>
              <Text style={[global.headerTitle, { fontSize: 18 }]}>💰 Resumen de comisiones</Text>
              <TouchableOpacity onPress={() => setModalComisionesVisible(false)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.glassBorder }}>
              {(['hoy', 'semana', 'mes', 'total'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    borderRadius: 20,
                    backgroundColor: periodoComisiones === p ? colors.primary : colors.glass,
                    alignItems: 'center',
                  }}
                  onPress={() => cambiarPeriodo(p)}
                >
                  <Text style={{ color: periodoComisiones === p ? colors.text : colors.textSecondary, fontWeight: 'bold', fontSize: 12 }}>
                    {p === 'hoy' ? 'HOY' : p === 'semana' ? 'SEMANA' : p === 'mes' ? 'MES' : 'TOTAL'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <ScrollView style={{ maxHeight: 500 }}>
              <View style={{ padding: spacing.lg }}>
                <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{getPeriodoTexto(periodoComisiones)}</Text>
                  <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>
                    ${totalComisionesPeriodo.toLocaleString('es-CO')}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 10 }}>en comisiones pagadas</Text>
                </View>
                
                {cargandoComisiones ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : comisionesPorBarbero.length === 0 ? (
                  <View style={global.emptyContainer}>
                    <Feather name="dollar-sign" size={48} color={colors.textMuted} />
                    <Text style={global.emptyText}>No hay comisiones registradas</Text>
                    <Text style={global.emptySubtext}>Completa {(appointmentPlural || 'citas').toLowerCase()} para ver comisiones</Text>
                  </View>
                ) : (
                  comisionesPorBarbero.map((barbero) => (
                    <GameCard key={barbero.id} variant="elevated" style={{ marginBottom: spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                        {barbero.foto_url ? (
                          <Image source={{ uri: barbero.foto_url }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                        ) : (
                          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' }}>
                            <Feather name="user" size={24} color={colors.textSecondary} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }}>{barbero.nombre}</Text>
                            <Text style={{ color: colors.gold, fontWeight: 'bold', fontSize: 16 }}>
                              ${barbero.totalComision.toLocaleString('es-CO')}
                            </Text>
                          </View>
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                            {barbero.cantidadCitas} {(appointmentPlural || 'citas').toLowerCase()} • {barbero.porcentaje}% comisión
                          </Text>
                        </View>
                      </View>
                    </GameCard>
                  ))
                )}
              </View>
            </ScrollView>
            
            <View style={{ padding: spacing.lg }}>
              <GameButton title="Cerrar" variant="primary" onPress={() => setModalComisionesVisible(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.85)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    borderRadius: 20, 
    width: width - 40, 
    maxHeight: '90%', 
    overflow: 'hidden' 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1 
  },
});
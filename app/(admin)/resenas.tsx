import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary';
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameCard } from '../styles/components/ui/GameCard';

interface Barbero {
  id: string;
  nombre: string;
  foto_url?: string;
  calificacion_promedio: number;
  total_reseñas: number;
  activo: boolean;
}

export default function ResenasAdmin() {
  const { colors, global, spacing } = useGameStyles();
  // 🔥 CORREGIDO: Agregar servicePlural
  const { employeePlural, servicePlural, getIcon } = useBusinessDictionary();
  
  const [barberos, setBarberos] = useState<Barbero[]>([]);
  const [barberoSeleccionado, setBarberoSeleccionado] = useState<string | null>(null);
  const [barberoInfo, setBarberoInfo] = useState<Barbero | null>(null);
  const [resenas, setResenas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [promedioGeneral, setPromedioGeneral] = useState(0);
  const [totalResenas, setTotalResenas] = useState(0);
  
  const [pagina, setPagina] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
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
    cargarBarberos();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (barbershopId) {
        cargarBarberos();
      }
    }, [barbershopId])
  );

  const cargarBarberos = async () => {
    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('No hay usuario');

      const { data: adminUser } = await supabase
        .from('users')
        .select('barbershop_id')
        .eq('id', userData.user.id)
        .single();

      if (!adminUser?.barbershop_id) throw new Error('No se encontró el negocio');
      setBarbershopId(adminUser.barbershop_id);

      const { data, error } = await supabase
        .from('barbers')
        .select('id, nombre, foto_url, calificacion_promedio, "total_reseñas", activo')
        .eq('barbershop_id', adminUser.barbershop_id)
        .order('nombre');

      if (error) throw error;
      
      setBarberos(data || []);
      
    } catch (error: any) {
      console.error('Error cargando empleados:', error);
      showModal('Error', error.message || 'No se pudieron cargar los empleados', 'error');
    } finally {
      setLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const cargarResenas = async (barberoId: string, reset: boolean = true) => {
    if (!barberoId) return;
    
    if (!reset && totalItems > 0 && pagina * itemsPorPagina >= totalItems) {
      setCargandoMas(false);
      return;
    }
    
    if (reset) {
      setPagina(0);
      setResenas([]);
      setLoading(true);
    } else {
      setCargandoMas(true);
    }

    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setCargandoMas(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    const desde = reset ? 0 : pagina * itemsPorPagina;
    const hasta = desde + itemsPorPagina - 1;

    try {
      const { data, error, count } = await supabase
        .from('appointments')
        .select(`
          id,
          calificacion_cliente,
          comentario_cliente,
          foto_resena,
          fecha_hora,
          clients (nombre, foto_url),
          services (nombre, foto_url)
        `, { count: 'exact' })
        .eq('barbero_id', barberoId)
        .eq('estado', 'completada')
        .not('calificacion_cliente', 'is', null)
        .order('fecha_hora', { ascending: false })
        .range(desde, hasta);
      
      if (error) throw error;

      const nuevasResenas = (data || []).map((item: any) => {
        let cliente = { nombre: 'Cliente', foto_url: undefined };
        if (item.clients && Array.isArray(item.clients) && item.clients.length > 0) {
          cliente = item.clients[0];
        } else if (item.clients && !Array.isArray(item.clients)) {
          cliente = item.clients;
        }
        
        let servicio = { nombre: 'Servicio', foto_url: undefined };
        if (item.services && Array.isArray(item.services) && item.services.length > 0) {
          servicio = item.services[0];
        } else if (item.services && !Array.isArray(item.services)) {
          servicio = item.services;
        }
        
        return {
          id: item.id,
          calificacion_cliente: item.calificacion_cliente,
          comentario_cliente: item.comentario_cliente,
          foto_resena: item.foto_resena,
          fecha_hora: item.fecha_hora,
          clients: cliente,
          services: servicio
        };
      });

      if (reset) {
        setResenas(nuevasResenas);
      } else {
        setResenas(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const nuevasUnicas = nuevasResenas.filter(r => !existingIds.has(r.id));
          return [...prev, ...nuevasUnicas];
        });
      }
      setTotalItems(count || 0);

      if (reset && count && count > 0) {
        const { data: todasCalificaciones } = await supabase
          .from('appointments')
          .select('calificacion_cliente')
          .eq('barbero_id', barberoId)
          .eq('estado', 'completada')
          .not('calificacion_cliente', 'is', null);
        
        if (todasCalificaciones && todasCalificaciones.length > 0) {
          const suma = todasCalificaciones.reduce((sum, r) => sum + r.calificacion_cliente, 0);
          const promedio = suma / todasCalificaciones.length;
          setPromedioGeneral(promedio);
          setTotalResenas(todasCalificaciones.length);
        }
      }

    } catch (error: any) {
      console.error('Error cargando reseñas:', error);
      showModal('Error', error.message || 'No se pudieron cargar las reseñas', 'error');
    } finally {
      setLoading(false);
      setCargandoMas(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const cargarMasResenas = () => {
    if (!cargandoMas && resenas.length < totalItems && barberoSeleccionado) {
      const siguientePagina = pagina + 1;
      const maxPaginas = Math.ceil(totalItems / itemsPorPagina);
      
      if (siguientePagina < maxPaginas) {
        setPagina(siguientePagina);
        cargarResenas(barberoSeleccionado, false);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (barberoSeleccionado) {
        setPagina(0);
        setTotalItems(0);
        await cargarResenas(barberoSeleccionado, true);
      } else {
        await cargarBarberos();
      }
    } catch (error) {
      console.error('Error en refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [barberoSeleccionado]);

  const seleccionarBarbero = (barbero: Barbero) => {
    setBarberoSeleccionado(barbero.id);
    setBarberoInfo(barbero);
    setPromedioGeneral(barbero.calificacion_promedio || 0);
    setTotalResenas(barbero.total_reseñas || 0);
    setPagina(0);
    setResenas([]);
    setTotalItems(0);
    cargarResenas(barbero.id, true);
  };

  const volverALista = () => {
    setBarberoSeleccionado(null);
    setBarberoInfo(null);
    setResenas([]);
    setPromedioGeneral(0);
    setTotalResenas(0);
    setPagina(0);
    setTotalItems(0);
  };

  const renderEstrellas = (calificacion: number, tamaño: number = 14) => {
    const estrellas = [];
    const redondeado = Math.round(calificacion);
    for (let i = 1; i <= 5; i++) {
      estrellas.push(
        <Feather 
          key={i} 
          name="star" 
          size={tamaño} 
          color={i <= redondeado ? colors.gold : colors.textMuted}
          fill={i <= redondeado ? colors.gold : "none"}
        />
      );
    }
    return <View style={{ flexDirection: 'row', gap: 2 }}>{estrellas}</View>;
  };

  const formatFecha = (fechaHora: string) => {
    const fecha = new Date(fechaHora);
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dias[fecha.getDay()]} ${fecha.getDate()} de ${meses[fecha.getMonth()]}, ${fecha.getFullYear()}`;
  };

  const renderResena = ({ item }: { item: any }) => (
    <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        {item.clients?.foto_url ? (
          <Image 
            source={{ uri: item.clients.foto_url }} 
            style={{ width: 50, height: 50, borderRadius: 25 }}
          />
        ) : (
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' }}>
            <Feather name="user" size={24} color={colors.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }}>{item.clients?.nombre || 'Cliente'}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{formatFecha(item.fecha_hora)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {renderEstrellas(item.calificacion_cliente, 16)}
          <Text style={{ color: colors.gold, fontSize: 12, marginTop: 2, fontWeight: 'bold' }}>
            {item.calificacion_cliente.toFixed(1)}
          </Text>
        </View>
      </View>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, backgroundColor: 'rgba(255,107,53,0.1)', padding: spacing.sm, borderRadius: 12 }}>
        {item.services?.foto_url ? (
          <Image 
            source={{ uri: item.services.foto_url }} 
            style={{ width: 24, height: 24, borderRadius: 12 }}
          />
        ) : (
          <Feather name={getIcon('service') as any} size={16} color={colors.primary} />
        )}
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '500' }}>
          {item.services?.nombre || (servicePlural || 'Servicio')}
        </Text>
      </View>
      
      {item.comentario_cliente && (
        <View style={{ backgroundColor: colors.glass, padding: spacing.md, borderRadius: 12, marginBottom: spacing.sm }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>💬 Comentario del cliente</Text>
          <Text style={{ color: colors.text, fontSize: 14, fontStyle: 'italic' }}>
            "{item.comentario_cliente}"
          </Text>
        </View>
      )}
      
      {item.foto_resena && (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: spacing.xs }}>📸 Foto del resultado</Text>
          <Image 
            source={{ uri: item.foto_resena }} 
            style={{ width: '100%', height: 200, borderRadius: 12 }}
            resizeMode="cover"
          />
        </View>
      )}
    </GameCard>
  );

  const renderBarberoItem = ({ item }: { item: Barbero }) => (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        padding: spacing.md,
        borderRadius: 16,
        borderLeftWidth: 4,
        borderLeftColor: item.activo ? colors.primary : colors.error,
        borderWidth: 1,
        borderColor: item.activo ? 'rgba(255, 107, 53, 0.2)' : 'rgba(239, 68, 68, 0.2)',
        opacity: item.activo ? 1 : 0.7,
      }}
      onPress={() => seleccionarBarbero(item)}
      activeOpacity={0.7}
    >
      {item.foto_url ? (
        <Image 
          source={{ uri: item.foto_url }} 
          style={{ width: 50, height: 50, borderRadius: 25, marginRight: spacing.md }}
        />
      ) : (
        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md }}>
          <Feather name="user" size={24} color={colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }}>{item.nombre}</Text>
          {!item.activo && (
            <View style={{ backgroundColor: colors.error, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
              <Text style={{ color: 'white', fontSize: 8, fontWeight: 'bold' }}>INACTIVO</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="star" size={12} color={colors.gold} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {item.calificacion_promedio?.toFixed(1) || '0.0'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="message-circle" size={12} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {item.total_reseñas || 0} reseña{item.total_reseñas !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={colors.primary} />
    </TouchableOpacity>
  );

  if (loading && !refreshing && barberos.length === 0) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando {(employeePlural || 'empleados').toLowerCase()}...</Text>
      </View>
    );
  }

  return (
    <View style={global.container}>
      <View style={[global.header, { paddingTop: spacing.xl, paddingBottom: spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="star" size={24} color={colors.gold} />
          <Text style={global.headerTitle}>Reseñas</Text>
        </View>
        <Text style={global.headerSubtitle}>
          {barberoSeleccionado ? `Reseñas de ${barberoInfo?.nombre}` : `${barberos.length} ${(employeePlural || 'empleado').toLowerCase()}${barberos.length !== 1 ? 's' : ''} en total`}
        </Text>
      </View>

      {!barberoSeleccionado ? (
        <FlatList
          data={barberos}
          keyExtractor={(item) => item.id}
          renderItem={renderBarberoItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={global.emptyContainer}>
              <Feather name="users" size={48} color={colors.textMuted} />
              <Text style={global.emptyText}>No hay {(employeePlural || 'empleados').toLowerCase()} registrados</Text>
              <Text style={global.emptySubtext}>Agrega {(employeePlural || 'empleados').toLowerCase()} desde la pestaña de {employeePlural}</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        />
      ) : (
        <>
          <TouchableOpacity 
            onPress={volverALista}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}
          >
            <Feather name="arrow-left" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 14 }}>Volver a {(employeePlural || 'empleados').toLowerCase()}</Text>
          </TouchableOpacity>

          {barberoInfo && (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.lg }}>
              <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center', padding: spacing.md }}>
                <Feather name="star" size={20} color={colors.gold} />
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>
                  {promedioGeneral.toFixed(1)}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Calificación</Text>
              </GameCard>
              <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center', padding: spacing.md }}>
                <Feather name="users" size={20} color={colors.gold} />
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>
                  {totalResenas}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Reseñas</Text>
              </GameCard>
            </View>
          )}
          
          <FlatList
            data={resenas}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            renderItem={renderResena}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
            }
            onEndReached={cargarMasResenas}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              cargandoMas ? (
                <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: spacing.xs }}>Cargando más reseñas...</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={global.emptyContainer}>
                <Feather name="star" size={48} color={colors.textMuted} />
                <Text style={global.emptyText}>No hay reseñas para este {(employeePlural || 'empleado').slice(0, -1).toLowerCase()}</Text>
                <Text style={global.emptySubtext}>Cuando los clientes califiquen, aparecerán aquí</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

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
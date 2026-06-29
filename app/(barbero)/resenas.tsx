import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, Text, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary'; // 🔥 NUEVO
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameCard } from '../styles/components/ui/GameCard';

export default function ResenasBarbero() {
  const { colors, global, spacing } = useGameStyles();
  // 🔥 NUEVO: Hook de multi-tenant
  const { employeeName, servicePlural, getIcon } = useBusinessDictionary();
  
  const [resenas, setResenas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [barberoId, setBarberoId] = useState<string | null>(null);
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

  const modalTimeoutRef = useRef<number | null>(null);

  const showModal = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'confirm' = 'confirm',
    onConfirm?: () => void
  ) => {
    if (modalTimeoutRef.current) {
      clearTimeout(modalTimeoutRef.current);
      modalTimeoutRef.current = null;
    }
    
    setCustomModal({ visible: true, title, message, type, onConfirm: onConfirm || null });
    
    if (type === 'success') {
      const timeout = setTimeout(() => {
        setCustomModal(prev => ({ ...prev, visible: false }));
        modalTimeoutRef.current = null;
      }, 2000);
      modalTimeoutRef.current = timeout;
    }
  };

  const hideModal = () => {
    if (modalTimeoutRef.current) {
      clearTimeout(modalTimeoutRef.current);
      modalTimeoutRef.current = null;
    }
    setCustomModal(prev => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    cargarBarberoId();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (barberoId) {
        cargarEstadisticasBarbero();
        cargarResenas(true);
      }
    }, [barberoId])
  );

  const cargarBarberoId = async () => {
    try {
      const id = await storage.getItem('barbero_id');
      if (!id) return;
      setBarberoId(id);
    } catch (error) {
      console.error('Error cargando barbero ID:', error);
      setLoading(false);
    }
  };

  const cargarEstadisticasBarbero = async () => {
    if (!barberoId) return;
    
    const { data, error } = await supabase
      .from('barbers')
      .select('calificacion_promedio, "total_reseñas"')
      .eq('id', barberoId)
      .single();
    
    if (!error && data) {
      setPromedioGeneral(data.calificacion_promedio || 0);
      setTotalResenas(data.total_reseñas || 0);
    } else {
      const { count } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('barbero_id', barberoId)
        .eq('estado', 'completada')
        .not('calificacion_cliente', 'is', null);
      
      setTotalResenas(count || 0);
      
      const { data: calificaciones } = await supabase
        .from('appointments')
        .select('calificacion_cliente')
        .eq('barbero_id', barberoId)
        .eq('estado', 'completada')
        .not('calificacion_cliente', 'is', null);
      
      if (calificaciones && calificaciones.length > 0) {
        const suma = calificaciones.reduce((acc, c) => acc + c.calificacion_cliente, 0);
        setPromedioGeneral(suma / calificaciones.length);
      }
    }
  };

  const cargarResenas = async (reset: boolean = true) => {
    if (!barberoId) return;
    
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

    try {
      const desde = reset ? 0 : pagina * itemsPorPagina;
      const hasta = desde + itemsPorPagina - 1;

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
          cliente_nombre: cliente.nombre,
          cliente_foto: cliente.foto_url,
          servicio_nombre: servicio.nombre,
          servicio_foto: servicio.foto_url,
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

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('Error cargando reseñas:', error);
      showModal('Error', error.message || 'No se pudieron cargar las reseñas', 'error');
    } finally {
      setLoading(false);
      setCargandoMas(false);
      setRefreshing(false);
    }
  };

  const cargarMasResenas = () => {
    if (!cargandoMas && resenas.length < totalItems) {
      const siguientePagina = pagina + 1;
      const maxPaginas = Math.ceil(totalItems / itemsPorPagina);
      
      if (siguientePagina < maxPaginas) {
        setPagina(siguientePagina);
        cargarResenas(false);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPagina(0);
    try {
      await cargarEstadisticasBarbero();
      await cargarResenas(true);
    } catch (error) {
      console.error('Error en refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [barberoId]);

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
        {item.cliente_foto ? (
          <Image 
            source={{ uri: item.cliente_foto }} 
            style={{ width: 50, height: 50, borderRadius: 25 }}
          />
        ) : (
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' }}>
            <Feather name="user" size={24} color={colors.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }}>{item.cliente_nombre}</Text>
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
        {item.servicio_foto ? (
          <Image 
            source={{ uri: item.servicio_foto }} 
            style={{ width: 24, height: 24, borderRadius: 12 }}
          />
        ) : (
          <Feather name={getIcon('service') as any} size={16} color={colors.primary} />
        )}
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '500' }}>
          {item.servicio_nombre || (servicePlural || 'Servicio').slice(0, -1)}
        </Text>
      </View>
      
      {item.comentario_cliente && (
        <View style={{ backgroundColor: colors.glass, padding: spacing.md, borderRadius: 12, marginBottom: spacing.sm }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>💬 Comentario</Text>
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

  if (loading && !refreshing && resenas.length === 0) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando reseñas...</Text>
      </View>
    );
  }

  return (
    <View style={global.container}>
      <View style={[global.header, { paddingTop: spacing.xl, paddingBottom: spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="star" size={24} color={colors.gold} />
          <Text style={global.headerTitle}>Mis Reseñas</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.lg }}>
        <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center', padding: spacing.md }}>
          <Feather name="star" size={20} color={colors.gold} />
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>
            {promedioGeneral.toFixed(1)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Calificación</Text>
        </GameCard>
        <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center', padding: spacing.md }}>
          <Feather name="message-circle" size={20} color={colors.gold} />
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>
            {totalResenas}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Reseñas</Text>
        </GameCard>
      </View>
      
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
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: spacing.xs }}>Cargando más reseñas...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={global.emptyContainer}>
            <Feather name="star" size={48} color={colors.textMuted} />
            <Text style={global.emptyText}>No tienes reseñas aún</Text>
            <Text style={global.emptySubtext}>Cuando los clientes califiquen tus {(servicePlural || 'servicios').toLowerCase()}, aparecerán aquí</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
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
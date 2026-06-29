import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, Text, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary'; // 🔥 NUEVO
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';
import { GameCard } from '../styles/components/ui/GameCard';

export default function MisClientes() {
  const { colors, global, spacing } = useGameStyles();
  // 🔥 NUEVO: Hook de multi-tenant
  const { employeeName, appointmentPlural, servicePlural, getIcon } = useBusinessDictionary();
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barberoId, setBarberoId] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalCitasRealizadas, setTotalCitasRealizadas] = useState(0);
  const [topServicios, setTopServicios] = useState<any[]>([]);
  const itemsPorPagina = 6;

  const timeoutRef = useRef<number | null>(null);

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

  useEffect(() => {
    cargarBarberoId();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (barberoId) {
      cargarClientes(true);
      cargarTopServicios();
    }
  }, [barberoId]);

  const cargarBarberoId = async () => {
    try {
      const id = await storage.getItem('barbero_id');
      if (!id) {
        setLoading(false);
        return;
      }
      setBarberoId(id);
    } catch (error) {
      console.error('Error cargando barbero ID:', error);
      setLoading(false);
    }
  };

  const cargarTopServicios = async () => {
    if (!barberoId) return;

    try {
      console.log('🔍 Buscando citas completadas del barbero:', barberoId);

      const { data: citas, error } = await supabase
        .from('appointments')
        .select('servicio_id')
        .eq('barbero_id', barberoId)
        .eq('estado', 'completada');

      if (error) throw error;

      console.log('📊 Total citas completadas:', citas?.length || 0);

      if (!citas || citas.length === 0) {
        console.log('⚠️ No hay citas completadas');
        setTopServicios([]);
        return;
      }

      const contador = new Map();
      citas.forEach(cita => {
        if (cita.servicio_id) {
          contador.set(cita.servicio_id, (contador.get(cita.servicio_id) || 0) + 1);
        }
      });

      console.log('📊 Servicios contados:', Array.from(contador.entries()));

      if (contador.size === 0) {
        console.log('⚠️ No hay servicios con ID válido');
        setTopServicios([]);
        return;
      }

      const topIds = Array.from(contador.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);

      console.log('🏆 Top 3 service IDs:', topIds);

      const { data: servicios, error: servError } = await supabase
        .from('services')
        .select('id, nombre, foto_url')
        .in('id', topIds);

      if (servError) throw servError;

      const top = servicios.map(serv => ({
        ...serv,
        cantidad: contador.get(serv.id)
      })).sort((a, b) => b.cantidad - a.cantidad);

      console.log('🏆 Top servicios final:', top);
      setTopServicios(top);

    } catch (error) {
      console.error('❌ Error cargando top servicios:', error);
      setTopServicios([]);
    }
  };

  const cargarClientes = async (reset: boolean = true) => {
    if (!barberoId) return;
    
    if (reset) {
      setPagina(0);
      setClientes([]);
      setLoading(true);
    }
    
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const desde = reset ? 0 : pagina * itemsPorPagina;
      const hasta = desde + itemsPorPagina - 1;

      const { data: citas, error, count } = await supabase
        .from('appointments')
        .select(`
          cliente_id,
          total,
          fecha_hora
        `, { count: 'exact' })
        .eq('barbero_id', barberoId)
        .eq('estado', 'completada')
        .order('fecha_hora', { ascending: false })
        .range(desde, hasta);

      if (error) throw error;

      if (reset) {
        const { count: totalCitas } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('barbero_id', barberoId)
          .eq('estado', 'completada');
        setTotalCitasRealizadas(totalCitas || 0);
      }

      if (!citas || citas.length === 0) {
        if (reset) setClientes([]);
        setTotalClientes(count || 0);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setLoading(false);
        return;
      }

      const clientesIds = [...new Set(citas.map(c => c.cliente_id))];
      
      const { data: clientesData, error: clientesError } = await supabase
        .from('clients')
        .select('id, nombre, telefono, foto_url')
        .in('id', clientesIds);

      if (clientesError) throw clientesError;

      const clientesMap = new Map();
      
      clientesData?.forEach(cliente => {
        clientesMap.set(cliente.id, {
          id: cliente.id,
          nombre: cliente.nombre || 'Cliente',
          telefono: cliente.telefono || 'No disponible',
          foto_url: cliente.foto_url || null,
          totalCitas: 0,
          gastoTotal: 0,
          ultimaCita: null,
        });
      });

      citas.forEach(cita => {
        const cliente = clientesMap.get(cita.cliente_id);
        if (cliente) {
          cliente.totalCitas++;
          cliente.gastoTotal += cita.total;
          if (!cliente.ultimaCita || new Date(cita.fecha_hora) > new Date(cliente.ultimaCita)) {
            cliente.ultimaCita = cita.fecha_hora;
          }
        }
      });

      const clientesArray = Array.from(clientesMap.values());
      clientesArray.sort((a, b) => b.totalCitas - a.totalCitas);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (reset) {
        setClientes(clientesArray);
      } else {
        setClientes(prev => [...prev, ...clientesArray]);
      }
      setTotalClientes(count || 0);

    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('❌ Error cargando clientes:', error);
      showModal('Error', error.message || 'No se pudieron cargar los clientes', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const cargarPaginaAnterior = () => {
    if (pagina > 0) {
      const nuevaPagina = pagina - 1;
      setPagina(nuevaPagina);
      setClientes([]);
      cargarClientes(true);
    }
  };

  const cargarPaginaSiguiente = () => {
    if ((pagina + 1) * itemsPorPagina < totalClientes) {
      const nuevaPagina = pagina + 1;
      setPagina(nuevaPagina);
      setClientes([]);
      cargarClientes(true);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPagina(0);
    cargarClientes(true);
    cargarTopServicios();
  }, [barberoId]);

  const formatFecha = (fecha: string) => {
    if (!fecha) return 'Sin visitas';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const totalPaginas = Math.ceil(totalClientes / itemsPorPagina);

  const renderCliente = ({ item }: { item: any }) => (
    <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {item.foto_url ? (
          <Image 
            source={{ uri: item.foto_url }} 
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>{item.nombre}</Text>
            <View style={{ 
              backgroundColor: item.totalCitas >= 5 ? colors.gold : item.totalCitas >= 3 ? colors.primary : colors.secondary, 
              paddingHorizontal: spacing.sm, 
              paddingVertical: 2, 
              borderRadius: 12 
            }}>
              <Text style={{ color: colors.background, fontSize: 10, fontWeight: 'bold' }}>
                {item.totalCitas >= 5 ? 'VIP' : item.totalCitas >= 3 ? '⭐ Frecuente' : 'Regular'}
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
            <Feather name="phone" size={12} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.telefono}</Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Feather name={getIcon('service') as any} size={12} color={colors.gold} />
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold' }}>
                {item.totalCitas} {(appointmentPlural || 'cita').toLowerCase()}{item.totalCitas !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Feather name="dollar-sign" size={12} color={colors.gold} />
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold' }}>${item.gastoTotal.toLocaleString('es-CO')}</Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Feather name="calendar" size={12} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Última visita: {formatFecha(item.ultimaCita)}</Text>
          </View>
        </View>
      </View>
    </GameCard>
  );

  const renderTopServicio = ({ item, index }: { item: any; index: number }) => (
    <GameCard key={item.id} variant="elevated" style={{ flex: 1, alignItems: 'center', padding: spacing.sm }}>
      {item.foto_url ? (
        <Image 
          source={{ uri: item.foto_url }} 
          style={{ width: 40, height: 40, borderRadius: 20, marginBottom: spacing.xs }}
        />
      ) : (
        <View style={{ 
          width: 40, 
          height: 40, 
          borderRadius: 20, 
          backgroundColor: colors.glass,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.xs
        }}>
          <Feather name={getIcon('service') as any} size={20} color={colors.primary} />
        </View>
      )}
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
        {item.nombre}
      </Text>
      <Text style={{ color: colors.gold, fontSize: 10, fontWeight: 'bold' }}>
        {item.cantidad} {(appointmentPlural || 'cita').toLowerCase()}{item.cantidad !== 1 ? 's' : ''}
      </Text>
      <View style={{
        position: 'absolute',
        top: -8,
        left: -8,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Text style={{ color: colors.text, fontSize: 10, fontWeight: 'bold' }}>{index + 1}</Text>
      </View>
    </GameCard>
  );

  if (loading && !refreshing) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando clientes...</Text>
      </View>
    );
  }

  return (
    <View style={global.container}>
      <View style={[global.header, { paddingBottom: spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="users" size={24} color={colors.gold} />
          <Text style={global.headerTitle}>Mis Clientes</Text>
        </View>
      </View>

      {topServicios.length > 0 && (
        <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Feather name="trending-up" size={16} color={colors.gold} />
            <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold' }}>
              TUS {(servicePlural || 'SERVICIOS').toUpperCase()} MÁS PEDIDOS
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {topServicios.map((servicio, index) => renderTopServicio({ item: servicio, index }))}
          </View>
        </View>
      )}

      <FlatList
        data={clientes}
        keyExtractor={(item) => item.id}
        renderItem={renderCliente}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={global.emptyContainer}>
            <Feather name="users" size={48} color={colors.textMuted} />
            <Text style={global.emptyText}>Aún no has atendido clientes</Text>
            <Text style={global.emptySubtext}>Completa tus primeras {(appointmentPlural || 'citas').toLowerCase()} para verlos aquí</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      />

      {totalPaginas > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.xl, gap: spacing.md }}>
          <GameButton 
            title="← Anterior"
            variant="secondary"
            onPress={cargarPaginaAnterior}
            disabled={pagina === 0}
            style={{ flex: 1, paddingVertical: spacing.sm }}
          />
          <Text style={{ color: colors.gold }}>{pagina + 1} / {totalPaginas}</Text>
          <GameButton 
            title="Siguiente →"
            variant="secondary"
            onPress={cargarPaginaSiguiente}
            disabled={(pagina + 1) * itemsPorPagina >= totalClientes}
            style={{ flex: 1, paddingVertical: spacing.sm }}
          />
        </View>
      )}

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
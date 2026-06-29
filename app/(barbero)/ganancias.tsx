import { Feather } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useGameStyles } from '../hooks/useGameStyles';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary'; // 🔥 NUEVO
import { CustomModal } from '../styles/components/ui/CustomModal';
import { GameButton } from '../styles/components/ui/GameButton';
import { GameCard } from '../styles/components/ui/GameCard';

const { width } = Dimensions.get('window');

export default function Ganancias() {
  const { colors, global, spacing } = useGameStyles();
  // 🔥 NUEVO: Hook de multi-tenant
  const { employeeName, appointmentPlural, servicePlural, getIcon } = useBusinessDictionary();
  
  const [gananciasHoy, setGananciasHoy] = useState(0);
  const [gananciasSemana, setGananciasSemana] = useState(0);
  const [gananciasMes, setGananciasMes] = useState(0);
  const [citasCompletadas, setCitasCompletadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barberoId, setBarberoId] = useState<string | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [barberoNombre, setBarberoNombre] = useState<string>('');
  const [barberoTelefono, setBarberoTelefono] = useState<string>('');
  const [barberoFoto, setBarberoFoto] = useState<string | null>(null);
  const [porcentajeComision, setPorcentajeComision] = useState<number>(70);
  const [modalVisible, setModalVisible] = useState(false);
  const [comprobanteData, setComprobanteData] = useState<any>(null);
  const [hasMediaPermission, setHasMediaPermission] = useState(false);
  
  const [pagina, setPagina] = useState(0);
  const itemsPorPagina = 10;
  const comprobanteRef = useRef<any>(null);
  const timeoutRef = useRef<number | null>(null);
  const modalTimeoutRef = useRef<number | null>(null);

  const [customModal, setCustomModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm',
    onConfirm: null as (() => void) | null,
  });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'confirm' = 'confirm', onConfirm?: () => void) => {
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
    solicitarPermisos();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (barberoId) {
      cargarGanancias();
    }
  }, [barberoId]);

  const solicitarPermisos = async () => {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasMediaPermission(status === 'granted');
      if (status !== 'granted') {
        showModal('Permiso necesario', 'Necesitamos acceso a tu galería para guardar el comprobante', 'warning');
      }
    }
  };

  const cargarBarberoId = async () => {
    try {
      const id = await storage.getItem('barbero_id');
      const nombre = await storage.getItem('barbero_nombre');
      const telefono = await storage.getItem('barbero_telefono');
      
      if (!id) {
        console.error('❌ No se encontró barbero_id en sesión');
        setLoading(false);
        return;
      }
      
      setBarberoId(id);
      setBarberoNombre(nombre || employeeName || 'Barbero');
      setBarberoTelefono(telefono || 'No disponible');
      
      const { data: barbero } = await supabase
        .from('barbers')
        .select('foto_url, porcentaje_comision')
        .eq('id', id)
        .single();
      
      if (barbero?.foto_url) {
        setBarberoFoto(barbero.foto_url);
      }
      if (barbero?.porcentaje_comision !== undefined) {
        setPorcentajeComision(barbero.porcentaje_comision);
      }
      
    } catch (error) {
      console.error('Error cargando barbero ID:', error);
      setLoading(false);
    }
  };

  const cargarGanancias = async () => {
    if (!barberoId) return;
    
    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          fecha_hora,
          total,
          ganancia_barbero,
          clients (id, nombre, telefono, foto_url),
          services (nombre, foto_url)
        `)
        .eq('barbero_id', barberoId)
        .eq('estado', 'completada')
        .order('fecha_hora', { ascending: false });
      
      if (error) throw error;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      setCitasCompletadas(data || []);
      
      const hoyDate = new Date();
      hoyDate.setHours(0, 0, 0, 0);
      
      const gananciasHoyTotal = data?.filter(cita => {
        const citaDate = new Date(cita.fecha_hora);
        return citaDate.toDateString() === hoyDate.toDateString();
      }).reduce((sum, cita) => sum + (cita.ganancia_barbero || cita.total), 0) || 0;
      setGananciasHoy(gananciasHoyTotal);
      
      const semanaAtras = new Date();
      semanaAtras.setDate(semanaAtras.getDate() - 7);
      const gananciasSemanaTotal = data?.filter(cita => {
        const citaDate = new Date(cita.fecha_hora);
        return citaDate >= semanaAtras;
      }).reduce((sum, cita) => sum + (cita.ganancia_barbero || cita.total), 0) || 0;
      setGananciasSemana(gananciasSemanaTotal);
      
      const mesAtras = new Date();
      mesAtras.setDate(mesAtras.getDate() - 30);
      const gananciasMesTotal = data?.filter(cita => {
        const citaDate = new Date(cita.fecha_hora);
        return citaDate >= mesAtras;
      }).reduce((sum, cita) => sum + (cita.ganancia_barbero || cita.total), 0) || 0;
      setGananciasMes(gananciasMesTotal);
      
    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('❌ Error cargando ganancias:', error);
      showModal('Error', error.message || 'No se pudieron cargar las ganancias', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setPagina(0);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarGanancias();
  }, [barberoId]);

  const generarComprobante = () => {
    const hoy = new Date();
    const fechaActual = hoy.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const totalCitas = citasCompletadas.length;
    const promedioPorCita = totalCitas > 0 ? gananciasMes / totalCitas : 0;
    
    setComprobanteData({
      barbero: barberoNombre,
      telefono: barberoTelefono,
      foto: barberoFoto,
      fecha: fechaActual,
      hoy: gananciasHoy,
      semana: gananciasSemana,
      mes: gananciasMes,
      totalCitas: totalCitas,
      promedio: promedioPorCita,
      porcentajeComision: porcentajeComision,
      citasRecientes: citasCompletadas.slice(0, 5)
    });
    
    setModalVisible(true);
  };

  const guardarYCompartirImagen = async () => {
    if (!comprobanteRef.current) return;
    
    setCompartiendo(true);
    try {
      const uri = await captureRef(comprobanteRef, {
        quality: 0.95,
        format: 'png',
        result: 'tmpfile',
      });
      
      if (hasMediaPermission) {
        await MediaLibrary.createAssetAsync(uri);
        showModal('✅ Guardado', 'El comprobante se ha guardado en tu galería', 'success');
      }
      
      await Share.share({
        title: `Comprobante de ganancias - ${barberoNombre}`,
        url: uri,
      });
      
      setModalVisible(false);
    } catch (error) {
      console.error('Error al guardar/compartir:', error);
      showModal('Error', 'No se pudo generar el comprobante', 'error');
    } finally {
      setCompartiendo(false);
    }
  };

  const soloGuardarImagen = async () => {
    if (!comprobanteRef.current) return;
    
    setGuardando(true);
    try {
      const uri = await captureRef(comprobanteRef, {
        quality: 0.95,
        format: 'png',
        result: 'tmpfile',
      });
      
      if (hasMediaPermission) {
        await MediaLibrary.createAssetAsync(uri);
        showModal('✅ Éxito', 'Comprobante guardado en tu galería', 'success');
      } else {
        showModal('Permiso denegado', 'No se pudo guardar la imagen. Compártela en su lugar.', 'warning');
      }
      
    } catch (error) {
      console.error('Error al guardar:', error);
      showModal('Error', 'No se pudo guardar el comprobante', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const totalPaginas = Math.ceil(citasCompletadas.length / itemsPorPagina);
  const citasPaginadas = citasCompletadas.slice(
    pagina * itemsPorPagina,
    (pagina + 1) * itemsPorPagina
  );

  const formatFecha = (fechaHora: string) => {
    const fecha = new Date(fechaHora);
    return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
  };

  const formatHora = (fechaHora: string) => {
    const fecha = new Date(fechaHora);
    const hora = fecha.getHours();
    const minuto = fecha.getMinutes();
    const ampm = hora >= 12 ? 'PM' : 'AM';
    const hora12 = hora % 12 || 12;
    return `${hora12}:${minuto.toString().padStart(2, '0')} ${ampm}`;
  };

  const getGananciaCita = (cita: any) => {
    if (cita.ganancia_barbero) return cita.ganancia_barbero;
    return cita.total * (porcentajeComision / 100);
  };

  if (loading && !refreshing) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando ganancias...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={global.container}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh} 
          colors={[colors.primary]} 
          tintColor={colors.primary} 
        />
      }
    >
      <View style={[global.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="dollar-sign" size={24} color={colors.gold} />
          <Text style={global.headerTitle}>Ganancias</Text>
        </View>
        <GameButton 
          title="Ver comprobante"
          variant="secondary"
          onPress={generarComprobante}
          style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
        />
      </View>
      
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md }}>
        <GameCard variant="game" style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
          <Feather name="percent" size={20} color={colors.gold} />
          <Text style={{ color: colors.gold, fontWeight: 'bold', fontSize: 14 }}>Tu comisión actual:</Text>
          <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 24 }}>{porcentajeComision}%</Text>
        </GameCard>
      </View>
      
      <View style={{ flexDirection: 'row', gap: spacing.base, padding: spacing.lg, paddingBottom: spacing.sm }}>
        <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
          <Feather name="sun" size={20} color={colors.gold} />
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>${gananciasHoy.toLocaleString('es-CO')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs }}>Hoy</Text>
        </GameCard>
        <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
          <Feather name="calendar" size={20} color={colors.gold} />
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>${gananciasSemana.toLocaleString('es-CO')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs }}>Esta semana</Text>
        </GameCard>
      </View>
      
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <GameCard variant="elevated" style={{ alignItems: 'center' }}>
          <Feather name="trending-up" size={20} color={colors.gold} />
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.gold, marginTop: 4 }}>${gananciasMes.toLocaleString('es-CO')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs }}>Últimos 30 días</Text>
        </GameCard>
      </View>
      
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <Feather name="list" size={20} color={colors.gold} />
          <Text style={[global.text, { fontSize: 18, fontWeight: 'bold' }]}>
            {(appointmentPlural || 'Citas').charAt(0).toUpperCase() + (appointmentPlural || 'citas').slice(1)} atendidas ({citasCompletadas.length})
          </Text>
        </View>
        
        {citasCompletadas.length === 0 ? (
          <View style={global.emptyContainer}>
            <Text style={global.emptyEmoji}>😴</Text>
            <Text style={global.emptyText}>Aún no has atendido clientes</Text>
          </View>
        ) : (
          <>
            {citasPaginadas.map((cita) => {
              const gananciaCita = getGananciaCita(cita);
              return (
                <GameCard key={cita.id} variant="elevated" style={{ marginBottom: spacing.md }}>
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
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <Text style={{ color: colors.gold, fontSize: 14, fontWeight: 'bold' }}>{formatFecha(cita.fecha_hora)}</Text>
                        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: 'bold' }}>{formatHora(cita.fecha_hora)}</Text>
                      </View>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>{cita.clients?.nombre || 'Cliente'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                        {cita.services?.foto_url ? (
                          <Image 
                            source={{ uri: cita.services.foto_url }} 
                            style={{ width: 20, height: 20, borderRadius: 10 }}
                          />
                        ) : (
                          <Feather name={getIcon('service') as any} size={12} color={colors.textSecondary} />
                        )}
                        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                          {cita.services?.nombre || (servicePlural || 'Servicio').slice(0, -1)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                          Total servicio: ${cita.total?.toLocaleString('es-CO') || 0}
                        </Text>
                        <Feather name="arrow-right" size={10} color={colors.textMuted} />
                        <Text style={{ color: colors.success, fontWeight: 'bold', fontSize: 13 }}>
                          +${gananciaCita.toLocaleString('es-CO')}
                        </Text>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>
                        Comisión aplicada: {porcentajeComision}%
                      </Text>
                    </View>
                  </View>
                </GameCard>
              );
            })}
            
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

      {/* Modal del comprobante */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.glassBorder }]}>
              <Text style={[global.headerTitle, { fontSize: 18 }]}>📄 Comprobante</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              <View ref={comprobanteRef} collapsable={false} style={[styles.comprobante, { backgroundColor: '#FFFFFF' }]}>
                <View style={[styles.comprobanteHeader, { backgroundColor: colors.primary }]}>
                  <View style={styles.headerIconContainer}>
                    <Feather name={getIcon('business') as any} size={48} color="white" />
                  </View>
                  <Text style={styles.comprobanteTitle}>CUTTRACK</Text>
                  <Text style={styles.comprobanteSubtitle}>Comprobante de Ganancias</Text>
                </View>
                
                <View style={styles.comprobanteInfo}>
                  <View style={styles.barberoSection}>
                    {comprobanteData?.foto ? (
                      <Image 
                        source={{ uri: comprobanteData.foto }} 
                        style={styles.barberoFoto}
                      />
                    ) : (
                      <View style={[styles.barberoFoto, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                        <Feather name="user" size={30} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={styles.barberoInfo}>
                      <Text style={styles.barberoNombre}>{comprobanteData?.barbero}</Text>
                      <Text style={styles.barberoTelefono}>{comprobanteData?.telefono}</Text>
                      <Text style={[styles.barberoComision, { color: colors.primary }]}>
                        Comisión: {comprobanteData?.porcentajeComision}%
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.fechaSection}>
                  <Feather name="calendar" size={14} color="#6B7280" />
                  <Text style={styles.fechaText}>{comprobanteData?.fecha}</Text>
                </View>
                
                <View style={styles.comprobanteStats}>
                  <View style={styles.comprobanteStatCard}>
                    <Text style={[styles.comprobanteStatValue, { color: colors.primary }]}>
                      ${comprobanteData?.hoy?.toLocaleString('es-CO') || 0}
                    </Text>
                    <Text style={styles.comprobanteStatLabel}>Hoy</Text>
                    <Feather name="sun" size={16} color="#F59E0B" />
                  </View>
                  <View style={styles.comprobanteStatCard}>
                    <Text style={[styles.comprobanteStatValue, { color: colors.primary }]}>
                      ${comprobanteData?.semana?.toLocaleString('es-CO') || 0}
                    </Text>
                    <Text style={styles.comprobanteStatLabel}>Semana</Text>
                    <Feather name="calendar" size={16} color="#3B82F6" />
                  </View>
                  <View style={styles.comprobanteStatCard}>
                    <Text style={[styles.comprobanteStatValue, { color: colors.primary }]}>
                      ${comprobanteData?.mes?.toLocaleString('es-CO') || 0}
                    </Text>
                    <Text style={styles.comprobanteStatLabel}>Mes</Text>
                    <Feather name="trending-up" size={16} color="#10B981" />
                  </View>
                </View>
                
                <View style={styles.comprobanteDivider} />
                
                <View style={styles.comprobanteResumen}>
                  <View style={styles.resumenRow}>
                    <Feather name="users" size={18} color="#6B7280" />
                    <Text style={styles.comprobanteResumenText}>
                      Total {(appointmentPlural || 'citas').toLowerCase()} atendidas: <Text style={{ fontWeight: 'bold', color: colors.primary }}>{comprobanteData?.totalCitas || 0}</Text>
                    </Text>
                  </View>
                  <View style={styles.resumenRow}>
                    <Feather name="star" size={18} color="#F59E0B" />
                    <Text style={styles.comprobanteResumenText}>
                      Promedio por {(appointmentPlural || 'cita').toLowerCase()}: <Text style={{ fontWeight: 'bold', color: colors.primary }}>${Math.round(comprobanteData?.promedio || 0).toLocaleString('es-CO')}</Text>
                    </Text>
                  </View>
                  <View style={styles.resumenRow}>
                    <Feather name="percent" size={18} color={colors.primary} />
                    <Text style={styles.comprobanteResumenText}>
                      Comisión aplicada: <Text style={{ fontWeight: 'bold', color: colors.primary }}>{comprobanteData?.porcentajeComision}%</Text>
                    </Text>
                  </View>
                </View>
                
                {comprobanteData?.citasRecientes?.length > 0 && (
                  <>
                    <View style={styles.comprobanteDivider} />
                    <View style={styles.ultimasCitas}>
                      <Text style={styles.ultimasCitasTitle}>📋 Últimas {(appointmentPlural || 'citas').toLowerCase()} atendidas</Text>
                      {comprobanteData.citasRecientes.map((cita: any, idx: number) => {
                        const ganancia = cita.ganancia_barbero || (cita.total * (comprobanteData?.porcentajeComision || 70) / 100);
                        return (
                          <View key={idx} style={styles.citaRow}>
                            <View style={styles.citaInfo}>
                              <Text style={styles.citaCliente}>{cita.clients?.nombre || 'Cliente'}</Text>
                              <Text style={styles.citaServicio}>{cita.services?.nombre || (servicePlural || 'Servicio').slice(0, -1)}</Text>
                            </View>
                            <Text style={styles.citaTotal}>${ganancia.toLocaleString('es-CO')}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
                
                <View style={[styles.comprobanteFooter, { backgroundColor: '#F9FAFB' }]}>
                  <Text style={[styles.comprobanteFooterText, { color: colors.primary }]}>✨ ¡Sigue así, campeón! ✨</Text>
                  <Text style={styles.comprobanteFooterDate}>
                    Generado el {new Date().toLocaleString('es-CO')}
                  </Text>
                  <Text style={styles.comprobanteFooterBrand}>CUTTRACK - Tu negocio, bajo control</Text>
                </View>
              </View>
            </ScrollView>
            
            <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg }}>
              <TouchableOpacity 
                style={[styles.directButton, { borderColor: colors.error }]}
                onPress={soloGuardarImagen}
                disabled={guardando}
              >
                <Feather name="save" size={16} color={colors.error} style={{ marginRight: 8 }} />
                <Text style={[styles.directButtonText, { color: colors.error }]}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.directButton, { borderColor: colors.primary }]}
                onPress={guardarYCompartirImagen}
                disabled={compartiendo}
              >
                <Feather name="share-2" size={16} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.directButtonText, { color: colors.primary }]}>
                  {compartiendo ? 'Compartiendo...' : 'Compartir'}
                </Text>
              </TouchableOpacity>
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
    </ScrollView>
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
  comprobante: { 
    margin: 16, 
    borderRadius: 20, 
    overflow: 'hidden', 
    elevation: 8, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8 
  },
  comprobanteHeader: { 
    padding: 24, 
    alignItems: 'center' 
  },
  headerIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  comprobanteTitle: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: 'white', 
    letterSpacing: 2
  },
  comprobanteSubtitle: { 
    fontSize: 12, 
    color: 'rgba(255,255,255,0.8)', 
    marginTop: 4 
  },
  comprobanteInfo: { 
    padding: 20,
    backgroundColor: 'white'
  },
  barberoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16
  },
  barberoFoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FF6B35'
  },
  barberoInfo: {
    flex: 1
  },
  barberoNombre: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  barberoTelefono: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2
  },
  barberoComision: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4
  },
  fechaSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'white'
  },
  fechaText: {
    fontSize: 12,
    color: '#6B7280'
  },
  comprobanteStats: { 
    flexDirection: 'row', 
    padding: 20, 
    gap: 12,
    backgroundColor: 'white'
  },
  comprobanteStatCard: { 
    flex: 1, 
    backgroundColor: '#F3F4F6', 
    padding: 12, 
    borderRadius: 12, 
    alignItems: 'center',
    gap: 6
  },
  comprobanteStatValue: { 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  comprobanteStatLabel: { 
    fontSize: 11, 
    color: '#6B7280' 
  },
  comprobanteDivider: { 
    height: 1, 
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20
  },
  comprobanteResumen: { 
    padding: 20,
    gap: 12,
    backgroundColor: 'white'
  },
  resumenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  comprobanteResumenText: { 
    fontSize: 14, 
    color: '#374151' 
  },
  ultimasCitas: {
    padding: 20,
    backgroundColor: 'white'
  },
  ultimasCitasTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12
  },
  citaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  citaInfo: {
    flex: 1
  },
  citaCliente: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  citaServicio: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  citaTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981'
  },
  comprobanteFooter: { 
    padding: 16, 
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB'
  },
  comprobanteFooterText: { 
    fontSize: 14, 
    fontWeight: 'bold',
    marginBottom: 8
  },
  comprobanteFooterDate: { 
    fontSize: 10, 
    color: '#9CA3AF' 
  },
  comprobanteFooterBrand: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 8
  },
  directButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 40,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  directButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
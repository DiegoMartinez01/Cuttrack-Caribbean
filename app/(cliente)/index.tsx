import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';
import { useBusinessDictionary } from '../hooks/useBusinessDictionary';
import { useGameStyles } from '../hooks/useGameStyles';
import { CustomModal } from '../styles/components/ui/CustomModal';

interface Barbero {
  id: string;
  nombre: string;
  telefono: string;
  activo: boolean;
  horario_inicio: string;
  horario_fin: string;
  calificacion_promedio: number;
  total_reseñas: number;
  foto_url?: string;
  created_at: string;
  descanso_inicio?: string;
  descanso_fin?: string;
  enDescanso?: boolean;
}

export default function SeleccionarBarbero() {
  const { colors, global, spacing } = useGameStyles();
  
  const { 
    employeePlural,
    selectEmployee,
    getIcon,
    noEmployees,
    welcomeMessage: defaultWelcomeMessage,
    employeeName,
  } = useBusinessDictionary();
  
  const [barberos, setBarberos] = useState<Barbero[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [barbershopNombre, setBarbershopNombre] = useState<string>('');
  const [barbershopLogo, setBarbershopLogo] = useState<string | null>(null);
  const [adminNombre, setAdminNombre] = useState<string>('');
  const [adminFoto, setAdminFoto] = useState<string | null>(null);
  const [mensajeBienvenida, setMensajeBienvenida] = useState<string>('');

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
    cargarDatosNegocio();
    cargarBarberos();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarBarberos();
      cargarDatosNegocio();
    }, [])
  );

  const cargarDatosNegocio = async () => {
    try {
      const clienteId = await storage.getItem('cliente_id');
      if (!clienteId) return;

      const { data: cliente, error: clienteError } = await supabase
        .from('clients')
        .select('barbershop_id')
        .eq('id', clienteId)
        .single();

      if (clienteError) throw clienteError;
      if (!cliente?.barbershop_id) return;

      const { data: barbershop, error: barbershopError } = await supabase
        .from('barbershops')
        .select('nombre, logo_url')
        .eq('id', cliente.barbershop_id)
        .single();

      if (barbershopError) throw barbershopError;
      if (barbershop) {
        setBarbershopNombre(barbershop.nombre);
        setBarbershopLogo(barbershop.logo_url);
      }

      const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .select('nombre, foto_url')
        .eq('barbershop_id', cliente.barbershop_id)
        .eq('rol', 'owner')
        .single();

      if (adminError) throw adminError;
      if (adminUser) {
        setAdminNombre(adminUser.nombre);
        setAdminFoto(adminUser.foto_url);
      }

      const { data: barbershopConfig, error: configError } = await supabase
        .from('barbershops')
        .select('mensaje_bienvenida')
        .eq('id', cliente.barbershop_id)
        .single();

      if (configError) throw configError;
      if (barbershopConfig?.mensaje_bienvenida) {
        setMensajeBienvenida(barbershopConfig.mensaje_bienvenida);
      } else {
        setMensajeBienvenida(`✨ ¡Bienvenido a ${barbershop?.nombre || 'nuestro negocio'}!`);
      }

    } catch (error: any) {
      console.error('Error cargando datos del negocio:', error);
    }
  };

  const cargarBarberos = async () => {
    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      // 🔥 OBTENER EL barbershop_id DEL CLIENTE
      const clienteId = await storage.getItem('cliente_id');
      if (!clienteId) {
        setLoading(false);
        return;
      }

      const { data: cliente, error: clienteError } = await supabase
        .from('clients')
        .select('barbershop_id')
        .eq('id', clienteId)
        .single();

      if (clienteError || !cliente?.barbershop_id) {
        console.log('⚠️ Cliente sin barbershop_id');
        setLoading(false);
        return;
      }

      const barbershopId = cliente.barbershop_id;
      const hoy = new Date().toISOString().split('T')[0];
      
      // ✅ FILTRAR POR barbershop_id
      const { data, error } = await supabase
        .from('barbers')
        .select('*')
        .eq('activo', true)
        .eq('barbershop_id', barbershopId)  // 🔥 NUEVO FILTRO
        .order('nombre');
      
      if (error) throw error;
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      const barberosConEstado = (data || []).map(barbero => {
        const enDescanso = barbero.descanso_inicio && barbero.descanso_fin && 
                           barbero.descanso_inicio <= hoy && barbero.descanso_fin >= hoy;
        return { ...barbero, enDescanso };
      });
      
      setBarberos(barberosConEstado);
      
    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('❌ Error cargando barberos:', error);
      showModal('Error', error.message || `No se pudieron cargar los ${(employeePlural || 'profesionales').toLowerCase()}`, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarBarberos();
    cargarDatosNegocio();
  }, []);

  const getEstadoTexto = (barbero: any) => {
    if (barbero.enDescanso) return { texto: 'De descanso', color: colors.warning };
    if (!barbero.activo) return { texto: 'No disponible', color: colors.error };
    return { texto: 'Disponible', color: colors.success };
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

  const handlePressBarbero = (barbero: any) => {
    if (barbero.enDescanso) {
      showModal(
        `🧑‍💼 ${(employeeName || 'Empleado')} de descanso`,
        `${barbero.nombre} estará de descanso del ${barbero.descanso_inicio} al ${barbero.descanso_fin}. Por favor elige otro.`,
        'warning'
      );
      return;
    }
    
    router.push({
      pathname: '/(cliente)/seleccionar-servicio',
      params: { barberoId: barbero.id, barberoNombre: barbero.nombre }
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando {(employeePlural || 'profesionales').toLowerCase()}...</Text>
      </View>
    );
  }

  return (
    <View style={global.container}>
      <ScrollView 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[colors.primary]} 
            tintColor={colors.primary} 
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER: Logo + Nombre empresa */}
        <View style={{ alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.lg }}>
          {barbershopLogo ? (
            <View style={{
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              elevation: 8,
            }}>
              <Image 
                source={{ uri: barbershopLogo }} 
                style={{ 
                  width: 100, 
                  height: 100, 
                  borderRadius: 50, 
                  marginBottom: spacing.md,
                  borderWidth: 3,
                  borderColor: colors.primary,
                }}
              />
            </View>
          ) : (
            <View style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: colors.glass,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: spacing.md,
              borderWidth: 2,
              borderColor: colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              elevation: 8,
            }}>
              <Feather name={getIcon('business') as any} size={40} color={colors.primary} />
            </View>
          )}
          
          <Text style={[global.headerTitle, { fontSize: 26, letterSpacing: 2, marginTop: spacing.xs }]}>
            {barbershopNombre || 'CUTTRACK'}
          </Text>
          <View style={{ width: 60, height: 2, backgroundColor: colors.primary, marginTop: spacing.sm, borderRadius: 2 }} />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold', letterSpacing: 1 }}>
            {selectEmployee}
          </Text>
        </View>
        
        {barberos.length === 0 ? (
          <View style={global.emptyContainer}>
            <Feather name="users" size={48} color={colors.textMuted} />
            <Text style={global.emptyText}>{noEmployees}</Text>
            <Text style={global.emptySubtext}>
              Pronto agregaremos nuevos {(employeePlural || 'profesionales').toLowerCase()}
            </Text>
          </View>
        ) : (
          barberos.map((barbero) => {
            const estado = getEstadoTexto(barbero);
            const calificacion = barbero.calificacion_promedio || 0;
            const tieneCalificacion = calificacion > 0;
            const totalReseñas = barbero.total_reseñas || 0;
            const enDescanso = barbero.enDescanso;
            
            return (
              <TouchableOpacity
                key={barbero.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.card,
                  marginHorizontal: spacing.lg,
                  marginBottom: spacing.md,
                  padding: spacing.lg,
                  borderRadius: 20,
                  borderLeftWidth: 4,
                  borderLeftColor: enDescanso ? colors.warning : (barbero.activo ? colors.success : colors.error),
                  borderWidth: 1,
                  borderColor: enDescanso ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 107, 53, 0.2)',
                  opacity: enDescanso ? 0.7 : 1,
                }}
                activeOpacity={enDescanso ? 0.9 : 0.7}
                onPress={() => handlePressBarbero(barbero)}
              >
                {barbero.foto_url ? (
                  <Image 
                    source={{ uri: barbero.foto_url }} 
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      marginRight: spacing.base,
                      borderWidth: 2,
                      borderColor: enDescanso ? colors.warning : colors.primary,
                      opacity: enDescanso ? 0.6 : 1,
                    }}
                  />
                ) : (
                  <View style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.glass,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: spacing.base,
                    borderWidth: 1,
                    borderColor: enDescanso ? colors.warning : colors.glassBorder,
                  }}>
                    <Feather name="user" size={24} color={enDescanso ? colors.warning : colors.textSecondary} />
                  </View>
                )}
                
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Text style={{ 
                      color: enDescanso ? colors.warning : colors.text, 
                      fontWeight: 'bold', 
                      fontSize: 16, 
                      marginBottom: 4,
                      textDecorationLine: enDescanso ? 'line-through' : 'none',
                    }}>
                      {barbero.nombre}
                    </Text>
                    {enDescanso && (
                      <View style={{ 
                        backgroundColor: colors.warning, 
                        paddingHorizontal: 6, 
                        paddingVertical: 2, 
                        borderRadius: 8,
                      }}>
                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>DESCANSO</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <Text style={{ color: colors.gold, fontSize: 12, fontWeight: 'bold', marginRight: 6 }}>
                      {tieneCalificacion ? calificacion.toFixed(1) : 'Nuevo'}
                    </Text>
                    {tieneCalificacion && (
                      <Text style={{ fontSize: 10, color: colors.gold }}>{renderEstrellas(calificacion)}</Text>
                    )}
                    {totalReseñas > 0 && (
                      <Text style={{ color: colors.textMuted, fontSize: 9, marginLeft: 4 }}>
                        ({totalReseñas})
                      </Text>
                    )}
                  </View>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Feather name="circle" size={8} color={estado.color} />
                    <Text style={{ fontSize: 11, fontWeight: '500', color: estado.color }}>{estado.texto}</Text>
                  </View>
                  
                  {!enDescanso && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="clock" size={10} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 10 }}>
                        {barbero.horario_inicio?.slice(0, 5) || '09:00'} - {barbero.horario_fin?.slice(0, 5) || '19:00'}
                      </Text>
                    </View>
                  )}
                  
                  {enDescanso && barbero.descanso_inicio && barbero.descanso_fin && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="calendar" size={10} color={colors.warning} />
                      <Text style={{ color: colors.warning, fontSize: 10 }}>
                        Vuelve el {barbero.descanso_fin}
                      </Text>
                    </View>
                  )}
                </View>
                
                {!enDescanso ? (
                  <Feather name="chevron-right" size={18} color={colors.primary} />
                ) : (
                  <Feather name="lock" size={16} color={colors.warning} />
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <View style={{ 
        backgroundColor: colors.card,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        marginTop: spacing.sm,
        padding: spacing.md,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 53, 0.2)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}>
        {adminFoto ? (
          <View style={{
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 4,
          }}>
            <Image 
              source={{ uri: adminFoto }} 
              style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.primary }}
            />
          </View>
        ) : (
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.glass,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.glassBorder,
          }}>
            <Feather name="user" size={22} color={colors.textSecondary} />
          </View>
        )}
        
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: 'bold' }}>
            {adminNombre || 'Administrador'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }} numberOfLines={2}>
            {mensajeBienvenida || defaultWelcomeMessage}
          </Text>
        </View>
        
        <View style={{
          backgroundColor: colors.glass,
          padding: 8,
          borderRadius: 20,
        }}>
          <Feather name="message-circle" size={16} color={colors.gold} />
        </View>
      </View>

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
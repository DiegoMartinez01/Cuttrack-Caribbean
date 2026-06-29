export const unstable_settings = {
  headerShown: false,
};

import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../../services/supabase/client';
import { useBusinessDictionary } from '../../hooks/useBusinessDictionary';
import { useGameStyles } from '../../hooks/useGameStyles';
import { CustomModal } from '../../styles/components/ui/CustomModal';
import { GameButton } from '../../styles/components/ui/GameButton';
import { GameCard } from '../../styles/components/ui/GameCard';

function CustomHeader({ subtitle, onBack }: { subtitle: string; onBack: () => void }) {
  const { colors, spacing } = useGameStyles();
  const { getIcon } = useBusinessDictionary();
  
  return (
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingHorizontal: spacing.lg, 
      paddingTop: spacing.xl + 8,
      paddingBottom: spacing.md,
      backgroundColor: 'transparent',
    }}>
      <TouchableOpacity onPress={onBack} style={{ padding: 8, zIndex: 10 }}>
        <Feather name="arrow-left" size={24} color={colors.primary} />
      </TouchableOpacity>
      <View style={{ alignItems: 'center', flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name={getIcon('business') as any} size={12} color={colors.gold} />
          <Text style={{ color: colors.gold, fontSize: 14, letterSpacing: 2 }}>CUTTRACK</Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{subtitle}</Text>
      </View>
      <View style={{ width: 40 }} />
    </View>
  );
}

export default function AsignarServiciosBarbero() {
  const { colors, global, spacing } = useGameStyles();
  const { employeeName, employeePlural, servicePlural, getIcon } = useBusinessDictionary();
  const { id: barberoId, nombre: barberoNombreParam } = useLocalSearchParams();
  const [barbero, setBarbero] = useState<any>(null);
  const [servicios, setServicios] = useState<any[]>([]);
  const [serviciosAsignados, setServiciosAsignados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [bufferMinutes, setBufferMinutes] = useState('10');
  const [porcentajeComision, setPorcentajeComision] = useState('70');

  const [modal, setModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'confirm' as 'success' | 'error' | 'warning' | 'confirm',
    onConfirm: null as (() => void) | null,
  });

  const modalTimeoutRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const hideModal = () => {
    if (modalTimeoutRef.current) {
      clearTimeout(modalTimeoutRef.current);
      modalTimeoutRef.current = null;
    }
    setModal((prev) => ({ ...prev, visible: false }));
  };

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
    
    setModal({ visible: true, title, message, type, onConfirm: onConfirm || null });
    
    if (type === 'success') {
      const timeout = setTimeout(() => {
        hideModal();
      }, 2000);
      modalTimeoutRef.current = timeout;
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    hideModal();
    
    if (barberoId && typeof barberoId === 'string') {
      console.log('🔄 Recargando datos para empleado ID:', barberoId);
      setLoading(true);
      cargarDatos();
    } else {
      console.error('❌ ID inválido:', barberoId);
      showModal('Error', `No se pudo identificar el ${(employeeName || 'empleado').toLowerCase()}`, 'error', () => router.back());
    }
  }, [barberoId]);

  const cargarDatos = async () => {
    if (!barberoId) return;
    
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const { data: barberoData, error: barberoError } = await supabase
        .from('barbers')
        .select('*')
        .eq('id', barberoId)
        .single();

      if (barberoError) throw barberoError;
      if (!barberoData) throw new Error(`${(employeeName || 'Empleado')} no encontrado`);
      
      setBarbero(barberoData);
      setBarbershopId(barberoData.barbershop_id);

      if (barberoData.buffer_minutes !== undefined && barberoData.buffer_minutes !== null) {
        setBufferMinutes(barberoData.buffer_minutes.toString());
      }

      if (barberoData.porcentaje_comision !== undefined && barberoData.porcentaje_comision !== null) {
        setPorcentajeComision(barberoData.porcentaje_comision.toString());
      }

      const { data: serviciosData, error: serviciosError } = await supabase
        .from('services')
        .select('*')
        .eq('barbershop_id', barberoData.barbershop_id)
        .order('activo', { ascending: false })
        .order('nombre');

      if (serviciosError) throw serviciosError;
      setServicios(serviciosData || []);

      const { data: asignadosData, error: asignadosError } = await supabase
        .from('barber_services')
        .select('service_id')
        .eq('barber_id', barberoId);

      if (asignadosError) throw asignadosError;
      
      const asignadosSet = new Set(asignadosData?.map(a => a.service_id) || []);
      setServiciosAsignados(asignadosSet);

    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('❌ Error cargando datos:', error);
      showModal('Error', error.message || 'No se pudieron cargar los datos', 'error', () => router.back());
    } finally {
      setLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const toggleServicio = (serviceId: string) => {
    const newSet = new Set(serviciosAsignados);
    if (newSet.has(serviceId)) {
      newSet.delete(serviceId);
    } else {
      newSet.add(serviceId);
    }
    setServiciosAsignados(newSet);
  };

  const guardarAsignaciones = async () => {
    if (!barberoId || typeof barberoId !== 'string') {
      showModal('Error', `No se pudo identificar el ${(employeeName || 'empleado').toLowerCase()}`, 'error');
      return;
    }

    const bufferValue = parseInt(bufferMinutes);
    if (isNaN(bufferValue) || bufferValue < 0) {
      showModal('Error', 'El buffer debe ser un número válido (mínimo 0)', 'error');
      return;
    }

    const porcentajeValue = parseInt(porcentajeComision);
    if (isNaN(porcentajeValue) || porcentajeValue < 0 || porcentajeValue > 100) {
      showModal('Error', 'El porcentaje de comisión debe ser un número entre 0 y 100', 'error');
      return;
    }

    setGuardando(true);
    timeoutRef.current = setTimeout(() => {
      setGuardando(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);
    
    try {
      const { error: bufferError } = await supabase
        .from('barbers')
        .update({ buffer_minutes: bufferValue })
        .eq('id', barberoId);

      if (bufferError) throw bufferError;

      const { error: porcentajeError } = await supabase
        .from('barbers')
        .update({ porcentaje_comision: porcentajeValue })
        .eq('id', barberoId);

      if (porcentajeError) throw porcentajeError;

      const { error: deleteError } = await supabase
        .from('barber_services')
        .delete()
        .eq('barber_id', barberoId);

      if (deleteError) throw deleteError;

      if (serviciosAsignados.size > 0) {
        const nuevos = Array.from(serviciosAsignados).map(serviceId => ({
          barber_id: barberoId,
          service_id: serviceId,
        }));
        
        const { error: insertError } = await supabase
          .from('barber_services')
          .insert(nuevos);

        if (insertError) throw insertError;
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      showModal(
        '✅ Configuración guardada',
        `Se han asignado ${serviciosAsignados.size} ${(servicePlural || 'servicios').toLowerCase()} a ${barbero?.nombre}.\n⏱️ Buffer: ${bufferValue} minutos.\n💰 Comisión: ${porcentajeValue}%`,
        'success',
        () => router.replace('/(admin)/barberos')
      );

    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      showModal('Error', error.message || 'No se pudieron guardar los cambios', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const handleBack = () => {
    router.replace('/(admin)/barberos');
  };

  if (loading) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={global.loadingText}>Cargando {(servicePlural || 'servicios').toLowerCase()}...</Text>
      </View>
    );
  }

  const serviciosActivos = servicios.filter(s => s.activo === true);
  const serviciosInactivos = servicios.filter(s => s.activo === false);
  const serviciosAsignadosCount = serviciosAsignados.size;

  return (
    <View style={global.container}>
      <CustomHeader 
        subtitle={barbero ? `ASIGNAR ${(servicePlural || 'SERVICIOS').toUpperCase()} - ${barbero.nombre.toUpperCase()}` : `ASIGNAR ${(servicePlural || 'SERVICIOS').toUpperCase()}`} 
        onBack={handleBack}
      />

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        
        <View style={{ padding: spacing.lg }}>
          <GameCard variant="game" style={{ marginBottom: spacing.lg }}>
            <Text style={{ color: colors.gold, fontSize: 14, fontWeight: 'bold', marginBottom: spacing.sm }}>
              ⏱️ Configuración de tiempo entre citas
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: spacing.md }}>
              Tiempo que este {employeeName?.toLowerCase()} necesita entre clientes (limpieza, preparación)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <TextInput
                style={[global.input, { flex: 1, textAlign: 'center', backgroundColor: colors.glass }]}
                value={bufferMinutes}
                onChangeText={setBufferMinutes}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor={colors.textMuted}
                editable={!guardando}
              />
              <Text style={{ color: colors.text, fontSize: 14 }}>minutos</Text>
            </View>
          </GameCard>

          <GameCard variant="game" style={{ marginBottom: spacing.lg }}>
            <Text style={{ color: colors.gold, fontSize: 14, fontWeight: 'bold', marginBottom: spacing.sm }}>
              💰 Configuración de comisión
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: spacing.md }}>
              Porcentaje que este {employeeName?.toLowerCase()} recibe por cada servicio completado
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <TextInput
                style={[global.input, { flex: 1, textAlign: 'center', backgroundColor: colors.glass }]}
                value={porcentajeComision}
                onChangeText={setPorcentajeComision}
                keyboardType="numeric"
                placeholder="70"
                placeholderTextColor={colors.textMuted}
                editable={!guardando}
              />
              <Text style={{ color: colors.text, fontSize: 14 }}>%</Text>
            </View>
          </GameCard>

          <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
            <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.gold }}>{serviciosAsignadosCount}</Text>
              <Text style={global.textSecondary}>{(servicePlural || 'Servicios')} asignados</Text>
            </GameCard>
            <GameCard variant="elevated" style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.gold }}>{serviciosActivos.length}</Text>
              <Text style={global.textSecondary}>{(servicePlural || 'Servicios')} activos</Text>
            </GameCard>
          </View>

          <Text style={{ color: colors.gold, fontWeight: 'bold', marginBottom: spacing.md, fontSize: 14 }}>
            ✅ {(servicePlural || 'Servicios')} activos
          </Text>
          
          {serviciosActivos.length === 0 ? (
            <View style={global.emptyContainer}>
              <Feather name={getIcon('service') as any} size={48} color={colors.textMuted} />
              <Text style={global.emptyText}>No hay {(servicePlural || 'servicios').toLowerCase()} activos</Text>
              <Text style={global.emptySubtext}>Crea {(servicePlural || 'servicios').toLowerCase()} primero en la pestaña {servicePlural}</Text>
            </View>
          ) : (
            serviciosActivos.map((servicio) => {
              const isAssigned = serviciosAsignados.has(servicio.id);
              return (
                <TouchableOpacity
                  key={servicio.id}
                  style={{
                    backgroundColor: isAssigned ? colors.primary : colors.card,
                    padding: spacing.base,
                    borderRadius: 12,
                    marginBottom: spacing.md,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isAssigned ? colors.primary : 'rgba(255,107,53,0.2)',
                  }}
                  onPress={() => toggleServicio(servicio.id)}
                  activeOpacity={0.7}
                  disabled={guardando}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>
                      {servicio.nombre}
                    </Text>
                    <Text style={{ color: isAssigned ? 'rgba(255,255,255,0.8)' : colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      ⏱️ {servicio.duracion_min} min • ${servicio.precio.toLocaleString('es-CO')}
                    </Text>
                  </View>
                  <View style={{ 
                    width: 28, 
                    height: 28, 
                    borderRadius: 14, 
                    backgroundColor: isAssigned ? colors.text : colors.card,
                    justifyContent: 'center', 
                    alignItems: 'center' 
                  }}>
                    <Feather 
                      name={isAssigned ? "check" : "plus"} 
                      size={16} 
                      color={isAssigned ? colors.primary : colors.textSecondary} 
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {serviciosInactivos.length > 0 && (
            <>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                gap: spacing.sm, 
                marginTop: spacing.md,
                marginBottom: spacing.md 
              }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.glassBorder }} />
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  ⏳ {(servicePlural || 'Servicios')} no disponibles
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.glassBorder }} />
              </View>

              {serviciosInactivos.map((servicio) => {
                const isAssigned = serviciosAsignados.has(servicio.id);
                return (
                  <TouchableOpacity
                    key={servicio.id}
                    style={{
                      backgroundColor: colors.card,
                      padding: spacing.base,
                      borderRadius: 12,
                      marginBottom: spacing.md,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(245, 158, 11, 0.3)',
                      opacity: 0.7,
                    }}
                    onPress={() => toggleServicio(servicio.id)}
                    activeOpacity={0.7}
                    disabled={guardando}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: 'bold', textDecorationLine: 'line-through' }}>
                          {servicio.nombre}
                        </Text>
                        <View style={{ backgroundColor: colors.warning, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>DESACTIVADO</Text>
                        </View>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                        ⏱️ {servicio.duracion_min} min • ${servicio.precio.toLocaleString('es-CO')}
                      </Text>
                      {isAssigned && (
                        <Text style={{ color: colors.warning, fontSize: 10, marginTop: 2 }}>
                          ⚠️ Asignado pero el servicio está desactivado
                        </Text>
                      )}
                    </View>
                    <View style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 14, 
                      backgroundColor: isAssigned ? colors.warning : colors.card,
                      justifyContent: 'center', 
                      alignItems: 'center' 
                    }}>
                      <Feather 
                        name={isAssigned ? "check" : "plus"} 
                        size={16} 
                        color={isAssigned ? '#fff' : colors.textMuted} 
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>

      <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.card }}>
        <GameButton 
          title={guardando ? '⏳ Guardando...' : '💾 Guardar configuración'}
          variant="primary"
          onPress={guardarAsignaciones}
          disabled={guardando}
        />
        {serviciosAsignadosCount === 0 && (
          <Text style={{ color: colors.warning, fontSize: 11, textAlign: 'center', marginTop: spacing.md }}>
            ⚠️ Al menos un {(servicePlural || 'servicio').slice(0, -1).toLowerCase()} debe estar asignado para que los clientes puedan agendar
          </Text>
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
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../../services/supabase/client';
import { useBusinessDictionary } from '../../hooks/useBusinessDictionary';
import { useGameStyles } from '../../hooks/useGameStyles';
import { useNotifications } from '../../hooks/useNotifications'; // 🔥 NUEVO: Notificaciones
import { CustomModal } from '../../styles/components/ui/CustomModal';
import { GameButton } from '../../styles/components/ui/GameButton';
import { GameCard } from '../../styles/components/ui/GameCard';
import { ImageUploader } from '../../styles/components/ui/ImageUploader';

export default function CalificarCita() {
  const { colors, global, spacing } = useGameStyles();
  const { id } = useLocalSearchParams();
  
  // 🔥 HOOKS
  const { 
    employeeName,
    serviceName,
    appointmentName,
    actionRate,
    statusCompleted,
    getIcon,
  } = useBusinessDictionary();

  const { notify } = useNotifications(); // 🔥 NUEVO: Notificaciones
  
  const [calificacion, setCalificacion] = useState(0);
  const [comentario, setComentario] = useState('');
  const [fotoResena, setFotoResena] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cita, setCita] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

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
    if (id) {
      cargarCita();
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [id]);

  const cargarCita = async () => {
    timeoutRef.current = setTimeout(() => {
      setCargando(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          barbers (id, nombre),
          services (id, nombre, foto_url),
          clients (nombre)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      const estadoCompletado = statusCompleted || 'completada';
      
      if (data.estado !== 'completada') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        showModal(
          `No puedes ${(actionRate || 'calificar').toLowerCase()}`,
          `Solo puedes ${(actionRate || 'calificar').toLowerCase()} ${(appointmentName || 'citas').toLowerCase()} ${(statusCompleted || 'completadas').toLowerCase()}.`,
          'warning',
          () => router.back()
        );
        return;
      }
      
      if (data.calificacion_cliente && data.calificacion_cliente > 0) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        showModal(
          `Ya ${(actionRate || 'calificaste').toLowerCase()}`,
          `Ya has ${(actionRate || 'calificado').toLowerCase()} esta ${(appointmentName || 'cita').toLowerCase()} anteriormente.`,
          'warning',
          () => router.back()
        );
        return;
      }
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setCita(data);
      
    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('Error cargando cita:', error);
      showModal('Error', error.message || `No se pudo cargar la ${(appointmentName || 'cita').toLowerCase()}`, 'error', () => router.back());
    } finally {
      setCargando(false);
    }
  };

  const actualizarEstadisticasBarbero = async (barberoId: string) => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('calificacion_cliente')
        .eq('barbero_id', barberoId)
        .gt('calificacion_cliente', 0);

      if (error || !data || data.length === 0) return;
      
      const suma = data.reduce((acc, c) => acc + c.calificacion_cliente, 0);
      const promedio = suma / data.length;
      const total = data.length;
      
      await supabase
        .from('barbers')
        .update({ 
          calificacion_promedio: promedio,
          total_reseñas: total
        })
        .eq('id', barberoId);
        
    } catch (error) {
      console.error('Error actualizando estadísticas:', error);
    }
  };

  const enviarCalificacion = async () => {
    if (calificacion === 0) {
      showModal('Error', 'Selecciona una calificación del 1 al 5', 'error');
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      showModal('Tiempo de espera agotado', 'Revisa tu conexión a internet', 'error');
    }, 20000);

    try {
      const { data: citaActual, error: checkError } = await supabase
        .from('appointments')
        .select('estado, calificacion_cliente')
        .eq('id', id)
        .single();
      
      if (checkError) throw checkError;
      
      if (!citaActual) {
        throw new Error(`No se pudo verificar la ${(appointmentName || 'cita').toLowerCase()}`);
      }
      
      const estadoCompletado = statusCompleted || 'completada';
      if (citaActual.estado !== 'completada') {
        throw new Error(`Solo puedes ${(actionRate || 'calificar').toLowerCase()} ${(appointmentName || 'citas').toLowerCase()} ${(statusCompleted || 'completadas').toLowerCase()}`);
      }
      
      if (citaActual.calificacion_cliente && citaActual.calificacion_cliente > 0) {
        throw new Error(`Ya ${(actionRate || 'calificaste').toLowerCase()} esta ${(appointmentName || 'cita').toLowerCase()}`);
      }
      
      const { error: citaError } = await supabase
        .from('appointments')
        .update({
          calificacion_cliente: calificacion,
          comentario_cliente: comentario.trim() || null,
          foto_resena: fotoResena || null,
        })
        .eq('id', id);

      if (citaError) throw citaError;

      await actualizarEstadisticasBarbero(cita.barbero_id);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // 🔥 ENVIAR NOTIFICACIÓN DE CALIFICACIÓN
      try {
        await notify(
          'NEW_RATING',
          '⭐ ¡Gracias por calificar!',
          `Tu calificación para ${cita.barbers?.nombre || (employeeName || 'el profesional')} ha sido guardada.`,
          { appointmentId: id, rating: calificacion }
        );
      } catch (notifError) {
        console.log('⚠️ Error en notificación (no crítico):', notifError);
      }

      showModal(
        '✅ Gracias',
        `Tu ${(actionRate || 'calificación').toLowerCase()} ha sido guardada`,
        'success',
        () => router.replace('/(cliente)/mis-citas')
      );

    } catch (error: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('Error guardando calificación:', error);
      showModal('Error', error.message || `No se pudo guardar la ${(actionRate || 'calificación').toLowerCase()}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (cargando) {
    return (
      <View style={global.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={global.container}
      contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[global.header, { paddingTop: spacing.xl, marginBottom: spacing.lg }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="star" size={24} color={colors.gold} />
          <Text style={[global.headerTitle, { fontSize: 24 }]}>
            {(actionRate || 'Calificar')}
          </Text>
        </View>
        <Text style={global.headerSubtitle}>
          ¿Cómo te fue con {cita?.barbers?.nombre || (employeeName || 'el profesional')}?
        </Text>
      </View>

      {cita?.services?.foto_url && (
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <Image 
            source={{ uri: cita.services.foto_url }} 
            style={{ width: 80, height: 80, borderRadius: 12, marginBottom: spacing.xs }}
          />
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{cita.services?.nombre || (serviceName || 'Servicio')}</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.xl }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setCalificacion(star)}>
            <Text style={{ 
              fontSize: 44, 
              marginHorizontal: spacing.xs, 
              color: calificacion >= star ? colors.gold : colors.textMuted 
            }}>
              {calificacion >= star ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Feather name="message-circle" size={16} color={colors.gold} />
          <Text style={[global.textSecondary, { fontWeight: 'bold' }]}>Tu comentario (opcional)</Text>
        </View>
        <TextInput
          style={[global.input, { textAlignVertical: 'top', minHeight: 100, backgroundColor: colors.glass }]}
          placeholder={`¿Qué te pareció el ${(serviceName || 'servicio').toLowerCase()}?`}
          placeholderTextColor={colors.textMuted}
          value={comentario}
          onChangeText={setComentario}
          multiline
          numberOfLines={4}
          editable={!loading}
        />
      </GameCard>

      <GameCard variant="elevated" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Feather name="camera" size={16} color={colors.gold} />
          <Text style={[global.textSecondary, { fontWeight: 'bold' }]}>Foto de tu resultado (opcional)</Text>
        </View>
        <ImageUploader
          onImageUploaded={setFotoResena}
          currentImage={fotoResena}
          aspect={[1, 1]}
        />
        <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: spacing.xs }}>
          📸 Comparte una foto de tu {(serviceName || 'servicio').toLowerCase()}
        </Text>
      </GameCard>

      <GameButton 
        title={loading ? 'Enviando...' : `Enviar ${(actionRate || 'calificación').toLowerCase()}`}
        variant="primary"
        onPress={enviarCalificacion}
        disabled={loading}
        style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg }}
        icon="send"
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
    </ScrollView>
  );
}
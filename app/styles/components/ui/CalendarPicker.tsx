import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../../../../services/supabase/client';
import { useGameStyles } from '../../../hooks/useGameStyles';

interface CalendarPickerProps {
  barberoId: string;
  onSelectDate: (date: string) => void;
  selectedDate?: string;
}

export default function CalendarPicker({ barberoId, onSelectDate, selectedDate }: CalendarPickerProps) {
  const { colors, spacing } = useGameStyles();
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [citasOcupadas, setCitasOcupadas] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date().toISOString().split('T')[0]);

  // 🔥 Calcular fecha actual con zona horaria LOCAL
  const obtenerFechaLocal = (): string => {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };

  const hoy = obtenerFechaLocal();
  console.log('📅 CalendarPicker - Hoy (local):', hoy);

  useEffect(() => {
    if (barberoId) {
      cargarDiasOcupados();
    }
  }, [barberoId, currentMonth]);

  const cargarDiasOcupados = async () => {
    setLoading(true);
    try {
      const [year, month] = currentMonth.split('-');
      const startOfMonth = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endOfMonth = `${year}-${month}-${lastDay}`;

      // 🔥 Incluir también citas completadas para mostrar días ocupados
      const { data, error } = await supabase
        .from('appointments')
        .select('fecha_hora')
        .eq('barbero_id', barberoId)
        .in('estado', ['pendiente', 'confirmada', 'completada'])
        .gte('fecha_hora', `${startOfMonth} 00:00:00`)
        .lte('fecha_hora', `${endOfMonth} 23:59:59`);

      if (error) throw error;

      const diasOcupados = data?.map(cita => cita.fecha_hora.split('T')[0]) || [];
      setCitasOcupadas(diasOcupados);
      console.log('📅 Días ocupados en este mes:', diasOcupados);

      const marked: Record<string, any> = {};
      
      // 🔥 Marcar días ocupados (rojos, pero seleccionables - sin disabled)
      diasOcupados.forEach(dia => {
        marked[dia] = {
          selected: true,
          selectedColor: colors.error,
          selectedTextColor: 'white',
        };
      });

      // 🔥 Marcar días anteriores a hoy como deshabilitados (no seleccionables)
      const hoyDate = new Date(hoy);
      for (let i = 1; i <= 30; i++) {
        const fechaPasada = new Date(hoyDate);
        fechaPasada.setDate(hoyDate.getDate() - i);
        const fechaPasadaStr = fechaPasada.toISOString().split('T')[0];
        
        if (!marked[fechaPasadaStr]) {
          marked[fechaPasadaStr] = {
            disabled: true,
            disableTouchEvent: true,
          };
        }
      }

      // Marcar día seleccionado actualmente (si existe y no es día pasado)
      if (selectedDate && selectedDate >= hoy) {
        // Limpiar selección anterior de otros días
        Object.keys(marked).forEach(key => {
          if (marked[key]?.selected && marked[key]?.selectedColor !== colors.error) {
            const temp = { ...marked[key] };
            delete temp.selected;
            delete temp.selectedColor;
            marked[key] = temp;
          }
        });
        
        marked[selectedDate] = {
          ...marked[selectedDate],
          selected: true,
          selectedColor: colors.primary,
          selectedTextColor: 'white',
        };
      }

      setMarkedDates(marked);
    } catch (error) {
      console.error('Error cargando días ocupados:', error);
    } finally {
      setLoading(false);
    }
  };

  const onDayPress = (day: any) => {
    const fecha = day.dateString;
    console.log('🔥 CalendarPicker - Día presionado:', fecha);
    console.log('🔥 Días ocupados:', citasOcupadas);
    console.log('🔥 Hoy:', hoy);
    
    // No permitir seleccionar días pasados
    if (fecha < hoy) {
      console.log('❌ Día pasado, no se puede seleccionar');
      return;
    }
    
    // ✅ PERMITIR seleccionar días ocupados (no se bloquea)
    if (citasOcupadas.includes(fecha)) {
      console.log('⚠️ Día con citas, pero se permite seleccionar para ver las citas');
    }

    const newMarked: Record<string, any> = { ...markedDates };
    
    // Limpiar selección anterior (solo de días que no son ocupados con color error)
    Object.keys(newMarked).forEach(key => {
      if (newMarked[key]?.selected && newMarked[key]?.selectedColor !== colors.error && key >= hoy) {
        const temp = { ...newMarked[key] };
        delete temp.selected;
        delete temp.selectedColor;
        newMarked[key] = temp;
      }
    });
    
    // Marcar nuevo día
    newMarked[fecha] = {
      ...newMarked[fecha],
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: 'white',
    };
    
    setMarkedDates(newMarked);
    onSelectDate(fecha);
  };

  const theme = () => ({
    backgroundColor: colors.background,
    calendarBackground: colors.card,
    textSectionTitleColor: colors.textSecondary,
    selectedDayBackgroundColor: colors.primary,
    selectedDayTextColor: colors.text,
    todayTextColor: colors.gold,
    dayTextColor: colors.text,
    textDisabledColor: colors.textMuted,
    arrowColor: colors.primary,
    monthTextColor: colors.gold,
    indicatorColor: colors.primary,
    textDayFontSize: 13,
    textMonthFontSize: 14,
    textDayHeaderFontSize: 11,
  });

  if (loading) {
    return (
      <View style={{ padding: spacing.md, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ 
      marginHorizontal: spacing.md, 
      marginBottom: spacing.md,
      backgroundColor: colors.card, 
      borderRadius: 16, 
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,107,53,0.2)',
    }}>
      <Calendar
        current={currentMonth}
        minDate={hoy}
        onDayPress={onDayPress}
        markedDates={markedDates}
        theme={theme()}
        markingType="dot"
        hideExtraDays={true}
        enableSwipeMonths={true}
        onMonthChange={(month) => {
          console.log('📅 Mes cambiado a:', month.dateString);
          setCurrentMonth(month.dateString);
        }}
        style={{ 
          borderRadius: 12,
          paddingBottom: spacing.sm,
        }}
      />
    </View>
  );
}
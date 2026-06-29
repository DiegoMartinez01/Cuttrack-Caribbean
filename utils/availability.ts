export interface Servicio {
  id: number;
  nombre: string;
  duracion: number;
  precio: number;
}

export interface CitaExistente {
  id: string;
  hora: string;
  duracion: number;
}

export interface HorarioDisponible {
  hora: string;
  horaFormateada: string;
  disponible: boolean;
  razon?: string;
}

function horaToMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function minutosToHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatHora12(hora: string): string {
  const [h, m] = hora.split(':');
  const horaNum = parseInt(h);
  const ampm = horaNum >= 12 ? 'PM' : 'AM';
  const hora12 = horaNum % 12 || 12;
  return `${hora12}:${m} ${ampm}`;
}

export function calcularFin(horaInicio: string, duracionMinutos: number, bufferMinutos: number = 10): string {
  const minutosInicio = horaToMinutos(horaInicio);
  const minutosFin = minutosInicio + duracionMinutos + bufferMinutos;
  return minutosToHora(minutosFin);
}

export function haySolapamiento(
  inicio1: string, 
  fin1: string, 
  inicio2: string, 
  fin2: string
): boolean {
  const ini1 = horaToMinutos(inicio1);
  const fin1Min = horaToMinutos(fin1);
  const ini2 = horaToMinutos(inicio2);
  const fin2Min = horaToMinutos(fin2);
  
  return ini1 < fin2Min && fin1Min > ini2;
}

export function obtenerHorariosDisponibles(
  barberoId: number,
  servicio: Servicio,
  citasExistentes: CitaExistente[],
  fecha: string,
  horaInicioJornada: number = 9,
  horaFinJornada: number = 20,
  intervaloMinutos: number = 30,
  bufferMinutos: number = 10
): HorarioDisponible[] {
  
  const horarios: HorarioDisponible[] = [];
  const maxHoraInicio = (horaFinJornada * 60) - servicio.duracion - bufferMinutos;
  const hoy = new Date().toISOString().split('T')[0];
  const ahoraMinutos = new Date().getHours() * 60 + new Date().getMinutes();
  
  console.log(`🔍 horaInicioJornada: ${horaInicioJornada * 60}`);
  console.log(`🔍 maxHoraInicio: ${maxHoraInicio}`);
  console.log(`🔍 servicio.duracion: ${servicio.duracion}`);
  
  // Si la fecha es anterior a hoy, no mostrar horarios
  if (fecha < hoy) {
    console.log(`📅 Fecha ${fecha} es anterior a hoy ${hoy}, no hay horarios`);
    return [];
  }
  
  console.log(`🔍 Calculando horarios para barbero ${barberoId} en fecha ${fecha}`);
  console.log(`📋 Citas existentes: ${citasExistentes.length}`);
  
  // Si no hay citas, mostrar todos los horarios
  if (citasExistentes.length === 0) {
    console.log(`✅ No hay citas, generando todos los horarios`);
  }
  
  for (let minutos = horaInicioJornada * 60; minutos <= maxHoraInicio; minutos += intervaloMinutos) {
    const horaInicio = minutosToHora(minutos);
    const horaFin = calcularFin(horaInicio, servicio.duracion, bufferMinutos);
    
    let disponible = true;
    let razon = '';
    
    // Verificar si ya pasó la hora (solo si es hoy)
    if (fecha === hoy) {
      if (minutos < ahoraMinutos + 30) {
        disponible = false;
        razon = '🕐 Horario ya pasó';
      }
    }
    
    // Verificar contra citas existentes
    if (disponible && citasExistentes.length > 0) {
      for (const cita of citasExistentes) {
        const duracionCita = servicio.duracion;
        const finCitaExistente = calcularFin(cita.hora, duracionCita, bufferMinutos);
        
        if (haySolapamiento(horaInicio, horaFin, cita.hora, finCitaExistente)) {
          disponible = false;
          razon = '📅 Horario ocupado';
          break;
        }
      }
    }
    
    horarios.push({
      hora: horaInicio,
      horaFormateada: formatHora12(horaInicio),
      disponible,
      razon,
    });
  }
  
  const disponibles = horarios.filter(h => h.disponible).length;
  console.log(`✅ Horarios generados: ${horarios.length}`);
  console.log(`✅ Horarios disponibles encontrados: ${disponibles}`);
  
  if (disponibles === 0 && horarios.length > 0) {
    console.log(`⚠️ Hay horarios generados pero todos ocupados`);
  }
  
  return horarios;
}
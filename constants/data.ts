// Datos para CUTTRACK - Cartagena, Colombia

export interface Barbero {
  id: number;
  nombre: string;
  especialidad: string;
  rating: number;
  imagen: string;
  horarioInicio: string; // "09:00"
  horarioFin: string;    // "19:00"
  bufferEntreCitas: number; // minutos
  estaActivo: boolean;
  pausaHasta?: string; // "14:00" si está en almuerzo
  servicios: Servicio[];
}

export interface Servicio {
  id: number;
  nombre: string;
  duracion: number; // minutos
  precio: number;   // COP
  activo: boolean;
}

export interface Cita {
  id: string;
  barberoId: number;
  servicioId: number;
  fecha: string; // YYYY-MM-DD
  hora: string;  // HH:MM
  clienteNombre: string;
  estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
}

// Servicios disponibles (catálogo general)
export const catalogoServicios: Servicio[] = [
  { id: 1, nombre: 'Corte Clásico', duracion: 30, precio: 18000, activo: true },
  { id: 2, nombre: 'Corte + Barba', duracion: 45, precio: 30000, activo: true },
  { id: 3, nombre: 'Corte Premium', duracion: 60, precio: 40000, activo: true },
  { id: 4, nombre: 'Solo Barba', duracion: 20, precio: 15000, activo: true },
  { id: 5, nombre: 'Afeitado Tradicional', duracion: 25, precio: 20000, activo: true },
  { id: 6, nombre: 'Corte + Barba + Cejas', duracion: 55, precio: 45000, activo: true },
];

// Barberos con sus servicios específicos y disponibilidad
export const barberos: Barbero[] = [
  {
    id: 1,
    nombre: 'Carlos "El Jefe" Ramírez',
    especialidad: 'Corte Clásico y Barba',
    rating: 4.8,
    imagen: '👨‍🦱',
    horarioInicio: '09:00',
    horarioFin: '19:00',
    bufferEntreCitas: 10,
    estaActivo: true,
    servicios: [
      catalogoServicios[0], // Corte Clásico
      catalogoServicios[1], // Corte + Barba
      catalogoServicios[3], // Solo Barba
    ],
  },
  {
    id: 2,
    nombre: 'Miguel Torres',
    especialidad: 'Corte Premium y Diseños',
    rating: 4.9,
    imagen: '🧔',
    horarioInicio: '10:00',
    horarioFin: '20:00',
    bufferEntreCitas: 10,
    estaActivo: true,
    servicios: [
      catalogoServicios[2], // Corte Premium
      catalogoServicios[1], // Corte + Barba
      catalogoServicios[5], // Corte + Barba + Cejas
    ],
  },
  {
    id: 3,
    nombre: 'David Sánchez',
    especialidad: 'Afeitado y Barba',
    rating: 4.7,
    imagen: '👨',
    horarioInicio: '09:00',
    horarioFin: '18:00',
    bufferEntreCitas: 15,
    estaActivo: false, // Descanso hoy
    pausaHasta: 'mañana',
    servicios: [
      catalogoServicios[3], // Solo Barba
      catalogoServicios[4], // Afeitado Tradicional
    ],
  },
  {
    id: 4,
    nombre: 'Javier "Mano" Díaz',
    especialidad: 'Barba + Diseños',
    rating: 4.9,
    imagen: '🧔‍♂️',
    horarioInicio: '11:00',
    horarioFin: '21:00',
    bufferEntreCitas: 10,
    estaActivo: true,
    servicios: [
      catalogoServicios[1], // Corte + Barba
      catalogoServicios[5], // Corte + Barba + Cejas
    ],
  },
];

// CITAS DE EJEMPLO (para calcular disponibilidad)
export const citasEjemplo: Cita[] = [
  {
    id: '1',
    barberoId: 1,
    servicioId: 1,
    fecha: new Date().toISOString().split('T')[0],
    hora: '10:00',
    clienteNombre: 'Juan Pérez',
    estado: 'pendiente',
  },
  {
    id: '2',
    barberoId: 1,
    servicioId: 2,
    fecha: new Date().toISOString().split('T')[0],
    hora: '11:30',
    clienteNombre: 'Carlos López',
    estado: 'pendiente',
  },
  {
    id: '3',
    barberoId: 2,
    servicioId: 2,
    fecha: new Date().toISOString().split('T')[0],
    hora: '14:00',
    clienteNombre: 'Andrés Gómez',
    estado: 'pendiente',
  },
];

// Función para obtener disponibilidad de un barbero en una fecha específica
export function obtenerCuposDisponibles(barbero: Barbero, fecha: string, citasExistentes: Cita[]): number {
  const citasDelDia = citasExistentes.filter(c => c.barberoId === barbero.id && c.fecha === fecha);
  
  // Calcular minutos totales trabajados
  const [horaInicio, minInicio] = barbero.horarioInicio.split(':').map(Number);
  const [horaFin, minFin] = barbero.horarioFin.split(':').map(Number);
  const minutosTotales = (horaFin * 60 + minFin) - (horaInicio * 60 + minInicio);
  
  // Calcular minutos ocupados por citas
  let minutosOcupados = 0;
  for (const cita of citasDelDia) {
    const servicio = barbero.servicios.find(s => s.id === cita.servicioId);
    if (servicio) {
      minutosOcupados += servicio.duracion + barbero.bufferEntreCitas;
    }
  }
  
  const minutosDisponibles = minutosTotales - minutosOcupados;
  
  // Estimar cupos basado en duración promedio (40 min como referencia)
  const duracionPromedio = 40;
  return Math.max(0, Math.floor(minutosDisponibles / duracionPromedio));
}

// Función para determinar estado visual del barbero
export function obtenerEstadoBarbero(barbero: Barbero): { color: string; texto: string; disponible: boolean } {
  if (!barbero.estaActivo) {
    return { color: '🔴', texto: 'No disponible hoy', disponible: false };
  }
  
  if (barbero.pausaHasta) {
    return { color: '🟡', texto: `En pausa hasta ${barbero.pausaHasta}`, disponible: false };
  }
  
  // Verificar si hay citas hoy
  const hoy = new Date().toISOString().split('T')[0];
  const citasHoy = citasEjemplo.filter(c => c.barberoId === barbero.id && c.fecha === hoy);
  
  if (citasHoy.length > 0) {
    const ultimaCita = citasHoy[citasHoy.length - 1];
    const [hora] = ultimaCita.hora.split(':');
    const horaNum = parseInt(hora);
    if (horaNum >= 16) {
      return { color: '🟡', texto: 'Últimos cupos', disponible: true };
    }
    return { color: '🟢', texto: 'Aceptando citas', disponible: true };
  }
  
  return { color: '🟢', texto: 'Disponible ahora', disponible: true };
}
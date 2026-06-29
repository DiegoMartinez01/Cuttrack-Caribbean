import { create } from 'zustand';

export interface Cita {
  id: string;
  barberoId: number;
  barberoNombre: string;
  servicioId: number;
  servicioNombre: string;
  fecha: string;
  hora: string;
  precio: number;
  clienteNombre: string;
  estado: 'pendiente' | 'completada' | 'cancelada';
  createdAt: string;
}

interface CitasStore {
  citas: Cita[];
  agregarCita: (cita: Cita) => void;
  cancelarCita: (id: string) => void;
  completarCita: (id: string) => void;
  obtenerGananciasHoy: (barberoId: number) => number;
}

export const useCitasStore = create<CitasStore>((set, get) => ({
  citas: [],
  
  agregarCita: (cita) => {
    const nuevasCitas = [...get().citas, cita];
    set({ citas: nuevasCitas });
  },
  
  cancelarCita: (id) => {
    const citasActualizadas = get().citas.map((c) => 
      c.id === id ? { ...c, estado: 'cancelada' as const } : c
    );
    set({ citas: citasActualizadas });
  },
  
  completarCita: (id) => {
    const citasActualizadas = get().citas.map((c) => 
      c.id === id ? { ...c, estado: 'completada' as const } : c
    );
    set({ citas: citasActualizadas });
  },

    obtenerGananciasHoy: (barberoId) => {
    const hoy = new Date().toISOString().split('T')[0];
    const citasCompletadasHoy = get().citas.filter(
      (c) => c.barberoId === barberoId && c.fecha === hoy && c.estado === 'completada'
    );
    const total = citasCompletadasHoy.reduce((sum, c) => sum + c.precio, 0);
    return total;
  },
  
}));
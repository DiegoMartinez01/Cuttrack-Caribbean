// constants/businessDictionary.ts

// Textos originales (fallback por defecto)
export const textosOriginales = {
  // Entidades
  employeeSingular: 'Barbero',
  employeePlural: 'Barberos',
  serviceSingular: 'Servicio',
  servicePlural: 'Servicios',
  appointmentSingular: 'Cita',
  appointmentPlural: 'Citas',
  clientSingular: 'Cliente',
  clientPlural: 'Clientes',
  
  // Acciones
  actionBook: 'Agendar',
  actionCancel: 'Cancelar',
  actionRate: 'Calificar',
  
  // Estados
  statusCompleted: 'Completado',
  statusPending: 'Pendiente',
  statusCancelled: 'Cancelado',
  
  // Iconos
  iconEmployee: 'scissors',
  iconService: 'grid',
  iconAppointment: 'calendar',
  iconBusiness: 'scissors',
  
  // Frases comunes
  welcomeMessage: '¡Bienvenido a nuestra barbería!',
  noEmployees: 'No hay barberos disponibles',
  noServices: 'No hay servicios disponibles',
  selectEmployee: 'ELIGE TU BARBERO',
  selectService: 'ELIGE TU SERVICIO',
};

export const businessDictionary = {
  barberia: {
    ...textosOriginales,
  },
  
  gimnasio: {
    employeeSingular: 'Entrenador',
    employeePlural: 'Entrenadores',
    serviceSingular: 'Clase',
    servicePlural: 'Clases',
    appointmentSingular: 'Reserva',
    appointmentPlural: 'Reservas',
    clientSingular: 'Cliente',
    clientPlural: 'Clientes',
    
    actionBook: 'Reservar',
    actionCancel: 'Cancelar',
    actionRate: 'Calificar',
    
    statusCompleted: 'Realizada',
    statusPending: 'Pendiente',
    statusCancelled: 'Cancelada',
    
    iconEmployee: 'dumbbell',
    iconService: 'activity',
    iconAppointment: 'calendar',
    iconBusiness: 'dumbbell',
    
    welcomeMessage: '¡Bienvenido a nuestro gimnasio!',
    noEmployees: 'No hay entrenadores disponibles',
    noServices: 'No hay clases disponibles',
    selectEmployee: 'ELIGE TU ENTRENADOR',
    selectService: 'ELIGE TU CLASE',
  },
  
  lavadero: {
  employeeSingular: 'Lavador',
  employeePlural: 'Lavadores',
  serviceSingular: 'Lavada',
  servicePlural: 'Lavadas',
  appointmentSingular: 'Turno',
  appointmentPlural: 'Turnos',
  clientSingular: 'Cliente',
  clientPlural: 'Clientes',
  
  actionBook: 'Apartar',
  actionCancel: 'Cancelar',
  actionRate: 'Calificar',
  
  statusCompleted: 'Realizado',
  statusPending: 'Pendiente',
  statusCancelled: 'Cancelado',
  
  // 🔥 ICONOS CORREGIDOS - ELIMINAR 'car'
  iconEmployee: 'user',        // ← cambia 'car' por 'user'
  iconService: 'droplet',      // ← válido
  iconAppointment: 'calendar', // ← válido
  iconBusiness: 'home',        // ← cambia 'car' por 'home'
  
  welcomeMessage: '¡Bienvenido a nuestro lavadero!',
  noEmployees: 'No hay lavadores disponibles',
  noServices: 'No hay servicios disponibles',
  selectEmployee: 'ELIGE TU LAVADOR',
  selectService: 'ELIGE TU SERVICIO',
},
  
  spa: {
    employeeSingular: 'Terapeuta',
    employeePlural: 'Terapeutas',
    serviceSingular: 'Terapia',
    servicePlural: 'Terapias',
    appointmentSingular: 'Cita',
    appointmentPlural: 'Citas',
    clientSingular: 'Cliente',
    clientPlural: 'Clientes',
    
    actionBook: 'Agendar',
    actionCancel: 'Cancelar',
    actionRate: 'Calificar',
    
    statusCompleted: 'Completado',
    statusPending: 'Pendiente',
    statusCancelled: 'Cancelado',
    
    iconEmployee: 'spa',
    iconService: 'feather',
    iconAppointment: 'calendar',
    iconBusiness: 'spa',
    
    welcomeMessage: '¡Bienvenido a nuestro spa!',
    noEmployees: 'No hay terapeutas disponibles',
    noServices: 'No hay terapias disponibles',
    selectEmployee: 'ELIGE TU TERAPEUTA',
    selectService: 'ELIGE TU TERAPIA',
  },
  
  taller: {
    employeeSingular: 'Mecánico',
    employeePlural: 'Mecánicos',
    serviceSingular: 'Reparación',
    servicePlural: 'Reparaciones',
    appointmentSingular: 'Turno',
    appointmentPlural: 'Turnos',
    clientSingular: 'Cliente',
    clientPlural: 'Clientes',
    
    actionBook: 'Apartar',
    actionCancel: 'Cancelar',
    actionRate: 'Calificar',
    
    statusCompleted: 'Realizado',
    statusPending: 'Pendiente',
    statusCancelled: 'Cancelado',
    
    iconEmployee: 'wrench',
    iconService: 'settings',
    iconAppointment: 'calendar',
    iconBusiness: 'wrench',
    
    welcomeMessage: '¡Bienvenido a nuestro taller!',
    noEmployees: 'No hay mecánicos disponibles',
    noServices: 'No hay reparaciones disponibles',
    selectEmployee: 'ELIGE TU MECÁNICO',
    selectService: 'ELIGE TU REPARACIÓN',
  },
  
  salon: {
    employeeSingular: 'Estilista',
    employeePlural: 'Estilistas',
    serviceSingular: 'Tratamiento',
    servicePlural: 'Tratamientos',
    appointmentSingular: 'Cita',
    appointmentPlural: 'Citas',
    clientSingular: 'Cliente',
    clientPlural: 'Clientes',
    
    actionBook: 'Agendar',
    actionCancel: 'Cancelar',
    actionRate: 'Calificar',
    
    statusCompleted: 'Completado',
    statusPending: 'Pendiente',
    statusCancelled: 'Cancelado',
    
    iconEmployee: 'scissors',
    iconService: 'wind',
    iconAppointment: 'calendar',
    iconBusiness: 'scissors',
    
    welcomeMessage: '¡Bienvenido a nuestro salón!',
    noEmployees: 'No hay estilistas disponibles',
    noServices: 'No hay tratamientos disponibles',
    selectEmployee: 'ELIGE TU ESTILISTA',
    selectService: 'ELIGE TU TRATAMIENTO',
  },
};

export type BusinessType = keyof typeof businessDictionary;
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './client';
import { storage } from './storage';

// 🔥 CONFIGURACIÓN GLOBAL DE NOTIFICACIONES
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// 🔥 DICCIONARIO DE TIPOS DE NOTIFICACIONES
export const NOTIFICATION_TYPES = {
  APPOINTMENT_CONFIRMED: 'appointment_confirmed',
  APPOINTMENT_CANCELLED: 'appointment_cancelled',
  APPOINTMENT_REMINDER: 'appointment_reminder',
  APPOINTMENT_COMPLETED: 'appointment_completed',
  NEW_RATING: 'new_rating',
  NEW_CLIENT: 'new_client',
  PROMOTION: 'promotion',
  SYSTEM: 'system',
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

// 🔥 REGISTRAR DISPOSITIVO PARA NOTIFICACIONES
export async function registerForPushNotificationsAsync() {
  let token;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('❌ Permiso de notificaciones denegado');
      return null;
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('✅ Expo Push Token:', token);
      
      const userRol = await storage.getItem('user_rol');
      let userId = null;
      
      if (userRol === 'client') {
        userId = await storage.getItem('cliente_id');
      } else if (userRol === 'barber') {
        userId = await storage.getItem('barbero_id');
      } else if (userRol === 'owner') {
        userId = await storage.getItem('owner_id');
      }
      
      if (userId) {
        await supabase
          .from('users')
          .update({ push_token: token })
          .eq('id', userId);
      }
      
    } catch (error) {
      console.error('❌ Error obteniendo push token:', error);
    }
  } else {
    console.log('❌ No es un dispositivo físico');
  }

  // Configurar canales de Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('appointments', {
      name: 'Citas',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
    
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 500, 500],
      lightColor: '#FFD700',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    
    await Notifications.setNotificationChannelAsync('ratings', {
      name: 'Calificaciones',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#9B59B6',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    
    await Notifications.setNotificationChannelAsync('system', {
      name: 'Sistema',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFFFFF',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  return token;
}

// 🔥 FUNCIÓN AUXILIAR: Canal según tipo
function getChannelId(type: string): string {
  switch (type) {
    case NOTIFICATION_TYPES.APPOINTMENT_CONFIRMED:
    case NOTIFICATION_TYPES.APPOINTMENT_CANCELLED:
    case NOTIFICATION_TYPES.APPOINTMENT_COMPLETED:
      return 'appointments';
    case NOTIFICATION_TYPES.APPOINTMENT_REMINDER:
      return 'reminders';
    case NOTIFICATION_TYPES.NEW_RATING:
      return 'ratings';
    default:
      return 'system';
  }
}

// 🔥 ENVIAR NOTIFICACIÓN INMEDIATA
export async function sendNotification(
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  const typeKey = NOTIFICATION_TYPES[type];
  
  try {
    const content: any = {
      title,
      body,
      data: { type: typeKey, ...data },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      android: {
        channelId: getChannelId(typeKey),
        priority: 'high',
      },
      ios: {
        sound: 'default',
      },
    };

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: null,
    });
    console.log('📱 Notificación enviada:', title);
  } catch (error) {
    console.error('❌ Error enviando notificación:', error);
  }
}

// 🔥 PROGRAMAR NOTIFICACIÓN PARA MÁS TARDE
export async function scheduleNotification(
  type: NotificationType,
  title: string,
  body: string,
  triggerDate: Date,
  data?: Record<string, any>
) {
  const typeKey = NOTIFICATION_TYPES[type];
  
  try {
    const content: any = {
      title,
      body,
      data: { type: typeKey, ...data },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      android: {
        channelId: getChannelId(typeKey),
        priority: 'high',
      },
      ios: {
        sound: 'default',
      },
    };

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        date: triggerDate,
        channelId: getChannelId(typeKey),
      },
    });
    console.log(`📅 Notificación programada para: ${triggerDate.toLocaleString()}`);
  } catch (error) {
    console.error('❌ Error programando notificación:', error);
  }
}

// 🔥 FUNCIÓN AUXILIAR: Formatear hora
function formatTime(dateTime: string) {
  const date = new Date(dateTime);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 🔥 PROGRAMAR RECORDATORIO DE CITA (2 HORAS ANTES)
export async function scheduleAppointmentReminder(
  appointmentId: string,
  clientName: string,
  barberName: string,
  serviceName: string,
  dateTime: string
) {
  const citaDate = new Date(dateTime);
  const reminderDate = new Date(citaDate.getTime() - 2 * 60 * 60 * 1000);
  
  if (reminderDate.getTime() < Date.now()) {
    console.log('⏰ La cita es muy pronto, no se programa recordatorio');
    return;
  }

  await scheduleNotification(
    'APPOINTMENT_REMINDER',
    `⏰ Recordatorio: ${serviceName}`,
    `${clientName}, tienes una cita con ${barberName} a las ${formatTime(dateTime)}`,
    reminderDate,
    { appointmentId }
  );
}

// 🔥 CANCELAR TODAS LAS NOTIFICACIONES PROGRAMADAS
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('🗑️ Todas las notificaciones canceladas');
}

// 🔥 CANCELAR NOTIFICACIONES DE UNA CITA ESPECÍFICA
export async function cancelAppointmentNotifications(appointmentId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter(n => 
    n.content.data?.appointmentId === appointmentId
  );
  
  for (const notification of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  }
  
  console.log(`🗑️ ${toCancel.length} notificaciones canceladas para cita ${appointmentId}`);
}
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { 
  registerForPushNotificationsAsync, 
  sendNotification, 
  scheduleAppointmentReminder,
  cancelAllNotifications,
  cancelAppointmentNotifications,
  NOTIFICATION_TYPES 
} from '../../services/supabase/notificationService';

export function useNotifications() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    const setup = async () => {
      const token = await registerForPushNotificationsAsync();
      setPushToken(token ?? null);
      setPermissionGranted(!!token);
    };
    setup();
  }, []);

  const notify = (
    type: keyof typeof NOTIFICATION_TYPES,
    title: string,
    body: string,
    data?: Record<string, any>
  ) => {
    return sendNotification(
      NOTIFICATION_TYPES[type] as Parameters<typeof sendNotification>[0],
      title,
      body,
      data
    );
  };

  const scheduleReminder = (
    appointmentId: string,
    clientName: string,
    barberName: string,
    serviceName: string,
    dateTime: string
  ) => {
    return scheduleAppointmentReminder(appointmentId, clientName, barberName, serviceName, dateTime);
  };

  const cancelAll = () => cancelAllNotifications();
  const cancelByAppointment = (appointmentId: string) => cancelAppointmentNotifications(appointmentId);

  return {
    permissionGranted,
    pushToken,
    notify,
    scheduleReminder,
    cancelAll,
    cancelByAppointment,
  };
}
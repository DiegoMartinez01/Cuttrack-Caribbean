// hooks/useBusinessDictionary.ts

import { useEffect, useState } from 'react';
import { businessDictionary, BusinessType, textosOriginales } from '../../constants/businessDictionary';
import { supabase } from '../../services/supabase/client';
import { storage } from '../../services/supabase/storage';

export const useBusinessDictionary = () => {
  const [businessType, setBusinessType] = useState<BusinessType>('barberia');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);

  useEffect(() => {
    cargarBusinessType();
  }, []);

  const cargarBusinessType = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setBusinessType('barberia');
        setLoading(false);
        return;
      }

      const cached = await storage.getItem('business_type');
      if (cached && businessDictionary[cached as BusinessType]) {
        setBusinessType(cached as BusinessType);
        setLoading(false);
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('rol, barbershop_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (userError || !user) {
        setBusinessType('barberia');
        setLoading(false);
        return;
      }

      let shopId: string | null = null;

      if (user?.rol === 'client') {
        const { data: client } = await supabase
          .from('clients')
          .select('barbershop_id')
          .eq('id', userData.user.id)
          .maybeSingle();
        shopId = client?.barbershop_id;
      } else {
        shopId = user?.barbershop_id;
      }

      if (!shopId) {
        setBusinessType('barberia');
        setLoading(false);
        return;
      }

      setBarbershopId(shopId);

      const { data: barbershop } = await supabase
        .from('barbershops')
        .select('business_type')
        .eq('id', shopId)
        .maybeSingle();

      let tipo = barbershop?.business_type;
      if (!tipo || !businessDictionary[tipo as BusinessType]) {
        tipo = 'barberia';
      }

      setBusinessType(tipo as BusinessType);
      await storage.setItem('business_type', tipo);

    } catch (err) {
      console.error('Error cargando tipo de negocio:', err);
      setError(true);
      setBusinessType('barberia');
    } finally {
      setLoading(false);
    }
  };

  const dict = businessDictionary[businessType];
  const original = textosOriginales;

  const t = (key: keyof typeof dict): string => {
    return dict?.[key] ?? original?.[key] ?? 'Barbero';
  };

  const getIcon = (iconKey: 'employee' | 'service' | 'appointment' | 'business'): string => {
    const iconMap = {
      employee: dict.iconEmployee,
      service: dict.iconService,
      appointment: dict.iconAppointment,
      business: dict.iconBusiness,
    };
    return iconMap[iconKey] || 'user';
  };

  return {
    loading,
    error,
    businessType,
    barbershopId,
    t,
    getIcon,
    
    // Entidades (YA EXISTEN)
    employeeName: t('employeeSingular'),
    employeePlural: t('employeePlural'),
    serviceName: t('serviceSingular'),
    servicePlural: t('servicePlural'),
    appointmentName: t('appointmentSingular'),
    appointmentPlural: t('appointmentPlural'),
    
    // 🔥 ACCIONES - AGREGAR ESTAS 3
    actionBook: t('actionBook'),
    actionCancel: t('actionCancel'),
    actionRate: t('actionRate'),
    
    // 🔥 ESTADOS - AGREGAR statusCancelled
    statusCompleted: t('statusCompleted'),
    statusPending: t('statusPending'),
    statusCancelled: t('statusCancelled'), // 🔥 NUEVA
    
    // Mensajes (YA EXISTEN)
    welcomeMessage: t('welcomeMessage'),
    noEmployees: t('noEmployees'),
    noServices: t('noServices'),
    selectEmployee: t('selectEmployee'),
    selectService: t('selectService'),
  };
};
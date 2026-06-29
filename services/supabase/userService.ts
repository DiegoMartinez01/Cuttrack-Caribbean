import { supabase } from './client';

export interface UserSession {
  id: string;
  email: string;
  nombre: string;
  rol: 'owner' | 'barber' | 'client';
  barbershop_id: string;
}

export const userService = {
  // Obtener el usuario actual completo
  async getCurrentUser(): Promise<UserSession | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('id, email, nombre, rol, barbershop_id')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      console.error('Error obteniendo usuario:', error);
      return null;
    }

    return data as UserSession;
  },

  // Obtener solo el barbershop_id
  async getBarbershopId(): Promise<string | null> {
    const user = await this.getCurrentUser();
    return user?.barbershop_id || null;
  },

  // Obtener el ID del barbero (si el rol es barber)
  async getBarberId(): Promise<string | null> {
    const user = await this.getCurrentUser();
    if (user?.rol !== 'barber') return null;
    
    const { data } = await supabase
      .from('barbers')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    return data?.id || null;
  },

  // Obtener el ID del cliente (si el rol es client)
  async getClientId(): Promise<string | null> {
    const user = await this.getCurrentUser();
    if (user?.rol !== 'client') return null;
    
    const { data } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    return data?.id || null;
  },
};
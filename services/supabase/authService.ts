import { supabase } from './client';

export interface RegisterClientData {
  email: string;
  password: string;
  nombre: string;
  telefono: string;
  codigo_barberia: string;
}

export interface RegisterOwnerData {
  email: string;
  password: string;
  nombre_barberia: string;
  telefono?: string;
  direccion?: string;
}

function generarCodigoUnico(): string {
  return 'CUT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const authService = {
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async registerClient(clientData: RegisterClientData) {
    // 1. Buscar barbería por código único
    const { data: barbershop, error: barbershopError } = await supabase
      .from('barbershops')
      .select('id')
      .eq('codigo_unico', clientData.codigo_barberia)
      .single();

    if (barbershopError || !barbershop) {
      throw new Error('Código de barbería inválido');
    }

    // 2. Crear usuario en Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: clientData.email,
      password: clientData.password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Error al crear usuario');

    // 3. Crear registro en tabla users
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: clientData.email,
      nombre: clientData.nombre,
      rol: 'client',
      barbershop_id: barbershop.id,
    });

    if (userError) throw userError;

    // 4. Crear registro en tabla clients (con teléfono)
    const { error: clientError } = await supabase.from('clients').insert({
      id: authData.user.id,
      barbershop_id: barbershop.id,
      nombre: clientData.nombre,
      email: clientData.email,
      telefono: clientData.telefono,
    });

    if (clientError) throw clientError;

    return authData;
  },

  async registerOwner(ownerData: RegisterOwnerData) {
    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: ownerData.email,
      password: ownerData.password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Error al crear usuario');

    // 2. Crear barbería
    const { data: barbershop, error: barbershopError } = await supabase
      .from('barbershops')
      .insert({
        nombre: ownerData.nombre_barberia,
        email: ownerData.email,
        telefono: ownerData.telefono ?? null,
        direccion: ownerData.direccion ?? null,
        codigo_unico: generarCodigoUnico(),
        activo: true,
      })
      .select()
      .single();

    if (barbershopError) throw barbershopError;

    // 3. Crear usuario con rol owner
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: ownerData.email,
      nombre: ownerData.nombre_barberia,
      rol: 'owner',
      barbershop_id: barbershop.id,
    });

    if (userError) throw userError;

    return authData;
  },

  async validarLicencia(codigo: string): Promise<{ valida: boolean; errorMessage?: string }> {
    const { data: licencia, error } = await supabase
      .from('licencias')
      .select('codigo, usado')
      .eq('codigo', codigo)
      .single();

    if (error || !licencia) {
      return { valida: false, errorMessage: 'Código de licencia inválido' };
    }

    if (licencia.usado) {
      return { valida: false, errorMessage: 'Esta licencia ya fue utilizada' };
    }

    return { valida: true };
  },
};

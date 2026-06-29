// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { barberoId, email, nombre, periodo } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: citas } = await supabase
      .from('appointments')
      .select('*, clients(nombre), services(nombre)')
      .eq('barbero_id', barberoId)
      .eq('estado', 'completada')
      .gte('fecha_hora', `${periodo.inicio}T00:00:00`)
      .lte('fecha_hora', `${periodo.fin}T23:59:59`);

    const total = citas?.reduce((sum, c) => sum + (c?.total || 0), 0) || 0;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif;">
        <h1 style="color: #FF6B35;">📊 Resumen de Ganancias</h1>
        <p><strong>Barbero:</strong> ${nombre}</p>
        <p><strong>Período:</strong> ${periodo.inicio} al ${periodo.fin}</p>
        <p><strong>Total de citas:</strong> ${citas?.length || 0}</p>
        <p><strong>Total ganado:</strong> $${total.toLocaleString('es-CO')}</p>
        <h3>Detalle de citas:</h3>
        <table border="1" cellpadding="8" style="border-collapse: collapse;">
          <tr style="background: #FF6B35; color: white;">
            <th>Fecha</th><th>Cliente</th><th>Servicio</th><th>Valor</th>
          </tr>
          ${citas?.map(c => `
            <tr>
              <td>${new Date(c.fecha_hora).toLocaleDateString('es-CO')}</td>
              <td>${c.clients?.nombre || 'Cliente'}</td>
              <td>${c.services?.nombre || 'Servicio'}</td>
              <td>$${c.total?.toLocaleString('es-CO') || '0'}</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CUTTRACK <resumen@cuttrack.com>',
        to: email,
        subject: `📊 Resumen de ganancias - ${periodo.inicio} al ${periodo.fin}`,
        html: html,
      }),
    });

    const result = await res.json();
    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
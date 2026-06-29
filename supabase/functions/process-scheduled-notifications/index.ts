import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

serve(async () => {
  const supabaseClient = createClient(
    Deno.env.get('https://fvvlzfnnnhxbilmxbuum.supabase.co) ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const now = new Date().toISOString()
  const { data: notifications, error } = await supabaseClient
    .from('scheduled_notifications')
    .select('*')
    .eq('sent', false)
    .lte('scheduled_for', now)
    .limit(50)

  if (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }

  if (!notifications || notifications.length === 0) {
    return new Response(
      JSON.stringify({ success: true, message: 'No hay notificaciones pendientes' }),
      { status: 200 }
    )
  }

  let enviadas = 0
  for (const notif of notifications) {
    try {
      const { data: user } = await supabaseClient
        .from('users')
        .select('push_token')
        .eq('id', notif.user_id)
        .single()

      if (!user?.push_token) {
        await supabaseClient
          .from('scheduled_notifications')
          .update({ sent: true })
          .eq('id', notif.id)
        continue
      }

      const message = {
        to: user.push_token,
        sound: 'default',
        title: notif.title,
        body: notif.body,
        data: notif.data || {},
        priority: 'high',
      }

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })

      await supabaseClient
        .from('scheduled_notifications')
        .update({ sent: true })
        .eq('id', notif.id)

      enviadas++

    } catch (error) {
      console.error('Error en notificación:', error)
    }
  }

  return new Response(
    JSON.stringify({ success: true, processed: enviadas }),
    { status: 200 }
  )
})
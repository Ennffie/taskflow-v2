import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AttendanceRecord = {
  id: string;
  user_id: string;
  date: string;
  status: 'present' | 'al' | 'sl' | 'bl' | 'other';
  check_in_at: string | null;
  note: string | null;
};

function hkTimeLabel(iso: string | null) {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh}:${mm}`;
}

function isLate(iso: string | null) {
  const label = hkTimeLabel(iso);
  if (!label) return false;
  const [h, m] = label.split(':').map(Number);
  return h * 60 + m > 9 * 60 + 30;
}

function formatMessage(name: string, kind: 'status' | 'note', record: AttendanceRecord) {
  if (kind === 'note') {
    return `${name} 更新 note：${record.note || '—'}`;
  }

  if (record.status === 'present') {
    const time = hkTimeLabel(record.check_in_at) ?? '--:--';
    const late = isLate(record.check_in_at);
    const extras = [late ? 'Late' : null, record.note ? `note: ${record.note}` : null].filter(Boolean).join('｜');
    return extras ? `${name} ${time} 已簽到｜${extras}` : `${name} ${time} 已簽到`;
  }

  const statusLabel = record.status === 'other' ? 'Other' : record.status.toUpperCase();
  return record.note ? `${name} 今日 ${statusLabel}｜note: ${record.note}` : `${name} 今日 ${statusLabel}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('ATTENDANCE_NOTIFY_CHAT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!botToken || !chatId || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing secrets' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { kind, record } = await req.json() as { kind: 'status' | 'note'; record: AttendanceRecord };
    if (!record?.user_id || !record?.status || !kind) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await admin.from('profiles').select('name, email').eq('id', record.user_id).maybeSingle();
    const name = profile?.name || profile?.email || 'Someone';
    const text = formatMessage(name, kind, record);

    const telegramResp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    const telegramData = await telegramResp.json();
    if (!telegramResp.ok || !telegramData?.ok) {
      return new Response(JSON.stringify({ error: 'Telegram send failed', detail: telegramData }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

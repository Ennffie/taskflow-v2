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

type AttendanceNotifyPayload = {
  kind: 'status' | 'note' | 'clear' | 'time_edit';
  record: AttendanceRecord;
  previous?: Pick<AttendanceRecord, 'status' | 'note' | 'check_in_at'> | null;
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

function getLeaveLabel(status: AttendanceRecord['status']) {
  if (status === 'al') return '年假';
  if (status === 'sl') return '病假';
  if (status === 'bl') return '生日假';
  if (status === 'other') return '其他假';
  return '簽到';
}

function formatMessage(params: {
  actorName: string;
  targetName: string;
  kind: AttendanceNotifyPayload['kind'];
  record: AttendanceRecord;
  previous?: Pick<AttendanceRecord, 'status' | 'note' | 'check_in_at'> | null;
}) {
  const { actorName, targetName, kind, record, previous } = params;
  if (kind === 'clear') {
    return `${targetName} 已取消今日${getLeaveLabel(record.status)}`;
  }

  if (kind === 'note') {
    return `${targetName} 更新 note：${record.note || '—'}`;
  }

  if (kind === 'time_edit') {
    const before = hkTimeLabel(previous?.check_in_at ?? null) ?? '--:--';
    const after = hkTimeLabel(record.check_in_at) ?? '--:--';
    return `⚠️ ${targetName} 改咗打咭時間\n日期：${record.date}\n原本：${before}\n現在：${after}\n操作者：${actorName}`;
  }

  if (record.status === 'present') {
    const time = hkTimeLabel(record.check_in_at) ?? '--:--';
    const late = isLate(record.check_in_at);
    const extras = [late ? 'Late' : null, record.note ? `note: ${record.note}` : null].filter(Boolean).join('｜');
    return extras ? `${targetName} ${time} 已簽到｜${extras}` : `${targetName} ${time} 已簽到`;
  }

  const statusLabel = getLeaveLabel(record.status);
  return record.note ? `${targetName} 今日${statusLabel}｜note: ${record.note}` : `${targetName} 今日${statusLabel}`;
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

    const payload = await req.json() as AttendanceNotifyPayload;
    const { kind, record, previous } = payload;
    if (!record?.user_id || !record?.status || !kind) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get('Authorization') ?? '';
    const actorClient = createClient(supabaseUrl, serviceRoleKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const { data: actorData } = await actorClient.auth.getUser();
    const actorId = actorData.user?.id ?? null;

    const [{ data: targetProfile }, { data: actorProfile }] = await Promise.all([
      admin.from('profiles').select('name, email, role').eq('id', record.user_id).maybeSingle(),
      actorId
        ? admin.from('profiles').select('name, email, role').eq('id', actorId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const actorName = actorProfile?.name || actorProfile?.email || 'Someone';
    const actorRole = actorProfile?.role || null;
    const targetName = targetProfile?.name || targetProfile?.email || 'Someone';

    if (kind === 'time_edit' && actorRole === 'admin') {
      return new Response(JSON.stringify({ ok: true, skipped: 'admin_time_edit' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const text = formatMessage({ actorName, targetName, kind, record, previous });

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

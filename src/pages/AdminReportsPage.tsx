import { useEffect, useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface DailyLogEntry {
  task_title: string;
  user_name: string;
  today_update: string | null;
  next_day_focus: string | null;
  updated_at: string;
}

export function AdminReportsPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DailyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadLogs();
  }, [filterDate]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('title, today_update, next_day_focus, updated_at, assignees:task_assignees(profile:profiles(name))')
        .or('today_update.not.is.null,next_day_focus.not.is.null')
        .gte('updated_at', filterDate + 'T00:00:00')
        .lte('updated_at', filterDate + 'T23:59:59');
      
      if (error) throw error;
      
      const formatted = (data || []).map((t: any) => ({
        task_title: t.title,
        user_name: t.assignees?.[0]?.profile?.name || 'Unknown',
        today_update: t.today_update,
        next_day_focus: t.next_day_focus,
        updated_at: t.updated_at,
      }));
      
      setLogs(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    const headers = ['Task', 'User', 'Today Update', 'Next Day Focus', 'Updated At'];
    const rows = logs.map(l => [
      l.task_title,
      l.user_name,
      l.today_update || '',
      l.next_day_focus || '',
      l.updated_at,
    ]);
    const csv = [headers, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-logs-${filterDate}.csv`;
    a.click();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '20px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate('/canton-mode')} style={{ background: 'none', border: 'none', padding: 8 }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Admin - Daily Logs</h1>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <input 
              type="date" 
              value={filterDate} 
              onChange={(e) => setFilterDate(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 16 }}
            />
            <button 
              onClick={downloadCSV}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15 }}
            >
              <Download size={18} /> 下載 CSV
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>加載中...</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>今日暫時冇 Daily Log 記錄</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {logs.map((log, i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{log.task_title}</div>
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>👤 {log.user_name} · {new Date(log.updated_at).toLocaleString('zh-HK')}</div>
                  {log.today_update && (
                    <div style={{ background: '#dbeafe', borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 14 }}>
                      <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>今日做咗乜</div>
                      <div>{log.today_update}</div>
                    </div>
                  )}
                  {log.next_day_focus && (
                    <div style={{ background: '#dcfce7', borderRadius: 8, padding: '10px 12px', fontSize: 14 }}>
                      <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 4 }}>明天要做乜</div>
                      <div>{log.next_day_focus}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

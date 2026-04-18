import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { fetchMyLogs } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/date';
import type { LogEntry } from '../types';
import { panelStyle } from './TaskListPage';

export function MyLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyLogs().then(setLogs).catch((error) => alert(`Load my logs failed: ${error.message}`)).finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: '18px' }}>
        <section style={panelStyle}>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#111827' }}>My logs</div>
          <p style={{ fontSize: '15px', color: '#6b7280', lineHeight: 1.7, marginTop: '10px' }}>A clean list of updates you have posted across the workspace.</p>
        </section>
        <section style={{ display: 'grid', gap: '14px' }}>
          {loading ? <div style={panelStyle}>Loading...</div> : logs.length === 0 ? <div style={panelStyle}>No log entries yet.</div> : logs.map((log) => (
            <article key={log.id} style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }} className="task-card-head">
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#7c3aed' }}>{log.category} • {formatDate(log.date)}</div>
                  <div style={{ fontSize: '15px', color: '#111827', marginTop: '10px', lineHeight: 1.7 }}>{log.event}</div>
                </div>
                <div style={{ textAlign: 'right', color: '#6b7280', fontSize: '13px' }}>{formatDateTime(log.created_at)}</div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

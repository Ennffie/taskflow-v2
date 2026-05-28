import { useEffect, useState } from 'react';
import { History, RotateCcw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { BackButton } from '../components/BackButton';
import { deleteImportSnapshot, fetchImportSnapshots } from '../lib/api';
import type { ImportSnapshot } from '../types';

function formatDateTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getRemainingDays(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function ImportHistoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<ImportSnapshot[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      setSnapshots(await fetchImportSnapshots('crce_tracker'));
    } catch (error: any) {
      alert(`Load import history failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshots();
  }, []);

  const handleRestore = (snapshot: ImportSnapshot) => {
    navigate('/import-review', {
      state: {
        importData: snapshot.payload,
        importMeta: {
          sourceLabel: snapshot.source_label,
          restoredFromSnapshotId: snapshot.id,
        },
      },
    });
  };

  const handleDelete = async (snapshot: ImportSnapshot) => {
    const confirmed = window.confirm(`Delete snapshot "${snapshot.source_label}"?`);
    if (!confirmed) return;

    setBusyId(snapshot.id);
    try {
      await deleteImportSnapshot(snapshot.id);
      setSnapshots((current) => current.filter((item) => item.id !== snapshot.id));
    } catch (error: any) {
      alert(`Delete snapshot failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: '960px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <BackButton onClick={() => navigate('/all-tasks')} style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '10px 16px' }} />
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 }}>Import History</h1>
            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '6px' }}>CRCE snapshots are kept for 14 days, then auto-cleaned.</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            Loading import history...
          </div>
        ) : snapshots.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <History size={24} style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>No snapshot yet</div>
            <div style={{ fontSize: '14px' }}>Run one CRCE import first.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>{snapshot.source_label}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                      Imported {formatDateTime(snapshot.created_at)} · {snapshot.row_count} rows · {getRemainingDays(snapshot.expires_at)} day(s) left
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Expires {formatDateTime(snapshot.expires_at)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleRestore(snapshot)}
                      disabled={busyId === snapshot.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '10px', padding: '10px 14px', background: '#111827', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <RotateCcw size={14} />
                      Restore
                    </button>
                    <button
                      onClick={() => handleDelete(snapshot)}
                      disabled={busyId === snapshot.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', background: '#fff', color: '#b91c1c', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

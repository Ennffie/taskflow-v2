import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { fetchProfiles } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Profile, Role } from '../types';
import { panelStyle } from './TaskListPage';

export function SettingsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      setProfiles(await fetchProfiles());
    } catch (error: any) {
      alert(`Load users failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProfiles(); }, []);

  const updateRole = async (id: string, role: Role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) {
      alert(`Update role failed: ${error.message}`);
      return;
    }
    await loadProfiles();
  };

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: '18px' }}>
        <section style={panelStyle}>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#111827' }}>Settings</div>
          <p style={{ fontSize: '15px', color: '#6b7280', lineHeight: 1.7, marginTop: '10px' }}>Keep access simple in v1. Only role changes live here for now.</p>
        </section>
        <section style={{ ...panelStyle, padding: '12px' }}>
          {loading ? <div style={{ padding: '24px' }}>Loading users...</div> : profiles.map((profile) => (
            <div key={profile.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '16px', alignItems: 'center', padding: '18px 16px', borderBottom: '1px solid #f3f4f6' }} className="settings-row">
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{profile.name}</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{profile.email}</div>
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Current role: <strong style={{ color: '#111827' }}>{profile.role}</strong></div>
              <select value={profile.role} onChange={(e) => updateRole(profile.id, e.target.value as Role)} style={{ borderRadius: '16px', border: '1px solid #e5e7eb', background: '#fff', padding: '12px 14px', fontWeight: 700 }}>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

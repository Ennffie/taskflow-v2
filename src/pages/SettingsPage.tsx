import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { fetchProfiles, inviteMember } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Profile, Role } from '../types';
import { panelStyle } from './TaskListPage';
import { FileSpreadsheet, FolderKanban, ScrollText, Users } from 'lucide-react';

export function SettingsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { signOut, profile: currentProfile } = useAuth();

  // Invite form state
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; tempPassword: string } | null>(null);

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

  // Check if current user is admin
  useEffect(() => {
    if (currentProfile) {
      setIsAdmin(currentProfile.role === 'admin');
    }
  }, [currentProfile]);

  const updateRole = async (id: string, role: Role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) {
      alert(`Update role failed: ${error.message}`);
      return;
    }
    await loadProfiles();
  };

  // Generate random temporary password
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      alert('Please fill in all fields');
      return;
    }

    setInviteLoading(true);
    setInviteResult(null);

    try {
      const tempPassword = generateTempPassword();
      await inviteMember({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        tempPassword,
      });

      setInviteResult({ email: inviteEmail.trim(), tempPassword });
      setInviteName('');
      setInviteEmail('');
      setInviteRole('member');
      await loadProfiles(); // Refresh the users list
    } catch (error: any) {
      alert(`Invite failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setInviteLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: '18px' }}>
        <section style={panelStyle}>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#111827' }}>Settings</div>
          <p style={{ fontSize: '15px', color: '#6b7280', lineHeight: 1.7, marginTop: '10px' }}>Keep access simple in v1. Only role changes live here for now.</p>
        </section>

        {isAdmin && (
          <section style={panelStyle}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '14px' }}>Trackers</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <TrackerLink to="/tracker/member" title="Tracker by Member" desc="People management view" icon={<Users size={20} color="#7c3aed" />} />
              <TrackerLink to="/tracker/task" title="Tracker by Task" desc="Main task group view" icon={<FolderKanban size={20} color="#7c3aed" />} />
              <TrackerLink to="/review-export" title="Final Review" desc="Warnings + final cleanup" icon={<FileSpreadsheet size={20} color="#7c3aed" />} />
              <TrackerLink to="/team-logs" title="Raw Logs" desc="Admin log history + export" icon={<ScrollText size={20} color="#7c3aed" />} />
            </div>
          </section>
        )}
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
        
        {/* Invite Member Section - Only visible to Admin */}
        {isAdmin && (
          <section style={panelStyle}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Invite Member</div>
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, marginBottom: '16px' }}>Create a new user account and share the temporary password with them.</p>

            {inviteResult && (
              <div style={{ 
                background: '#ecfdf5', 
                border: '1px solid #10b981', 
                borderRadius: '12px', 
                padding: '16px', 
                marginBottom: '20px',
              }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#047857', marginBottom: '12px' }}>✓ Member invited successfully!</div>
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>
                  <strong>Email:</strong> {inviteResult.email}
                </div>
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>Temporary Password:</strong> 
                  <code style={{ background: '#fff', padding: '4px 8px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px' }}>{inviteResult.tempPassword}</code>
                  <button 
                    onClick={() => copyToClipboard(inviteResult.tempPassword)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #10b981',
                      background: '#fff',
                      color: '#047857',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Copy
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Share this password with the new member. They can login and change their password.</div>
              </div>
            )}

            <form onSubmit={handleInvite}>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Enter member's name"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter member's email"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      fontSize: '14px',
                      background: '#fff',
                      outline: 'none',
                    }}
                  >
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={inviteLoading}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#111827',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: inviteLoading ? 'not-allowed' : 'pointer',
                    opacity: inviteLoading ? 0.6 : 1,
                    marginTop: '8px',
                  }}
                >
                  {inviteLoading ? 'Creating...' : 'Invite Member'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Logout Section */}
        <section style={{ ...panelStyle, padding: '20px', textAlign: 'center' }}>
          <button 
            onClick={signOut}
            style={{ 
              padding: '12px 24px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#ef4444',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            Logout
          </button>
        </section>
      </div>
    </AppShell>
  );
}

function TrackerLink({ to, title, desc, icon }: { to: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 18px', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          {icon}
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>{title}</div>
        </div>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>{desc}</div>
      </div>
    </Link>
  );
}

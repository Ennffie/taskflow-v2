import { CheckSquare, LogOut, ScrollText, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ff' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }} className="app-shell-grid">
          <aside style={{ background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: '28px', padding: '24px', boxShadow: '0 18px 50px rgba(88,28,135,0.08)', backdropFilter: 'blur(18px)', alignSelf: 'start', position: 'sticky', top: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '18px', background: 'linear-gradient(135deg, #7c3aed, #111827)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>TF</div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>TaskFlow v2</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>PMC task tracker</div>
              </div>
            </div>

            <nav style={{ display: 'grid', gap: '10px' }}>
              <SidebarLink to="/" icon={<CheckSquare size={18} />} label="Tasks" />
              <SidebarLink to="/my-log" icon={<ScrollText size={18} />} label="My Log" />
              {profile?.role === 'admin' && <SidebarLink to="/settings" icon={<Settings size={18} />} label="Settings" />}
            </nav>

            <div style={{ marginTop: '32px', padding: '18px', background: '#faf5ff', borderRadius: '22px', border: '1px solid #ede9fe' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', marginBottom: '6px' }}>Signed in</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{profile?.name || 'Loading...'}</div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{profile?.email}</div>
              <button onClick={signOut} style={{ marginTop: '16px', width: '100%', borderRadius: '18px', padding: '14px 16px', background: '#111827', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </aside>

          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 18px',
        borderRadius: '20px',
        textDecoration: 'none',
        background: isActive ? '#111827' : 'transparent',
        color: isActive ? '#fff' : '#4b5563',
        fontWeight: 600,
      })}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

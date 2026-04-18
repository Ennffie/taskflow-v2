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

            {/* Simplified user section */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{profile?.name || 'User'}</div>
              <button onClick={signOut} style={{ padding: '6px 10px', borderRadius: '8px', background: 'transparent', color: '#6b7280', border: 'none', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Sign out">
                <LogOut size={14} />
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

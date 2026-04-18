import { CheckSquare, LogOut, ScrollText, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: '100vh' }} className="app-shell-grid">
        <aside style={{ background: '#fff', borderRight: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#111827', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '14px' }}>TF</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>TaskFlow</div>
          </div>

          <nav style={{ display: 'grid', gap: '4px' }}>
            <SidebarLink to="/" icon={<CheckSquare size={16} />} label="Tasks" />
            <SidebarLink to="/my-log" icon={<ScrollText size={16} />} label="My Log" />
            {profile?.role === 'admin' && <SidebarLink to="/settings" icon={<Settings size={16} />} label="Settings" />}
          </nav>

          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>{profile?.name || 'User'}</div>
            <button onClick={signOut} style={{ padding: '6px', borderRadius: '6px', background: 'transparent', color: '#64748b', border: 'none', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        </aside>

        <main style={{ padding: '24px 32px' }}>{children}</main>
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
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '8px',
        textDecoration: 'none',
        background: isActive ? '#111827' : 'transparent',
        color: isActive ? '#fff' : '#64748b',
        fontWeight: 500,
        fontSize: '14px',
      })}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

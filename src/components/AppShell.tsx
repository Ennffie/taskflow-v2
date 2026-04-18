import { CheckSquare, ScrollText, Settings, Home, LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '90px' }}>
      {/* Main Content */}
      <main style={{ padding: '24px' }}>{children}</main>

      {/* Bottom Menu Bar */}
      <nav 
        style={{ 
          position: 'fixed', 
          bottom: '16px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          display: 'flex', 
          alignItems: 'center',
          gap: '4px',
          background: '#fff', 
          borderRadius: '50px', 
          padding: '8px 12px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          zIndex: 100,
        }}
      >
        <BottomNavLink to="/" icon={<Home size={22} />} label="All" />
        <BottomNavLink to="/my-tasks" icon={<CheckSquare size={22} />} label="My Tasks" />
        <BottomNavLink to="/my-log" icon={<ScrollText size={22} />} label="My Log" />
        
        {profile?.role === 'admin' && (
          <BottomNavLink to="/settings" icon={<Settings size={22} />} label="Settings" />
        )}
        
        {/* Divider */}
        <div style={{ width: '1px', height: '32px', background: '#e2e8f0', margin: '0 4px' }} />
        
        {/* Logout */}
        <button 
          onClick={signOut}
          style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            gap: '4px',
            padding: '10px 16px',
            borderRadius: '40px',
            border: 'none',
            background: '#f1f5f9',
            color: '#64748b',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            minWidth: '60px',
          }}
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </nav>
    </div>
  );
}

function BottomNavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => ({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '10px 16px',
        borderRadius: '40px',
        textDecoration: 'none',
        background: isActive ? '#1e293b' : 'transparent',
        color: isActive ? '#fff' : '#64748b',
        fontWeight: isActive ? 600 : 500,
        fontSize: '11px',
        transition: 'all 0.2s ease',
        minWidth: '64px',
      })}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

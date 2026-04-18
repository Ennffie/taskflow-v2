import { CheckSquare, ScrollText, Settings, Home, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '80px' }}>
      {/* Main Content */}
      <main style={{ padding: '24px 32px' }}>{children}</main>

      {/* Bottom Menu Bar */}
      <nav 
        style={{ 
          position: 'fixed', 
          bottom: '20px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          display: 'flex', 
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.95)', 
          backdropFilter: 'blur(10px)',
          borderRadius: '50px', 
          padding: '8px 16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          zIndex: 100,
        }}
      >
        <BottomNavLink to="/" icon={<Home size={20} />} label="Home" />
        <BottomNavLink to="/tasks" icon={<CheckSquare size={20} />} label="Tasks" />
        <BottomNavLink to="/my-log" icon={<ScrollText size={20} />} label="My Log" />
        {profile?.role === 'admin' && (
          <BottomNavLink to="/settings" icon={<Settings size={20} />} label="Settings" />
        )}
        <div 
          style={{ 
            width: '1px', 
            height: '24px', 
            background: '#e2e8f0', 
            margin: '0 4px' 
          }} 
        />
        <button 
          onClick={signOut}
          style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            gap: '4px',
            padding: '8px 12px',
            borderRadius: '40px',
            border: 'none',
            background: '#f1f5f9',
            color: '#64748b',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <User size={20} />
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
        gap: '4px',
        padding: '8px 16px',
        borderRadius: '40px',
        textDecoration: 'none',
        background: isActive ? '#111827' : 'transparent',
        color: isActive ? '#fff' : '#64748b',
        fontWeight: 500,
        fontSize: '11px',
        transition: 'all 0.2s ease',
      })}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

import { CheckSquare, ScrollText, Settings, Home, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AppShellProps {
  children: React.ReactNode;
  onAddTask?: () => void;
}

export function AppShell({ children, onAddTask }: AppShellProps) {
  const { profile } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '100px' }}>
      {/* Main Content */}
      <main style={{ padding: '24px' }}>{children}</main>

      {/* Bottom Menu Bar Container */}
      <div
        style={{ 
          position: 'fixed', 
          bottom: '16px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 100,
        }}
      >
        {/* Main Menu */}
        <nav 
          style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: '4px',
            background: '#fff', 
            borderRadius: '50px', 
            padding: '8px 12px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          }}
        >
          <BottomNavLink to="/" icon={<Home size={20} />} label="All" />
          <BottomNavLink to="/my-tasks" icon={<CheckSquare size={20} />} label="My Tasks" />
          <BottomNavLink to="/my-log" icon={<ScrollText size={20} />} label="My Log" />
          
          {profile?.role === 'admin' && (
            <BottomNavLink to="/settings" icon={<Settings size={20} />} label="Settings" />
          )}
        </nav>

        {/* Add Task Button */}
        <button
          onClick={onAddTask}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#7c3aed',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(124, 58, 237, 0.4)',
          }}
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>
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

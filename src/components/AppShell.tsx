import { CheckSquare, ScrollText, Settings, Home, Plus, Sparkles } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { VersionBadge } from './VersionBadge';

interface AppShellProps {
  children: React.ReactNode;
  onAddTask?: () => void;
}

// Global modal counter for blur effect
let modalCount = 0;
const listeners = new Set<(count: number) => void>();

export function notifyModalOpen() {
  modalCount++;
  listeners.forEach(cb => cb(modalCount));
}

export function notifyModalClose() {
  modalCount = Math.max(0, modalCount - 1);
  listeners.forEach(cb => cb(modalCount));
}

export function AppShell({ children, onAddTask }: AppShellProps) {
  const { profile } = useAuth();
  const location = useLocation();
  const isLogPage = location.pathname === '/my-log';
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Listen for modal open/close
    const handleModalChange = (count: number) => setIsModalOpen(count > 0);
    listeners.add(handleModalChange);
    return () => { listeners.delete(handleModalChange); };
  }, []);

  useEffect(() => {
    // Detect keyboard open/close using visual viewport API
    const handleResize = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const windowHeight = window.innerHeight;
      const keyboardThreshold = 100; // pixels
      
      setIsKeyboardOpen(windowHeight - viewportHeight > keyboardThreshold);
    };

    // Listen for visual viewport changes (more reliable on mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    // Fallback: detect focus on input elements
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      setIsKeyboardOpen(false);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: isKeyboardOpen ? '24px' : '100px' }}>
      {/* Main Content */}
      <main style={{ padding: '24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto 6px' }}>
          <VersionBadge />
        </div>
        {children}
      </main>

      {/* Bottom Menu Bar Container - hidden when keyboard is open, blurred when modal is open */}
      {!isKeyboardOpen && (
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
            filter: isModalOpen ? 'blur(4px)' : 'none',
            opacity: isModalOpen ? 0.6 : 1,
            transition: 'filter 0.3s ease, opacity 0.3s ease',
            pointerEvents: isModalOpen ? 'none' : 'auto',
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
            <BottomNavLink to="/canton-mode" icon={<Sparkles size={20} />} label="Canton" />
            <BottomNavLink to="/my-tasks" icon={<CheckSquare size={20} />} label="Me" />
            <BottomNavLink to="/my-log" icon={<ScrollText size={20} />} label="Logs" />
            
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
              background: isLogPage ? '#22c55e' : '#7c3aed',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isLogPage ? '0 4px 16px rgba(34, 197, 94, 0.4)' : '0 4px 16px rgba(124, 58, 237, 0.4)',
            }}
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        </div>
      )}
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
        padding: '10px 12px',
        borderRadius: '40px',
        textDecoration: 'none',
        background: isActive ? '#1e293b' : 'transparent',
        color: isActive ? '#fff' : '#64748b',
        fontWeight: isActive ? 600 : 500,
        fontSize: '11px',
        transition: 'all 0.2s ease',
        minWidth: '60px',
        textAlign: 'center',
        lineHeight: 1.2,
      })}
    >
      {icon}
      <span style={{ textAlign: 'center', lineHeight: 1.2, maxWidth: '56px', wordWrap: 'break-word' }}>{label}</span>
    </NavLink>
  );
}

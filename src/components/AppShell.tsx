import { CheckSquare, ScrollText, Settings, Home, Sparkles } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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

export function AppShell({ children, onAddTask: _onAddTask }: AppShellProps) {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isLogPage = location.pathname === '/my-log';
  const isAiPage = location.pathname === '/canton-ai';
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

          {/* Silly AI Button */}
          <button
            onClick={() => navigate('/canton-ai')}
            aria-label="Open Silly AI"
            style={{
              width: '62px',
              height: '62px',
              borderRadius: '50%',
              background: isAiPage
                ? 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #7c3aed 100%)'
                : isLogPage
                  ? 'linear-gradient(135deg, #22c55e 0%, #14b8a6 100%)'
                  : 'linear-gradient(135deg, #fb7185 0%, #f59e0b 38%, #8b5cf6 100%)',
              border: '2px solid rgba(255,255,255,0.92)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isAiPage
                ? '0 10px 26px rgba(236, 72, 153, 0.34)'
                : '0 10px 26px rgba(139, 92, 246, 0.34)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <span style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.42), transparent 38%)' }} />
            <SillyAiFabFace />
          </button>
        </div>
      )}
    </div>
  );
}

function SillyAiFabFace() {
  return (
    <div style={{ position: 'relative', width: 38, height: 38, zIndex: 1 }}>
      <span style={{ position: 'absolute', left: 3, top: 2, width: 11, height: 11, borderRadius: '50%', background: '#ffd6e7', border: '2px solid #fff3f7' }} />
      <span style={{ position: 'absolute', right: 3, top: 2, width: 11, height: 11, borderRadius: '50%', background: '#ffd6e7', border: '2px solid #fff3f7' }} />
      <span style={{ position: 'absolute', inset: 4, borderRadius: '50%', background: 'linear-gradient(180deg, #ffe3ee 0%, #ffc4d6 100%)', border: '2px solid rgba(255,255,255,0.88)', boxShadow: 'inset 0 -2px 4px rgba(251,113,133,0.2)' }} />
      <span style={{ position: 'absolute', left: 12, top: 17, width: 4, height: 6, borderRadius: '50%', background: '#6b214d' }} />
      <span style={{ position: 'absolute', right: 12, top: 17, width: 4, height: 6, borderRadius: '50%', background: '#6b214d' }} />
      <span style={{ position: 'absolute', left: '50%', top: 21, width: 7, height: 5, marginLeft: -3.5, borderRadius: '50%', background: '#fb7185' }} />
      <span style={{ position: 'absolute', left: '50%', top: 25, width: 14, height: 7, marginLeft: -7, borderBottom: '2px solid #6b214d', borderRadius: '0 0 999px 999px' }} />
      <span style={{ position: 'absolute', left: 8, top: 22, width: 6, height: 4, borderRadius: '50%', background: 'rgba(244,114,182,0.55)' }} />
      <span style={{ position: 'absolute', right: 8, top: 22, width: 6, height: 4, borderRadius: '50%', background: 'rgba(244,114,182,0.55)' }} />
      <span style={{ position: 'absolute', right: -1, bottom: -2, width: 15, height: 15, borderRadius: '50%', background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)', border: '2px solid rgba(255,255,255,0.92)', display: 'grid', placeItems: 'center', fontSize: 9, boxShadow: '0 4px 10px rgba(245,158,11,0.28)' }}>✦</span>
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

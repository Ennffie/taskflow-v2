import { APP_VERSION } from '../lib/version';

export function VersionBadge() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 140,
        padding: '6px 10px',
        borderRadius: 999,
        background: 'rgba(15, 23, 42, 0.78)',
        color: '#fff',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.02em',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        pointerEvents: 'none',
      }}
    >
      {APP_VERSION}
    </div>
  );
}

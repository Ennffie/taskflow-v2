import { APP_VERSION } from '../lib/version';

export function VersionBadge({ align = 'right', subtle = true }: { align?: 'left' | 'right' | 'inline'; subtle?: boolean }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : align === 'inline' ? 'center' : 'flex-end',
        width: align === 'inline' ? 'auto' : '100%',
        color: subtle ? 'rgba(100, 116, 139, 0.82)' : '#475569',
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: '0.01em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      ({APP_VERSION})
    </div>
  );
}

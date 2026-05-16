import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BackButtonProps {
  to?: string;
  onClick?: () => void;
  label?: ReactNode;
  iconOnly?: boolean;
  style?: CSSProperties;
}

const baseStyle: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: '10px 14px',
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  color: '#475569',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 800,
  fontSize: 16,
  lineHeight: 1,
  textDecoration: 'none',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
  cursor: 'pointer',
};

export function BackButton({ to, onClick, label = 'Back', iconOnly = false, style }: BackButtonProps) {
  const content = (
    <>
      <ArrowLeft size={22} strokeWidth={2.4} />
      {!iconOnly ? <span>{label}</span> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} aria-label={typeof label === 'string' ? label : 'Back'} style={{ ...baseStyle, ...(iconOnly ? { padding: 10, justifyContent: 'center' } : null), ...style }}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={typeof label === 'string' ? label : 'Back'} style={{ ...baseStyle, ...(iconOnly ? { padding: 10, justifyContent: 'center' } : null), ...style }}>
      {content}
    </button>
  );
}

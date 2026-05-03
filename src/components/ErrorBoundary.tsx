import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#fef2f2' }}>
          <div style={{ color: '#dc2626', fontSize: 18, marginBottom: 12, fontWeight: 700 }}>⚠️ 頁面發生錯誤</div>
          <div style={{ color: '#7f1d1d', fontSize: 14, maxWidth: 400, textAlign: 'center', marginBottom: 20 }}>{this.state.error?.message || 'Unknown error'}</div>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600 }}>重新載入</button>
        </div>
      );
    }
    return this.props.children;
  }
}

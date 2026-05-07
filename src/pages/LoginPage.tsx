import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { VersionBadge } from '../components/VersionBadge';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('taskflow_email');
    const rememberFlag = localStorage.getItem('taskflow_remember_me') === 'true';
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(rememberFlag);
    }
    localStorage.removeItem('taskflow_password');
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const result = await signIn(email, password, rememberMe);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    if (rememberMe) {
      localStorage.setItem('taskflow_email', email);
    } else {
      localStorage.removeItem('taskflow_email');
    }
    localStorage.removeItem('taskflow_password');

    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <div style={{ width: 'min(420px, 100%)' }}>
        <div style={{ marginBottom: 6 }}><VersionBadge /></div>
        <div style={{ background: '#fff', borderRadius: '24px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#7c3aed', margin: 0 }}>PMC Tasks Tracker</h1>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>Sign in to manage tasks and updates</p>
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            <Field label="Email">
              <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="yourname@domain.com" />
            </Field>

            <Field label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" />
            </Field>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#7c3aed' }}
              />
              <span>Remember me</span>
            </label>

            {error && (
              <div style={{ borderRadius: '12px', padding: '12px 16px', background: '#fee2e2', color: '#b91c1c', fontSize: '14px' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ borderRadius: '12px', border: 'none', background: '#7c3aed', color: '#fff', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginTop: '8px' }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  background: '#fff',
  padding: '12px 14px',
  fontSize: '14px',
  color: '#111827',
  boxSizing: 'border-box',
  outline: 'none',
};

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, #ede9fe, #ffffff 55%)', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <div style={{ width: 'min(1120px, 100%)', display: 'grid', gridTemplateColumns: '1.2fr 0.9fr', gap: '24px' }} className="login-layout">
        <section style={{ background: 'linear-gradient(135deg, #111827, #6d28d9)', color: '#fff', borderRadius: '36px', padding: '48px', minHeight: '640px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'inline-flex', borderRadius: '999px', padding: '10px 16px', background: 'rgba(255,255,255,0.14)', fontSize: '13px', fontWeight: 700 }}>TaskFlow v2</div>
            <h1 style={{ fontSize: '56px', lineHeight: 1.02, margin: '24px 0 18px' }}>A cleaner workbench for tasks, logs, and team updates.</h1>
            <p style={{ fontSize: '18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.82)', maxWidth: '560px' }}>Built for desktop work first, still easy on mobile. Keep tasks tidy, progress visible, and updates easy to scan.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="login-stats">
            <Stat title="Tasks" value="Fast CRUD" />
            <Stat title="Logs" value="Readable timeline" />
            <Stat title="UI" value="Clean + practical" />
          </div>
        </section>

        <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '36px', padding: '40px', boxShadow: '0 24px 80px rgba(109,40,217,0.12)' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#111827' }}>Welcome back</div>
          <p style={{ fontSize: '15px', color: '#6b7280', marginTop: '10px', marginBottom: '28px' }}>Sign in with your team account to manage tasks and updates.</p>
          <div style={{ display: 'grid', gap: '16px' }}>
            <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="enfield.sw.law@pccw.com" /></Field>
            <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" /></Field>
            {error && <div style={{ borderRadius: '18px', padding: '14px 16px', background: '#fee2e2', color: '#b91c1c', fontSize: '14px' }}>{error}</div>}
            <button onClick={handleSubmit} disabled={loading} style={{ borderRadius: '22px', border: 'none', background: '#111827', color: '#fff', padding: '16px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginTop: '8px' }}>{loading ? 'Signing in...' : 'Sign in'}</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>{label}{children}</label>;
}

function Stat({ title, value }: { title: string; value: string }) {
  return <div style={{ padding: '20px', borderRadius: '24px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.14)' }}><div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{title}</div><div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>{value}</div></div>;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '18px',
  border: '1px solid #e5e7eb',
  background: '#fff',
  padding: '14px 16px',
  fontSize: '14px',
  color: '#111827',
  boxSizing: 'border-box',
};

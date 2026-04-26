import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { TaskListPage } from './pages/TaskListPage';
import { MyTasksPage } from './pages/MyTasksPage';
import { LogBookPage } from './pages/LogBookPage';
import { MyLogPage } from './pages/MyLogPage';
import { SettingsPage } from './pages/SettingsPage';
import { ImportReviewPage } from './pages/ImportReviewPage';

function App() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '16px', background: '#f8fafc' }}>Loading…</div>;
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<TaskListPage />} />
      <Route path="/my-tasks" element={<MyTasksPage />} />
      <Route path="/tasks/:taskId" element={<LogBookPage />} />
      <Route path="/my-log" element={<MyLogPage />} />
      <Route path="/import-review" element={profile?.role === 'admin' ? <ImportReviewPage /> : <Navigate to="/" replace />} />
      <Route path="/settings" element={profile?.role === 'admin' ? <SettingsPage /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
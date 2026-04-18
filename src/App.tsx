import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { TaskListPage } from './pages/TaskListPage';
import { MyTasksPage } from './pages/MyTasksPage';
import { LogBookPage } from './pages/LogBookPage';
import { MyLogPage } from './pages/MyLogPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  const { session, loading, profile } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'grid', 
        placeItems: 'center', 
        background: '#f5f3ff', 
        color: '#6d28d9', 
        fontWeight: 700 
      }}>
        Loading TaskFlow...
      </div>
    );
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
      <Route path="/settings" element={profile?.role === 'admin' ? <SettingsPage /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

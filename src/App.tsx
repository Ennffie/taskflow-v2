import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

const LoginPage = lazy(() => import('./pages/LoginPage').then((mod) => ({ default: mod.LoginPage })));
const TaskListPage = lazy(() => import('./pages/TaskListPage').then((mod) => ({ default: mod.TaskListPage })));
const MyTasksPage = lazy(() => import('./pages/MyTasksPage').then((mod) => ({ default: mod.MyTasksPage })));
const LogBookPage = lazy(() => import('./pages/LogBookPage').then((mod) => ({ default: mod.LogBookPage })));
const MyLogPage = lazy(() => import('./pages/MyLogPage').then((mod) => ({ default: mod.MyLogPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((mod) => ({ default: mod.SettingsPage })));
const ImportReviewPage = lazy(() => import('./pages/ImportReviewPage').then((mod) => ({ default: mod.ImportReviewPage })));
const TrackerByMemberPage = lazy(() => import('./pages/TrackerByMemberPage').then((mod) => ({ default: mod.TrackerByMemberPage })));
const TrackerByTaskPage = lazy(() => import('./pages/TrackerByTaskPage').then((mod) => ({ default: mod.TrackerByTaskPage })));
const ReviewBeforeExportPage = lazy(() => import('./pages/ReviewBeforeExportPage').then((mod) => ({ default: mod.ReviewBeforeExportPage })));
const AdminLogsPage = lazy(() => import('./pages/AdminLogsPage').then((mod) => ({ default: mod.AdminLogsPage })));

function PageFallback() {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '16px', background: '#f8fafc' }}>Loading…</div>;
}

function App() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '16px', background: '#f8fafc' }}>Loading…</div>;
  }

  if (!session) {
    return <Suspense fallback={<PageFallback />}><LoginPage /></Suspense>;
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<TaskListPage />} />
        <Route path="/my-tasks" element={<MyTasksPage />} />
        <Route path="/tasks/:taskId" element={<LogBookPage />} />
        <Route path="/my-log" element={<MyLogPage />} />
        <Route path="/team-logs" element={profile?.role === 'admin' ? <AdminLogsPage /> : <Navigate to="/" replace />} />
        <Route path="/tracker/member" element={profile?.role === 'admin' ? <TrackerByMemberPage /> : <Navigate to="/" replace />} />
        <Route path="/tracker/task" element={profile?.role === 'admin' ? <TrackerByTaskPage /> : <Navigate to="/" replace />} />
        <Route path="/review-export" element={profile?.role === 'admin' ? <ReviewBeforeExportPage /> : <Navigate to="/" replace />} />
        <Route path="/import-review" element={profile?.role === 'admin' ? <ImportReviewPage /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={profile?.role === 'admin' ? <SettingsPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;

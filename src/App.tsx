import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

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
const AttendanceRecordPage = lazy(() => import('./pages/AttendanceRecordPage').then((mod) => ({ default: mod.AttendanceRecordPage })));
const AdminAttendancePage = lazy(() => import('./pages/AdminAttendancePage').then((mod) => ({ default: mod.AdminAttendancePage })));
const CantonModeMockupPage = lazy(() => import('./pages/CantonModeMockupPage').then((mod) => ({ default: mod.CantonModeMockupPage })));
const CantonModePage = lazy(() => import('./pages/CantonModePage').then((mod) => ({ default: mod.CantonModePage })));
const CantonAiCoachPage = lazy(() => import('./pages/CantonAiCoachPage').then((mod) => ({ default: mod.CantonAiCoachPage }))); // lazy route v2
const AiParseDemoPage = lazy(() => import('./pages/AiParseDemoPage').then((mod) => ({ default: mod.AiParseDemoPage })));

function PageFallback() {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '16px', background: '#f8fafc' }}>Loading…</div>;
}

function App() {
  const { session, profile, loading } = useAuth();
  const location = useLocation();
  const isPublicRoute = ['/canton-mode-mockup', '/ai-parse-demo'].includes(location.pathname);

  if (loading && !isPublicRoute) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '16px', background: '#f8fafc' }}>Loading…</div>;
  }

  if (!session && !isPublicRoute) {
    return <Suspense fallback={<PageFallback />}><LoginPage /></Suspense>;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/canton-mode-mockup" element={<CantonModeMockupPage />} />
          <Route path="/canton-mode" element={session ? <CantonModePage /> : <Navigate to="/" replace />} />
          <Route path="/canton-ai" element={session ? <CantonAiCoachPage /> : <Navigate to="/" replace />} />
          <Route path="/ai-parse-demo" element={<AiParseDemoPage />} />
          <Route path="/" element={session ? <TaskListPage /> : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/my-tasks" element={session ? <MyTasksPage /> : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/tasks/:taskId" element={session ? <LogBookPage /> : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/my-log" element={session ? <MyLogPage /> : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/attendance" element={session ? <AttendanceRecordPage /> : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/attendance/admin" element={session && profile?.role === 'admin' ? <AdminAttendancePage /> : <Navigate to={isPublicRoute ? location.pathname : "/"} replace />} />
          <Route path="/team-logs" element={session && profile?.role === 'admin' ? <AdminLogsPage /> : <Navigate to={isPublicRoute ? location.pathname : "/"} replace />} />
          <Route path="/tracker/member" element={session && profile?.role === 'admin' ? <TrackerByMemberPage /> : <Navigate to={isPublicRoute ? location.pathname : "/"} replace />} />
          <Route path="/tracker/task" element={session && profile?.role === 'admin' ? <TrackerByTaskPage /> : <Navigate to={isPublicRoute ? location.pathname : "/"} replace />} />
          <Route path="/review-export" element={session && profile?.role === 'admin' ? <ReviewBeforeExportPage /> : <Navigate to={isPublicRoute ? location.pathname : "/"} replace />} />
          <Route path="/import-review" element={session && profile?.role === 'admin' ? <ImportReviewPage /> : <Navigate to={isPublicRoute ? location.pathname : "/"} replace />} />
          <Route path="/settings" element={session && profile?.role === 'admin' ? <SettingsPage /> : <Navigate to={isPublicRoute ? location.pathname : "/"} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;

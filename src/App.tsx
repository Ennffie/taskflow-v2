import { Suspense, lazy, type ComponentType } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

const CHUNK_RELOAD_KEY = 'taskflow:chunk-reload-once';

function lazyWithReload(loader: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(async () => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return await loader();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldReload = /Failed to fetch dynamically imported module|Importing a module script failed|Load failed|fetch dynamically imported/i.test(message);
      if (shouldReload && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw error;
    }
  });
}

const LoginPage = lazyWithReload(() => import('./pages/LoginPage').then((mod) => ({ default: mod.LoginPage })));
const MyTasksPage = lazyWithReload(() => import('./pages/MyTasksPage').then((mod) => ({ default: mod.MyTasksPage })));
const TaskListPage = lazyWithReload(() => import('./pages/TaskListPage').then((mod) => ({ default: mod.TaskListPage })));
const LogBookPage = lazyWithReload(() => import('./pages/LogBookPage').then((mod) => ({ default: mod.LogBookPage })));
const MyLogPage = lazyWithReload(() => import('./pages/MyLogPage').then((mod) => ({ default: mod.MyLogPage })));
const SettingsPage = lazyWithReload(() => import('./pages/SettingsPage').then((mod) => ({ default: mod.SettingsPage })));
const ImportReviewPage = lazyWithReload(() => import('./pages/ImportReviewPage').then((mod) => ({ default: mod.ImportReviewPage })));
const ImportHistoryPage = lazyWithReload(() => import('./pages/ImportHistoryPage').then((mod) => ({ default: mod.ImportHistoryPage })));
const TrackerByMemberPage = lazyWithReload(() => import('./pages/TrackerByMemberPage').then((mod) => ({ default: mod.TrackerByMemberPage })));
const TrackerByTaskPage = lazyWithReload(() => import('./pages/TrackerByTaskPage').then((mod) => ({ default: mod.TrackerByTaskPage })));
const ReviewBeforeExportPage = lazyWithReload(() => import('./pages/ReviewBeforeExportPage').then((mod) => ({ default: mod.ReviewBeforeExportPage })));
const AdminLogsPage = lazyWithReload(() => import('./pages/AdminLogsPage').then((mod) => ({ default: mod.AdminLogsPage })));
const AttendanceRecordPage = lazyWithReload(() => import('./pages/AttendanceRecordPage').then((mod) => ({ default: mod.AttendanceRecordPage })));
const AdminAttendancePage = lazyWithReload(() => import('./pages/AdminAttendancePage').then((mod) => ({ default: mod.AdminAttendancePage })));
const CantonModeMockupPage = lazyWithReload(() => import('./pages/CantonModeMockupPage').then((mod) => ({ default: mod.CantonModeMockupPage })));
const CantonModePage = lazyWithReload(() => import('./pages/CantonModePage').then((mod) => ({ default: mod.CantonModePage })));
const CantonAiCoachPage = lazyWithReload(() => import('./pages/CantonAiCoachPage').then((mod) => ({ default: mod.CantonAiCoachPage })));
const AiParseDemoPage = lazyWithReload(() => import('./pages/AiParseDemoPage').then((mod) => ({ default: mod.AiParseDemoPage })));

function PageFallback() {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '16px', background: '#f8fafc' }}>Loading…</div>;
}

function AdminRouteNotice() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '28px 24px', boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em', color: '#7c3aed', textTransform: 'uppercase' }}>Admin Only</div>
        <h1 style={{ margin: '12px 0 10px', fontSize: '24px', lineHeight: 1.2, color: '#111827' }}>This page is for admin only.</h1>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#64748b' }}>
          Your account can use the normal task, attendance, and Canton AI pages, but this area needs admin permission.
        </p>
        <button
          onClick={() => window.location.assign(`${window.location.origin}${window.location.pathname}#/`)}
          style={{ marginTop: '20px', width: '100%', border: 'none', borderRadius: '999px', padding: '13px 16px', background: '#111827', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
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
          <Route path="/" element={session ? <CantonModePage /> : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/all-tasks" element={session ? <TaskListPage /> : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/my-tasks" element={session ? <MyTasksPage /> : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/tasks/:taskId" element={session ? <LogBookPage /> : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/my-log" element={session ? <MyLogPage /> : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/attendance" element={session ? <AttendanceRecordPage /> : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/attendance/admin" element={session ? (profile?.role === 'admin' ? <AdminAttendancePage /> : <AdminRouteNotice />) : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/team-logs" element={session ? (profile?.role === 'admin' ? <AdminLogsPage /> : <AdminRouteNotice />) : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/tracker/member" element={session ? (profile?.role === 'admin' ? <TrackerByMemberPage /> : <AdminRouteNotice />) : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/tracker/task" element={session ? (profile?.role === 'admin' ? <TrackerByTaskPage /> : <AdminRouteNotice />) : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/review-export" element={session ? (profile?.role === 'admin' ? <ReviewBeforeExportPage /> : <AdminRouteNotice />) : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/import-review" element={session ? (profile?.role === 'admin' ? <ImportReviewPage /> : <AdminRouteNotice />) : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/import-history" element={session ? (profile?.role === 'admin' ? <ImportHistoryPage /> : <AdminRouteNotice />) : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="/settings" element={session ? (profile?.role === 'admin' ? <SettingsPage /> : <AdminRouteNotice />) : <Navigate to="/ai-parse-demo" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;

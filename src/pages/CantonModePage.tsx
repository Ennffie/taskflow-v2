import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Clock3, RefreshCw, Sparkles, UserRound, Waves } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { checkInToday, fetchTasks, fetchTodayAttendance } from '../lib/api';
import { AppShell } from '../components/AppShell';
import { TaskFormModal } from '../components/TaskFormModal';
import { useAuth } from '../contexts/AuthContext';
import { MAX_VISIBLE_PLANETS, getPlanetAngle, getPlanetLaneRadius, getPlanetSize } from '../lib/cantonOrbit';
import { formatHongKongDateLabel, formatHongKongTimeLabel, getDailyHoroscopeForProfile } from '../lib/horoscope';
import { getStatusMeta, type AttendanceLog, type TaskItem } from '../types';

const pageBg = 'linear-gradient(180deg, #f7f2ff 0%, #eef6ff 52%, #f8fafc 100%)';
const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(226,232,240,0.92)',
  borderRadius: 28,
  boxShadow: '0 16px 45px rgba(148, 163, 184, 0.16)',
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: '早晨，Enfield~', icon: '🌅' };
  if (hour >= 12 && hour < 18) return { text: '午安，Enfield~', icon: '☀️' };
  return { text: '晚安，Enfield~', icon: '🌙' };
}

function isDone(task: TaskItem) {
  return task.status === 'finished' || task.is_finished;
}

function isOverdue(task: TaskItem) {
  if (!task.due_date || isDone(task)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function isToday(task: TaskItem) {
  if (!task.due_date || isDone(task)) return false;
  const today = new Date();
  const due = new Date(task.due_date);
  return today.toDateString() === due.toDateString();
}

function isStale(task: TaskItem) {
  if (isDone(task)) return false;
  const updated = new Date(task.updated_at).getTime();
  const days = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  return days >= 5;
}

function dueLabel(dueDate: string | null) {
  if (!dueDate) return '未 set deadline';
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return new Intl.DateTimeFormat('zh-HK', { month: 'numeric', day: 'numeric' }).format(due);
}

function assigneeLabel(task: TaskItem) {
  if (!task.assignees.length) return '未分配';
  if (task.assignees.length === 1) return initials(task.assignees[0].name);
  return `${initials(task.assignees[0].name)} +${task.assignees.length - 1}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function getUserColor(task: TaskItem) {
  const profile = task.assignees[0];
  if (!profile) return '#A78BFA';
  const normalized = `${profile.id}:${profile.name}`.toLowerCase();
  if (normalized.includes('enfield')) return '#6366F1';
  const palette = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'];
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function CantonModePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceLog | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [checkInLoading, setCheckInLoading] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    try {
      setTasks(await fetchTasks());
    } catch (error: any) {
      alert(`Load Canton mode failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async () => {
    setAttendanceLoading(true);
    try {
      setAttendance(await fetchTodayAttendance());
    } catch (error: any) {
      alert(`Load check-in failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadPageData = async () => {
    await Promise.all([loadTasks(), loadAttendance()]);
  };

  useEffect(() => {
    void loadPageData();
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadPageData();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [user?.id]);

  const rootTasks = useMemo(() => tasks.filter((task) => !task.parent_id), [tasks]);
  const focusTasks = useMemo(() => rootTasks.filter((task) => task.is_focus && !isDone(task)), [rootTasks]);
  const visibleTasks = useMemo(() => {
    const focus = focusTasks
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, MAX_VISIBLE_PLANETS);
    if (focus.length >= MAX_VISIBLE_PLANETS) return focus;

    const others = rootTasks
      .filter((task) => !isDone(task) && !task.is_focus)
      .sort((a, b) => {
        const score = (task: TaskItem) => (isOverdue(task) ? -20 : 0) + (task.priority === 'urgent' ? -12 : task.priority === 'high' ? -8 : 0);
        if (score(a) !== score(b)) return score(a) - score(b);
        if (!a.due_date && !b.due_date) return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      })
      .slice(0, MAX_VISIBLE_PLANETS - focus.length);
    return [...focus, ...others];
  }, [rootTasks, focusTasks]);

  const todayTasks = useMemo(() => rootTasks.filter(isToday).slice(0, 4), [rootTasks]);
  const riskItems = useMemo(() => {
    const items: { label: string; detail: string; task?: TaskItem; tone: 'danger' | 'warn' | 'info' }[] = [];
    rootTasks.filter(isOverdue).slice(0, 3).forEach((task) => items.push({ label: '已過 deadline', detail: task.title, task, tone: 'danger' }));
    rootTasks.filter((task) => !isDone(task) && !task.due_date).slice(0, 3).forEach((task) => items.push({ label: '未 set deadline', detail: task.title, task, tone: 'warn' }));
    rootTasks.filter((task) => !isDone(task) && task.assignees.length === 0).slice(0, 3).forEach((task) => items.push({ label: '未確認 assignee', detail: task.title, task, tone: 'warn' }));
    rootTasks.filter(isStale).slice(0, 3).forEach((task) => items.push({ label: '太耐冇郁過', detail: task.title, task, tone: 'info' }));
    return items.slice(0, 5);
  }, [rootTasks]);

  return (
    <AppShell onAddTask={() => setShowModal(true)}>
      <div style={{ minHeight: 'calc(100vh - 48px)', margin: '-24px', padding: '24px 18px 130px', background: pageBg }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 18 }}>
          <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, paddingTop: 8 }}>
            <div>
              <h1 style={{ margin: 0, color: '#0f172a', fontSize: 30, lineHeight: 1.08, letterSpacing: '-0.04em' }}>{(() => { const g = getGreeting(); return `${g.icon} ${g.text}`; })()}</h1>
              <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 14 }}></p>
            </div>
            <button onClick={() => void loadTasks()} style={{ width: 44, height: 44, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 16, display: 'grid', placeItems: 'center', color: '#475569' }} aria-label="Refresh tasks">
              <RefreshCw size={18} />
            </button>
          </header>

          {loading ? (
            <div style={{ ...cardStyle, padding: 28, color: '#64748b', fontWeight: 700 }}>Loading Canton mode…</div>
          ) : (
            <>
              <AttendanceCheckInCard
                profileName={profile?.name || user?.user_metadata?.name || user?.email || 'Enfield'}
                profileEmail={profile?.email || user?.email || ''}
                attendance={attendance}
                loading={attendanceLoading}
                checkingIn={checkInLoading}
                onCheckIn={async () => {
                  if (attendance || checkInLoading) return;
                  setCheckInLoading(true);
                  try {
                    const next = await checkInToday('canton_mode');
                    setAttendance(next);
                  } catch (error: any) {
                    alert(`Check-in failed: ${error?.message || 'Unknown error'}`);
                  } finally {
                    setCheckInLoading(false);
                  }
                }}
              />

              <section style={{ ...cardStyle, padding: '16px 0 0', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(251,247,255,0.94))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6d28d9', fontWeight: 900, fontSize: 14 }}><Waves size={17} /> Focus Tasks ({focusTasks.length})</div>
                </div>

                <div style={{ position: 'relative', height: 760, borderRadius: '30px 30px 0 0', overflow: 'auto', touchAction: 'pan-x pan-y pinch-zoom', background: 'radial-gradient(circle at 50% 50%, #fff 0%, #fdf4ff 40%, #eef6ff 100%)', padding: '28px 8px 72px' }}>
                  <SunCenter />
                  {visibleTasks.length === 0 ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#64748b', padding: 28 }}>
                      <div><div style={{ fontSize: 28, marginBottom: 8 }}>🌙</div><strong>暫時冇浮面 task</strong><div style={{ marginTop: 6, fontSize: 13 }}>可以撳 + 加新 task。</div></div>
                    </div>
                  ) : visibleTasks.map((task, index) => (
                    <TaskBubble key={task.id} task={task} index={index} total={visibleTasks.length} allTasks={tasks} onClick={() => navigate(`/tasks/${task.id}`)} />
                  ))}
                </div>
              </section>

              <CantonAiCoach tasks={tasks} onTaskCreated={loadTasks} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <section style={{ ...cardStyle, padding: 16 }}>
                  <SectionTitle icon={<Clock3 size={16} color="#7c3aed" />} title="今日要搞" count={todayTasks.length} />
                  {todayTasks.length ? todayTasks.map((task) => <MiniTask key={task.id} task={task} onClick={() => navigate(`/tasks/${task.id}`)} />) : <EmptyText text="今日未有 deadline task。" />}
                </section>
                <section style={{ ...cardStyle, padding: 16 }}>
                  <SectionTitle icon={<AlertTriangle size={16} color="#f97316" />} title="唔好漏咗" count={riskItems.length} />
                  {riskItems.length ? riskItems.map((item, idx) => <RiskItem key={`${item.label}-${item.detail}-${idx}`} item={item} onClick={() => item.task && navigate(`/tasks/${item.task.id}`)} />) : <EmptyText text="暫時冇明顯風險，幾好呀。" />}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
      {showModal && <TaskFormModal onClose={() => setShowModal(false)} onCreated={loadTasks} variant="canton" />}
    </AppShell>
  );
}

function AttendanceCheckInCard({
  profileName,
  profileEmail,
  attendance,
  loading,
  checkingIn,
  onCheckIn,
}: {
  profileName: string;
  profileEmail: string;
  attendance: AttendanceLog | null;
  loading: boolean;
  checkingIn: boolean;
  onCheckIn: () => void | Promise<void>;
}) {
  const horoscope = getDailyHoroscopeForProfile({ name: profileName, email: profileEmail });
  const hasCheckedIn = !!attendance;
  const dateLabel = formatHongKongDateLabel(new Date());
  const timeLabel = attendance?.check_in_at ? formatHongKongTimeLabel(attendance.check_in_at) : '—:—';

  return (
    <section style={{ ...cardStyle, padding: 18, background: 'linear-gradient(180deg, #fffaf5 0%, #fff 35%, #f7fbff 100%)', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', right: -24, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.02) 72%, transparent 100%)' }} />
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <HamsterBadge />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ea580c', fontSize: 13, fontWeight: 900 }}><Sparkles size={15} /> 報到</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}>{hasCheckedIn ? '今日已經打咗卡 ✨' : '返工前記得撳一下呀'}</div>
            </div>
          </div>
        </div>

        <div style={{ borderRadius: 22, padding: '16px 16px 18px', background: 'linear-gradient(135deg, #fff1f2 0%, #fefce8 48%, #eff6ff 100%)', border: '1px solid rgba(251,146,60,0.18)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9a3412', fontSize: 13, fontWeight: 900 }}><Sparkles size={14} /> 今日運程 · {horoscope.signLabel}</div>
          <div style={{ marginTop: 10, fontSize: 20, lineHeight: 1.45, fontWeight: 900, color: '#7c2d12', letterSpacing: '-0.02em' }}>{horoscope.message}</div>
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ padding: '7px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.74)', color: '#9a3412', fontSize: 12, fontWeight: 800 }}>幸運色：{horoscope.luckyColor}</span>
            <span style={{ padding: '7px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.74)', color: '#9a3412', fontSize: 12, fontWeight: 800 }}>今日小物：{horoscope.luckyThing}</span>
          </div>
        </div>

        <div style={{ borderRadius: 24, padding: '16px 16px 18px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 14px 30px rgba(148,163,184,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13, fontWeight: 800 }}><CalendarDays size={15} /> {dateLabel}</div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 52, lineHeight: 0.95, fontWeight: 950, letterSpacing: '-0.05em', color: '#0f172a' }}>{loading ? '…' : timeLabel}</div>
            {hasCheckedIn && <span style={{ padding: '6px 10px', borderRadius: 999, background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 900 }}>已報到</span>}
          </div>
          <div style={{ marginTop: 10, color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
            {hasCheckedIn ? '今日返工時間已記錄好，慢慢開工都得。' : '未報到前撳一下，會記低今日日期同而家時間。'}
          </div>
          <button
            onClick={() => void onCheckIn()}
            disabled={loading || checkingIn || hasCheckedIn}
            style={{
              marginTop: 16,
              width: '100%',
              border: 'none',
              borderRadius: 18,
              padding: '15px 18px',
              background: hasCheckedIn ? '#e2e8f0' : 'linear-gradient(135deg, #fb7185 0%, #f59e0b 100%)',
              color: hasCheckedIn ? '#64748b' : '#fff',
              fontSize: 16,
              fontWeight: 900,
              boxShadow: hasCheckedIn ? 'none' : '0 14px 26px rgba(249,115,22,0.24)',
              cursor: loading || checkingIn || hasCheckedIn ? 'default' : 'pointer',
              opacity: checkingIn ? 0.82 : 1,
            }}
          >
            {checkingIn ? '報到中…' : hasCheckedIn ? '今日已報到' : '立即報到'}
          </button>
        </div>
      </div>
    </section>
  );
}

function HamsterBadge() {
  return (
    <div style={{ width: 72, height: 72, borderRadius: 24, background: 'linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)', border: '1px solid rgba(251,146,60,0.28)', display: 'grid', placeItems: 'center', boxShadow: '0 12px 24px rgba(251,146,60,0.16)' }}>
      <div style={{ position: 'relative', width: 52, height: 52 }}>
        <span style={{ position: 'absolute', left: 6, top: 2, width: 14, height: 14, borderRadius: '50%', background: '#f5c7a9', border: '2px solid #d4a373' }} />
        <span style={{ position: 'absolute', right: 6, top: 2, width: 14, height: 14, borderRadius: '50%', background: '#f5c7a9', border: '2px solid #d4a373' }} />
        <span style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: 'linear-gradient(180deg, #f7d3b7 0%, #e8b48a 100%)', border: '2px solid #d4a373' }} />
        <span style={{ position: 'absolute', left: 16, top: 24, width: 5, height: 7, borderRadius: '50%', background: '#3f3f46' }} />
        <span style={{ position: 'absolute', right: 16, top: 24, width: 5, height: 7, borderRadius: '50%', background: '#3f3f46' }} />
        <span style={{ position: 'absolute', left: '50%', top: 29, width: 8, height: 6, marginLeft: -4, borderRadius: '50%', background: '#7c2d12' }} />
        <span style={{ position: 'absolute', left: '50%', top: 35, width: 16, height: 8, marginLeft: -8, borderBottom: '2px solid #7c2d12', borderRadius: '0 0 999px 999px' }} />
        <span style={{ position: 'absolute', left: 11, top: 32, width: 8, height: 5, borderRadius: '50%', background: 'rgba(251,113,133,0.45)' }} />
        <span style={{ position: 'absolute', right: 11, top: 32, width: 8, height: 5, borderRadius: '50%', background: 'rgba(251,113,133,0.45)' }} />
      </div>
    </div>
  );
}

function SunCenter() {
  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      top: '42%',
      width: 116,
      height: 116,
      transform: 'translate(-50%, -50%)',
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(254,240,138,0.24) 0%, rgba(254,240,138,0.12) 48%, rgba(254,240,138,0) 72%)',
      boxShadow: '0 0 36px rgba(251, 191, 36, 0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      zIndex: 9,
      pointerEvents: 'none',
    }}>
      <svg viewBox="0 0 120 120" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', filter: 'drop-shadow(0 5px 8px rgba(245,158,11,0.18))' }}>
        <path
          d="M60 5 C64 18 70 18 78 8 C77 23 84 23 96 14 C91 29 98 33 113 31 C101 40 105 48 117 53 C102 56 102 64 117 70 C102 72 99 80 110 91 C96 88 91 95 96 109 C84 100 77 104 75 117 C68 105 61 108 54 117 C52 103 44 102 34 112 C38 97 31 93 17 99 C25 86 21 80 5 76 C19 69 18 62 5 55 C20 51 21 44 10 35 C25 37 30 30 23 16 C36 23 43 19 45 6 C50 18 56 18 60 5 Z"
          fill="#fbbf24"
          stroke="#f59e0b"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M60 9 C64 20 70 20 76 12 C76 25 84 26 92 18 C89 30 96 35 108 34 C98 42 101 49 112 54 C100 57 100 63 112 69 C99 72 97 78 106 88 C94 86 89 94 92 104 C82 97 76 101 73 112 C67 102 61 104 55 112 C53 101 45 100 37 108 C40 96 33 91 21 95 C29 84 25 78 11 75 C23 68 23 62 11 56 C23 52 25 45 15 38 C28 39 33 32 28 21 C38 26 45 22 47 11 C51 20 56 20 60 9 Z"
          fill="rgba(254, 240, 138, 0.22)"
        />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 18,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 28%, #fef9c3 0%, #fde047 48%, #facc15 76%, #f59e0b 100%)',
        boxShadow: '0 10px 30px rgba(251, 191, 36, 0.42), inset 0 -5px 12px rgba(245, 158, 11, 0.22), inset 0 4px 10px rgba(255,255,255,0.42)',
        border: '2px solid rgba(234,179,8,0.45)',
      }} />
      <div style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%' }}>
        <span style={{ position: 'absolute', left: 22, top: 28, width: 7, height: 9, borderRadius: '50%', background: '#374151', boxShadow: '3px 2px 0 rgba(255,255,255,0.65) inset' }} />
        <span style={{ position: 'absolute', right: 22, top: 28, width: 7, height: 9, borderRadius: '50%', background: '#374151', boxShadow: '3px 2px 0 rgba(255,255,255,0.65) inset' }} />
        <span style={{ position: 'absolute', left: 13, top: 41, width: 13, height: 9, borderRadius: '50%', background: 'rgba(244,114,182,0.62)', filter: 'blur(0.2px)' }} />
        <span style={{ position: 'absolute', right: 13, top: 41, width: 13, height: 9, borderRadius: '50%', background: 'rgba(244,114,182,0.62)', filter: 'blur(0.2px)' }} />
        <span style={{ position: 'absolute', left: 32, top: 42, width: 17, height: 9, borderBottom: '2px solid #374151', borderRadius: '0 0 999px 999px' }} />
        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 7, color: 'rgba(234, 88, 12, 0.42)', fontWeight: 500, fontSize: 10.5, letterSpacing: '0.07em', textShadow: '0 1px 0 rgba(255,255,255,0.32)' }}>UIUX</span>
      </div>
    </div>
  );
}

function TaskBubble({ task, index, total, allTasks, onClick }: { task: TaskItem; index: number; total: number; allTasks: TaskItem[]; onClick: () => void }) {
  const subtasks = allTasks.filter((item) => item.parent_id === task.id);
  const angleDeg = getPlanetAngle(index, total);
  const laneRadius = getPlanetLaneRadius(index, total);
  const size = getPlanetSize(index, total, isOverdue(task));
  const isFocusBubble = task.is_focus || index === 0;
  const isPrimaryBubble = total > 4 ? index < 4 : true;
  const userColor = getUserColor(task);
  const bg = isOverdue(task)
    ? `radial-gradient(circle at 34% 24%, #fff1f2 0%, ${hexToRgba(userColor, 0.42)} 44%, #fca5a5 100%)`
    : `radial-gradient(circle at 34% 24%, #ffffff 0%, ${hexToRgba(userColor, 0.34)} 48%, ${hexToRgba(userColor, 0.62)} 100%)`;
  const textColor = isOverdue(task) ? '#7f1d1d' : '#312e81';
  const floatDelay = `${index * -2.6}s`;
  const floatDur = index === 0 ? 9.5 : 7.2 + (index % 3) * 1.3;
  const mainOrbitDur = 76;
  const completedSubtasks = subtasks.filter(isDone).length;
  const completion = subtasks.length ? completedSubtasks / subtasks.length : 1;
  const baseSubtaskOrbitDur = 5.2 + completion * 10.5;
  return (
    <div
      className="canton-main-orbit-shell"
      style={{
        position: 'absolute',
        left: '50%',
        top: '42%',
        width: 0,
        height: 0,
        zIndex: 5 + index,
        animation: `canton-main-orbit-spin ${mainOrbitDur}s linear infinite`,
        ['--orbit-start' as any]: `${angleDeg}deg`,
      }}
    >
      <div
        className="canton-main-orbit-counter"
        style={{
          position: 'absolute',
          left: laneRadius,
          top: 0,
          width: size,
          height: size,
          animation: `canton-main-counter-spin ${mainOrbitDur}s linear infinite`,
          ['--orbit-start' as any]: `${angleDeg}deg`,
        }}
      >
        <button
          onClick={onClick}
          className={isFocusBubble ? 'canton-focus-bubble' : 'canton-main-bubble'}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            animation: `canton-bubble-breathe ${floatDur}s ease-in-out infinite`,
            animationDelay: floatDelay,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.75)',
            background: bg,
            boxShadow: isFocusBubble ? `0 18px 36px ${hexToRgba(userColor, 0.24)}` : `0 14px 28px ${hexToRgba(userColor, 0.18)}`,
            padding: total > 4 ? (isPrimaryBubble ? 10 : 7) : (index === 0 ? 10 : 9),
            textAlign: 'center',
            cursor: 'pointer',
            color: textColor,
          }}
        >
          <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: isPrimaryBubble ? 2 : 1 }}>
            <div style={{ fontSize: total > 4 ? (isPrimaryBubble ? (index === 0 ? 9.8 : 9.2) : 7.4) : (index === 0 ? 9.2 : 8.4), lineHeight: 1, fontWeight: 900, opacity: 0.86, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dueLabel(task.due_date)}</div>
            <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', width: '100%' }}>
              <div style={{ fontSize: total > 4 ? (isPrimaryBubble ? (index === 0 ? 13.5 : 12.5) : 9.1) : (index === 0 ? 12 : 10.5), lineHeight: isPrimaryBubble ? 1.04 : 1.03, fontWeight: 900, display: '-webkit-box', WebkitLineClamp: total > 4 ? (isPrimaryBubble ? 3 : 2) : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word', maxWidth: '100%' }}>{task.title}</div>
            </div>
            <div style={{ fontSize: total > 4 ? (isPrimaryBubble ? (index === 0 ? 9 : 8.3) : 7) : (index === 0 ? 8.8 : 8), opacity: 0.8, fontWeight: 800, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assigneeLabel(task)}</div>
          </div>
          {isPrimaryBubble && subtasks.slice(0, 6).map((subtask, subIndex) => {
            const subAngle = (360 / Math.max(Math.min(subtasks.length, 6), 1)) * subIndex - 90;
            const subProgress = subtask.is_finished || subtask.status === 'finished' ? 100 : (subtask.progress_percent ?? 0);
            const subOrbitDur = Math.max(4.2, baseSubtaskOrbitDur + subProgress * 0.045 + subIndex * 0.35);
            const dotSize = subtask.is_finished || subtask.status === 'finished' ? 11 : 13;
            return (
              <span
                key={subtask.id}
                className="canton-orbit-ring"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 0,
                  height: 0,
                  animation: `canton-subtask-orbit ${subOrbitDur}s linear infinite`,
                  ['--orbit-start' as any]: `${subAngle}deg`,
                }}
              >
                <span
                  className="canton-orbit-dot"
                  style={{
                    position: 'absolute',
                    left: size / 2 + 7,
                    top: 0,
                    width: dotSize,
                    height: dotSize,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    background: subtask.is_finished || subtask.status === 'finished' ? '#22c55e' : '#8b5cf6',
                    border: '2px solid #fff',
                    boxShadow: '0 2px 6px rgba(15,23,42,0.16)',
                  }}
                />
              </span>
            );
          })}
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#0f172a', fontSize: 15, fontWeight: 900 }}>{icon}{title}</div><span style={{ fontSize: 12, fontWeight: 900, color: '#64748b', background: '#f1f5f9', padding: '5px 9px', borderRadius: 999 }}>{count}</span></div>;
}

function MiniTask({ task, onClick }: { task: TaskItem; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: '100%', textAlign: 'left', padding: 13, borderRadius: 18, border: '1px solid #e5e7eb', background: isOverdue(task) ? '#fff7ed' : '#fff', marginBottom: 10, cursor: 'pointer' }}><div style={{ color: '#0f172a', fontSize: 14, fontWeight: 900, marginBottom: 5 }}>{task.title}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: '#64748b', fontSize: 11, fontWeight: 700 }}><span><CalendarDays size={11} /> {dueLabel(task.due_date)}</span><span><UserRound size={11} /> {assigneeLabel(task)}</span><span style={{ color: getStatusMeta(task.status).color }}>{getStatusMeta(task.status).label}</span></div></button>;
}

function RiskItem({ item, onClick }: { item: { label: string; detail: string; tone: 'danger' | 'warn' | 'info' }; onClick: () => void }) {
  const color = item.tone === 'danger' ? '#dc2626' : item.tone === 'warn' ? '#ea580c' : '#2563eb';
  const bg = item.tone === 'danger' ? '#fef2f2' : item.tone === 'warn' ? '#fff7ed' : '#eff6ff';
  return <button onClick={onClick} style={{ width: '100%', textAlign: 'left', padding: 13, borderRadius: 18, border: `1px solid ${item.tone === 'danger' ? '#fecaca' : '#fed7aa'}`, background: bg, marginBottom: 10, cursor: 'pointer' }}><div style={{ color, fontSize: 12, fontWeight: 900, marginBottom: 4 }}>{item.label}</div><div style={{ color: '#0f172a', fontSize: 14, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</div></button>;
}

function getDailyQuote() {
  const quotes = [
    { head: '慢啲都冇所謂', sub: '最重要係方向啱，步步都算數。' },
    { head: '今日做咗少少', sub: '已經贏過昨日嘅自己。' },
    { head: '專注一件事先', sub: '散彈槍打唔到遠目標。' },
    { head: '壓力係訊號', sub: '提醒你要唞一唞，唔係要放棄。' },
    { head: '做得再好', sub: '都唔好忘咗留啲時間畀自己。' },
    { head: '啲事擺到明早', sub: '如果今晚需要瞓覺。' },
    { head: '你唔使證明咩', sub: '你只需要做好今日嘅自己。' },
    { head: '開會前先飲杯水', sub: '身體舒服先傾得順。' },
    { head: '有啲嘢控制唔到', sub: '專心搞掂控制到嘅先。' },
    { head: '容許自己唔完美', sub: '完美係敵人，完成係朋友。' },
    { head: '記得讚自己', sub: '你又撐過咗一日。' },
    { head: '落雨就帶遮', sub: '唔好怪自己冇帶，學識睇天氣。' },
    { head: '做唔晒唔緊要', sub: 'list 係工具，唔係鞭。' },
    { head: '同自己講聲多謝', sub: '你其實好努力。' },
    { head: '有時停低先係進步', sub: '衝太快會撞牆。' },
    { head: '人情世故好攰', sub: '但真係幫過你嘅人，記得回報。' },
    { head: '唔好 compare', sub: '你條路同佢條路根本唔同軌。' },
    { head: '擔心嘅事九成', sub: '最後都唔會發生，放鬆啲。' },
    { head: '今日件事搞唔掂', sub: '明日太陽照樣升起，有機會再嚟。' },
    { head: '最叻嗰個係', sub: '跌倒咗又爬得返起嗰個。' },
    { head: '未 ready 唔係錯', sub: '係你有要求，唔係你差。' },
    { head: '聽日嘅你', sub: '會多謝今日冇放棄嘅自己。' },
    { head: '把聲好攰就唔好講', sub: '沉默都係一種力量。' },
    { head: '人哋點睇', sub: '控制唔到；你點睇自己，先係你嘅。' },
    { head: '唔好等心情好先做', sub: '做咗先，心情自然跟埋好。' },
    { head: '所有大事', sub: '最初都係由細步開始。' },
    { head: '唔好為快而快', sub: '質量永遠贏速度。' },
    { head: '有需要就開口', sub: '真係叻嘅人識得搵幫手。' },
    { head: '件事搞掂咗', sub: '記得話自己知：「我做到嘅。」' },
    { head: '唔好怕改計劃', sub: '靈活先係高手嘅本事。' },
    { head: '最後', sub: '你值得被溫柔對待，尤其係被你自己。' },
  ];
  const day = new Date().getDate();
  return quotes[(day - 1) % quotes.length];
}

function CantonAiCoach({ tasks: _tasks, onTaskCreated: _onTaskCreated }: { tasks: TaskItem[]; onTaskCreated: () => Promise<void> | void }) {
  const navigate = useNavigate();
  const quote = getDailyQuote();

  return (
    <button onClick={() => navigate('/canton-ai')} style={{ ...cardStyle, width: '100%', textAlign: 'left', padding: '24px 22px', border: '1px solid rgba(186,230,253,0.95)', background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 48%, #f5f3ff 100%)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -18, top: -20, width: 118, height: 118, borderRadius: '50%', background: 'rgba(56,189,248,0.12)' }} />
      <div style={{ position: 'relative', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'grid', gap: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#0369a1', fontSize: 14, fontWeight: 950 }}>
            <Sparkles size={18} /> Silly AI
          </div>
          <div style={{ color: '#0f172a', fontSize: 28, lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950 }}>
            {quote.head}
          </div>
          <div style={{ color: '#475569', fontSize: 18, lineHeight: 1.25, fontWeight: 800 }}>
            {quote.sub}
          </div>
          <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content', padding: '11px 15px', borderRadius: 999, background: '#0f172a', color: '#fff', fontSize: 14, fontWeight: 900 }}>
            隨便問我啦～ 💬
          </div>
        </div>
        <img src="/taskflow-v2/hamster-mascot.jpg" alt="Silly" style={{ width: 140, height: 140, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '3px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: -12, marginRight: -8 }} />
      </div>
    </button>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div style={{ padding: 18, borderRadius: 18, background: '#f8fafc', color: '#64748b', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{text}</div>;
}

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Clock3, Plus, RefreshCw, Sparkles, UserRound, Waves } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTasks } from '../lib/api';
import { AppShell } from '../components/AppShell';
import { TaskFormModal } from '../components/TaskFormModal';
import { STATUS_META, type TaskItem } from '../types';

const pageBg = 'linear-gradient(180deg, #f7f2ff 0%, #eef6ff 52%, #f8fafc 100%)';
const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(226,232,240,0.92)',
  borderRadius: 28,
  boxShadow: '0 16px 45px rgba(148, 163, 184, 0.16)',
};

function isDone(task: TaskItem) {
  return task.status === 'done' || task.is_finished;
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
  return new Intl.DateTimeFormat('zh-HK', { month: 'short', day: 'numeric' }).format(new Date(dueDate));
}

function assigneeLabel(task: TaskItem) {
  if (!task.assignees.length) return '未分配';
  if (task.assignees.length === 1) return task.assignees[0].name;
  return `${task.assignees[0].name} +${task.assignees.length - 1}`;
}

export function CantonModePage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

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

  useEffect(() => {
    void loadTasks();
  }, []);

  const rootTasks = useMemo(() => tasks.filter((task) => !task.parent_id), [tasks]);
  const visibleTasks = useMemo(() => {
    return [...rootTasks]
      .filter((task) => !isDone(task))
      .sort((a, b) => {
        const score = (task: TaskItem) => (task.is_focus ? -30 : 0) + (isOverdue(task) ? -20 : 0) + (task.priority === 'urgent' ? -12 : task.priority === 'high' ? -8 : 0);
        if (score(a) !== score(b)) return score(a) - score(b);
        if (!a.due_date && !b.due_date) return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      })
      .slice(0, 7);
  }, [rootTasks]);

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
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.86)', color: '#6d28d9', fontSize: 12, fontWeight: 900, border: '1px solid #ede9fe', marginBottom: 10 }}>
                <Sparkles size={14} /> Canton mode · real app
              </div>
              <h1 style={{ margin: 0, color: '#0f172a', fontSize: 30, lineHeight: 1.08, letterSpacing: '-0.04em' }}>今日想先搞邊樣？</h1>
              <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 14 }}>用真實 task data 幫你睇：邊啲浮面、邊啲唔好漏。</p>
            </div>
            <button onClick={() => void loadTasks()} style={{ width: 44, height: 44, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 16, display: 'grid', placeItems: 'center', color: '#475569' }} aria-label="Refresh tasks">
              <RefreshCw size={18} />
            </button>
          </header>

          {loading ? (
            <div style={{ ...cardStyle, padding: 28, color: '#64748b', fontWeight: 700 }}>Loading Canton mode…</div>
          ) : (
            <>
              <section style={{ ...cardStyle, padding: 16, background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(251,247,255,0.94))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6d28d9', fontWeight: 900, fontSize: 14 }}><Waves size={17} /> 而家浮面嘅 task</div>
                  <button onClick={() => setShowModal(true)} style={{ width: 42, height: 42, borderRadius: 16, border: 'none', background: '#111827', color: '#fff', display: 'grid', placeItems: 'center' }}><Plus size={20} /></button>
                </div>

                <div style={{ position: 'relative', minHeight: 340, borderRadius: 30, overflow: 'auto', touchAction: 'pan-x pan-y pinch-zoom', background: 'radial-gradient(circle at 50% 42%, #fff 0%, #f7f2ff 44%, #edf6ff 100%)' }}>
                  <div style={{ position: 'absolute', inset: '44px 18px 58px', border: '2px dashed #e8ddff', borderRadius: '50%' }} />
                  <div style={{ position: 'absolute', inset: '80px 52px 68px', border: '2px dashed #efe7ff', borderRadius: '50%' }} />
                  {visibleTasks.length === 0 ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#64748b', padding: 28 }}>
                      <div><div style={{ fontSize: 28, marginBottom: 8 }}>🌙</div><strong>暫時冇浮面 task</strong><div style={{ marginTop: 6, fontSize: 13 }}>可以撳 + 加新 task。</div></div>
                    </div>
                  ) : visibleTasks.map((task, index) => (
                    <TaskBubble key={task.id} task={task} index={index} total={visibleTasks.length} allTasks={tasks} onClick={() => navigate(`/tasks/${task.id}`)} />
                  ))}
                </div>
              </section>

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
      {showModal && <TaskFormModal onClose={() => setShowModal(false)} onCreated={loadTasks} />}
    </AppShell>
  );
}

function TaskBubble({ task, index, total, allTasks, onClick }: { task: TaskItem; index: number; total: number; allTasks: TaskItem[]; onClick: () => void }) {
  const subtasks = allTasks.filter((item) => item.parent_id === task.id);
  const angle = total === 1 ? -90 : -150 + (300 / Math.max(total - 1, 1)) * index;
  const radius = index === 0 ? 0 : 180;
  const centerX = 50 + (Math.cos((angle * Math.PI) / 180) * radius) / 3.0;
  const centerY = 46 + (Math.sin((angle * Math.PI) / 180) * radius) / 3.6;
  const isFocusBubble = task.is_focus || index === 0;
  const size = isFocusBubble ? 136 : isOverdue(task) ? 96 : 80;
  const bg = isOverdue(task)
    ? 'radial-gradient(circle at 34% 24%, #fee2e2 0%, #fecaca 46%, #fca5a5 100%)'
    : task.is_focus
      ? 'radial-gradient(circle at 34% 24%, #f1e5ff 0%, #ddd0fe 50%, #c4b5fd 100%)'
      : 'radial-gradient(circle at 34% 24%, #e0f2fe 0%, #bae6fd 50%, #93c5fd 100%)';
  const driftDuration = isFocusBubble ? 9.5 : 7 + (index % 4) * 1.4;
  const driftDelay = `${index * -1.15}s`;
  return (
    <button className={isFocusBubble ? 'canton-focus-bubble' : 'canton-main-bubble'} onClick={onClick} style={{ position: 'absolute', left: `${centerX}%`, top: `${centerY}%`, width: size, height: size, transform: 'translate(-50%, -50%)', animation: `${isFocusBubble ? 'canton-focus-float' : 'canton-main-drift'} ${driftDuration}s ease-in-out infinite`, animationDelay: driftDelay, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.75)', background: bg, boxShadow: isFocusBubble ? '0 24px 48px rgba(124, 58, 237, 0.24)' : '0 18px 36px rgba(124, 58, 237, 0.18)', padding: 14, textAlign: 'center', cursor: 'pointer', color: '#3b0764' }}>
      <div style={{ position: 'absolute', left: '18%', top: '15%', width: '28%', height: '28%', borderRadius: '50%', background: 'rgba(255,255,255,0.18)' }} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: index === 0 ? 15 : 11, lineHeight: 1.15, fontWeight: 900, display: '-webkit-box', WebkitLineClamp: index === 0 ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.title}</div>
        <div style={{ marginTop: 5, fontSize: 10, fontWeight: 800, opacity: 0.82 }}>{dueLabel(task.due_date)}</div>
        {isFocusBubble && <div style={{ marginTop: 4, fontSize: 10, opacity: 0.78 }}>{assigneeLabel(task)}</div>}
      </div>
      {subtasks.slice(0, 8).map((subtask, subIndex) => {
        const subAngle = (360 / Math.max(Math.min(subtasks.length, 8), 1)) * subIndex - 90;
        const orbitRadius = size / 2 + 10;
        const dotSize = subtask.is_finished || subtask.status === 'done' ? 14 : 18;
        const orbitSpeed = 26 + subIndex * 2.5;
        return (
          <span
            key={subtask.id}
            className="canton-orbit-ring"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: orbitRadius * 2,
              height: orbitRadius * 2,
              transform: `translate(-50%, -50%) rotate(${subAngle}deg)`,
              transformOrigin: '50% 50%',
              animation: `canton-subtask-orbit ${orbitSpeed}s linear infinite`,
              animationDelay: `${subIndex * -2.4}s`,
              ['--orbit-start' as string]: `${subAngle}deg`,
              pointerEvents: 'none',
            }}
          >
            <span
              className="canton-orbit-dot"
              title={subtask.title}
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                width: dotSize,
                height: dotSize,
                transform: `translate(-50%, -50%) rotate(${-subAngle}deg)`,
                animation: `canton-subtask-counter-orbit ${orbitSpeed}s linear infinite`,
                animationDelay: `${subIndex * -2.4}s`,
                ['--orbit-start' as string]: `${subAngle}deg`,
                borderRadius: '50%',
                background: subtask.is_finished || subtask.status === 'done' ? '#22c55e' : '#8b5cf6',
                border: '2px solid #fff',
                boxShadow: '0 4px 12px rgba(15,23,42,0.2)',
              }}
            />
          </span>
        );
      })}
    </button>
  );
}

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#0f172a', fontSize: 15, fontWeight: 900 }}>{icon}{title}</div><span style={{ fontSize: 12, fontWeight: 900, color: '#64748b', background: '#f1f5f9', padding: '5px 9px', borderRadius: 999 }}>{count}</span></div>;
}

function MiniTask({ task, onClick }: { task: TaskItem; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: '100%', textAlign: 'left', padding: 13, borderRadius: 18, border: '1px solid #e5e7eb', background: isOverdue(task) ? '#fff7ed' : '#fff', marginBottom: 10, cursor: 'pointer' }}><div style={{ color: '#0f172a', fontSize: 14, fontWeight: 900, marginBottom: 5 }}>{task.title}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: '#64748b', fontSize: 11, fontWeight: 700 }}><span><CalendarDays size={11} /> {dueLabel(task.due_date)}</span><span><UserRound size={11} /> {assigneeLabel(task)}</span><span style={{ color: STATUS_META[task.status].color }}>{STATUS_META[task.status].label}</span></div></button>;
}

function RiskItem({ item, onClick }: { item: { label: string; detail: string; tone: 'danger' | 'warn' | 'info' }; onClick: () => void }) {
  const color = item.tone === 'danger' ? '#dc2626' : item.tone === 'warn' ? '#ea580c' : '#2563eb';
  const bg = item.tone === 'danger' ? '#fef2f2' : item.tone === 'warn' ? '#fff7ed' : '#eff6ff';
  return <button onClick={onClick} style={{ width: '100%', textAlign: 'left', padding: 13, borderRadius: 18, border: `1px solid ${item.tone === 'danger' ? '#fecaca' : '#fed7aa'}`, background: bg, marginBottom: 10, cursor: 'pointer' }}><div style={{ color, fontSize: 12, fontWeight: 900, marginBottom: 4 }}>{item.label}</div><div style={{ color: '#0f172a', fontSize: 14, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</div></button>;
}

function EmptyText({ text }: { text: string }) {
  return <div style={{ padding: 18, borderRadius: 18, background: '#f8fafc', color: '#64748b', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{text}</div>;
}

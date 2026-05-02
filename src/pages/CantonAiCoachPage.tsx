import { useEffect, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createTask, fetchProfiles, fetchTasks, updateTask, updateTaskAssignees } from '../lib/api';
import { AppShell } from '../components/AppShell';
import { STATUS_META, type Profile, type TaskItem, type TaskStatus } from '../types';

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(226,232,240,0.92)',
  borderRadius: 28,
  boxShadow: '0 16px 45px rgba(148, 163, 184, 0.16)',
};

function isDone(task: TaskItem) { return task.status === 'done' || task.is_finished; }
function isOverdue(task: TaskItem) {
  if (!task.due_date || isDone(task)) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date); due.setHours(0, 0, 0, 0);
  return due < today;
}
function isToday(task: TaskItem) {
  if (!task.due_date || isDone(task)) return false;
  return new Date().toDateString() === new Date(task.due_date).toDateString();
}
function isStale(task: TaskItem) {
  if (isDone(task)) return false;
  const updated = new Date(task.updated_at).getTime();
  return (Date.now() - updated) / (1000 * 60 * 60 * 24) >= 5;
}
function dueLabel(dueDate: string | null) {
  if (!dueDate) return '未 set deadline';
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return new Intl.DateTimeFormat('zh-HK', { month: 'numeric', day: 'numeric' }).format(due);
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}
function assigneeLabel(task: TaskItem) {
  if (!task.assignees.length) return '未分配';
  if (task.assignees.length === 1) return initials(task.assignees[0].name);
  return `${initials(task.assignees[0].name)} +${task.assignees.length - 1}`;
}

export function CantonAiCoachPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([
    { role: 'ai', text: '問我「有咩未交？」、「今日要搞咩？」或者輸入「加 task xxx」。我會幫你睇漏咗咩。' },
  ]);

  const loadTasks = async () => {
    setLoading(true);
    try { setTasks(await fetchTasks()); } finally { setLoading(false); }
  };

  useEffect(() => { void loadTasks(); fetchProfiles().then(setProfiles).catch(console.error); }, []);

  const rootTasks = tasks.filter((task) => !task.parent_id);
  const summarize = (items: TaskItem[], empty: string) => items.length ? items.slice(0, 8).map((task) => `• ${task.title}｜${dueLabel(task.due_date)}｜${assigneeLabel(task)}｜${STATUS_META[task.status].label}`).join('\n') : empty;

  const findTaskFromText = (lower: string) => {
    const normalized = lower.replace(/[，。？?！!、]/g, ' ');
    const numbers = normalized.match(/\d+/g) ?? [];
    const byNumber = numbers.length ? rootTasks.find((task) => numbers.some((num) => task.title.toLowerCase().includes(num))) : null;
    if (byNumber) return byNumber;

    const words = normalized.split(/\s+/).filter((word) => word.length >= 2 && !['task', 'deadline', 'status', 'progress'].includes(word));
    return rootTasks.find((task) => {
      const title = task.title.toLowerCase();
      return title.includes(normalized.trim()) || words.some((word) => title.includes(word));
    }) ?? null;
  };

  const missingInfoReply = (task: TaskItem) => {
    const missing: string[] = [];
    if (!task.due_date) missing.push('deadline');
    if (!task.assignees.length) missing.push('負責人');
    if (!task.description?.trim()) missing.push('description / scope');
    if (!task.today_update?.trim()) missing.push('今日進度');
    if (!task.next_day_focus?.trim()) missing.push('下一步');

    if (!missing.length) return `${task.title}\n暫時主要資料都齊：deadline、負責人、scope / update 都有。`;
    return `${task.title}\n仲差：${missing.join('、')}。\n而家狀態：${STATUS_META[task.status].label}｜${dueLabel(task.due_date)}｜${assigneeLabel(task)}`;
  };

  const parseDate = (lower: string) => {
    const today = new Date();
    const toIso = (date: Date) => date.toISOString().slice(0, 10);
    if (/今日|today/.test(lower)) return toIso(today);
    if (/聽日|明日|tomorrow/.test(lower)) { const d = new Date(today); d.setDate(d.getDate() + 1); return toIso(d); }
    const weekdayMap: Record<string, number> = { '星期日': 0, '禮拜日': 0, sun: 0, sunday: 0, '星期一': 1, '禮拜一': 1, mon: 1, monday: 1, '星期二': 2, '禮拜二': 2, tue: 2, tuesday: 2, '星期三': 3, '禮拜三': 3, wed: 3, wednesday: 3, '星期四': 4, '禮拜四': 4, thu: 4, thursday: 4, '星期五': 5, '禮拜五': 5, fri: 5, friday: 5, '星期六': 6, '禮拜六': 6, sat: 6, saturday: 6 };
    const weekday = Object.entries(weekdayMap).find(([key]) => lower.includes(key));
    if (weekday) {
      const target = weekday[1];
      const d = new Date(today);
      let delta = (target - d.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      d.setDate(d.getDate() + delta);
      return toIso(d);
    }
    const md = lower.match(/(\d{1,2})\s*[月/.-]\s*(\d{1,2})/);
    if (md) {
      const d = new Date(today.getFullYear(), Number(md[1]) - 1, Number(md[2]));
      return toIso(d);
    }
    return null;
  };

  const findProfileFromText = (lower: string) => profiles.find((profile) => {
    const name = profile.name.toLowerCase();
    const initialsText = profile.name.split(/\s+/).map((part) => part[0]).join('').toLowerCase();
    return lower.includes(name) || (initialsText.length >= 2 && lower.includes(initialsText)) || profile.name.split(/\s+/).some((part) => part.length >= 2 && lower.includes(part.toLowerCase()));
  }) ?? null;

  const parseStatus = (lower: string): TaskStatus | null => {
    if (/done|完成|搞掂/.test(lower)) return 'done';
    if (/planning|plan|準備|諗緊/.test(lower)) return 'planning';
    if (/progress|doing|wip|做緊|進行/.test(lower)) return 'in_progress';
    if (/review|睇緊|審/.test(lower)) return 'review';
    if (/todo|未開始/.test(lower)) return 'todo';
    return null;
  };

  const applyTaskActions = async (task: TaskItem, lower: string) => {
    const updates: Partial<{ due_date: string | null; status: TaskStatus; is_focus: boolean }> = {};
    const notes: string[] = [];
    const date = parseDate(lower);
    const profile = findProfileFromText(lower);
    const status = parseStatus(lower);

    if (date && /(deadline|due|交|前|星期|聽日|明日|today|tomorrow|\d{1,2}\s*[月/.-])/.test(lower)) {
      updates.due_date = date;
      notes.push(`deadline → ${dueLabel(date)}`);
    }
    if (/未定|冇 deadline|no deadline|clear deadline/.test(lower)) {
      updates.due_date = null;
      notes.push('deadline → 未定');
    }
    if (status) {
      updates.status = status;
      notes.push(`status → ${STATUS_META[status].label}`);
    }
    if (/focus|重點|優先|先搞/.test(lower)) {
      updates.is_focus = true;
      notes.push('focus → Yes');
    }
    if (/唔 focus|not focus|取消 focus/.test(lower)) {
      updates.is_focus = false;
      notes.push('focus → No');
    }

    if (Object.keys(updates).length) await updateTask(task.id, updates);
    if (profile) {
      await updateTaskAssignees(task.id, [profile.id]);
      notes.push(`負責人 → ${profile.name}`);
    }
    if (!notes.length) return null;
    await loadTasks();
    return `${task.title}\n已幫你更新：${notes.join('、')}`;
  };

  const getReply = async (text: string) => {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();
    const addMatch = trimmed.match(/^(?:加|add)\s*(?:task)?\s*[:：]?\s*(.+)$/i);
    if (addMatch?.[1]?.trim()) {
      const title = addMatch[1].trim();
      setSaving(true);
      try {
        await createTask({ title, description: '', status: 'todo', priority: 'medium', assignee_ids: [], tags: [], parent_id: null });
        await loadTasks();
        return `加咗：「${title}」。不過未有 deadline / assignee，我會當係風險位提醒你。`;
      } finally { setSaving(false); }
    }

    const matchedTask = findTaskFromText(lower) ?? (/佢|呢個|this|that/.test(lower) ? rootTasks.find((task) => task.id === lastTaskId) ?? null : null);
    if (matchedTask) {
      setLastTaskId(matchedTask.id);
      const actionReply = await applyTaskActions(matchedTask, lower);
      if (actionReply) return actionReply;
      const subtasks = tasks.filter((task) => task.parent_id === matchedTask.id);
      if (/差乜|未有|缺|missing|補|資料|仲差/.test(lower)) return missingInfoReply(matchedTask);
      return `${matchedTask.title}\n狀態：${STATUS_META[matchedTask.status].label}\nDeadline：${dueLabel(matchedTask.due_date)}\n負責：${assigneeLabel(matchedTask)}\nProgress：${matchedTask.is_finished ? 100 : (matchedTask.progress_percent ?? 0)}%\nSubtasks：${subtasks.length}`;
    }

    if (/未交|overdue|追|due|deadline|漏/.test(lower)) {
      const overdue = rootTasks.filter(isOverdue);
      const missingDeadline = rootTasks.filter((task) => !isDone(task) && !task.due_date);
      const missingAssignee = rootTasks.filter((task) => !isDone(task) && task.assignees.length === 0);
      return [
        overdue.length ? `已過 deadline，要先追：\n${summarize(overdue, '')}` : '暫時冇已過 deadline 嘅 main task。',
        missingDeadline.length ? `\n未 set deadline：\n${summarize(missingDeadline, '')}` : '',
        missingAssignee.length ? `\n未分配人：\n${summarize(missingAssignee, '')}` : '',
      ].filter(Boolean).join('\n');
    }
    if (/今日|today|now|而家/.test(lower)) return summarize(rootTasks.filter(isToday), '今日暫時冇 deadline task。');
    const risks = rootTasks.filter((task) => !isDone(task) && (isOverdue(task) || !task.due_date || task.assignees.length === 0 || isStale(task)));
    return risks.length ? `我會先提你呢幾樣：\n${summarize(risks, '')}` : '暫時冇明顯風險。';
  };

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || saving) return;
    setInput('');
    setMessages((current) => [...current, { role: 'user', text }]);
    try {
      const reply = await getReply(text);
      setMessages((current) => [...current, { role: 'ai', text: reply }]);
    } catch (error: any) {
      setMessages((current) => [...current, { role: 'ai', text: `處理唔到：${error?.message || 'Unknown error'}` }]);
    }
  };

  return (
    <AppShell>
      <div style={{ minHeight: 'calc(100vh - 48px)', margin: '-24px', padding: '24px 18px 130px', background: 'linear-gradient(180deg, #f0f9ff 0%, #f8fafc 100%)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 16 }}>
          <button onClick={() => navigate('/canton-mode')} style={{ border: 'none', background: 'transparent', color: '#475569', display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800, padding: 0 }}><ArrowLeft size={18} /> Back to Canton</button>
          <section style={{ ...cardStyle, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0369a1', fontWeight: 950, marginBottom: 8 }}><Sparkles size={18} /> AI Task Coach</div>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, letterSpacing: '-0.05em' }}>幫你追漏咗嘅 task。</h1>
            <p style={{ margin: '10px 0 0', color: '#64748b', fontSize: 16, fontWeight: 750 }}>加 task、問進度、睇 deadline，同埋搵出最要追嘅事。</p>
          </section>
          <section style={{ ...cardStyle, padding: 16 }}>
            {loading ? <div style={{ padding: 30, color: '#64748b', fontWeight: 800 }}>Loading tasks…</div> : null}
            <div style={{ display: 'grid', gap: 10, minHeight: 280, maxHeight: 440, overflow: 'auto', marginBottom: 12 }}>
              {messages.map((message, index) => <div key={index} style={{ justifySelf: message.role === 'user' ? 'end' : 'start', maxWidth: '88%', whiteSpace: 'pre-wrap', padding: '12px 14px', borderRadius: 18, background: message.role === 'user' ? '#111827' : '#f8fafc', color: message.role === 'user' ? '#fff' : '#0f172a', fontSize: 15, lineHeight: 1.5, fontWeight: 700 }}>{message.text}</div>)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {['有咩未交？', '今日要搞咩？', '邊啲冇 deadline？'].map((preset) => <button key={preset} onClick={() => void send(preset)} style={{ border: '1px solid #dbeafe', background: '#fff', color: '#0369a1', borderRadius: 999, padding: '9px 12px', fontSize: 13, fontWeight: 850 }}>{preset}</button>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} placeholder="問我 task 問題，或輸入：加 task xxx" style={{ border: '1px solid #dbeafe', borderRadius: 16, padding: '13px 14px', outline: 'none', fontSize: 15 }} />
              <button onClick={() => void send()} disabled={saving} style={{ border: 'none', borderRadius: 16, background: '#0f172a', color: '#fff', padding: '0 18px', fontWeight: 900, fontSize: 15 }}>{saving ? '加緊…' : 'Send'}</button>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

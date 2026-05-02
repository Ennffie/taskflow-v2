import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createTask, fetchProfiles, fetchTasks, updateTask, updateTaskAssignees } from '../lib/api';
import { supabase } from '../lib/supabase';
import { STATUS_META, type Profile, type TaskItem, type TaskStatus } from '../types';

type AddTaskFlow = {
  step: 'title' | 'deadline' | 'assignee' | 'confirm' | 'description';
  title?: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  description?: string;
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
function dateLabel(dateValue?: string | null) {
  if (!dateValue) return '—';
  return new Intl.DateTimeFormat('zh-HK', { month: 'numeric', day: 'numeric' }).format(new Date(dateValue));
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

const AI_BRIDGE_URL = 'https://considerable-comm-involved-fragrances.trycloudflare.com';

export function CantonAiCoachPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const composerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  const [addTaskFlow, setAddTaskFlow] = useState<AddTaskFlow | null>(null);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([
    { role: 'ai', text: '問我「有咩未交？」、「今日要搞咩？」或者輸入「加 task xxx」。我會幫你睇漏咗咩。' },
  ]);

  const loadTasks = async () => {
    setLoading(true);
    try { setTasks(await fetchTasks()); } finally { setLoading(false); }
  };

  useEffect(() => {
    void loadTasks();
    fetchProfiles().then(setProfiles).catch(console.error);
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null)).catch(console.error);
  }, []);

  useEffect(() => {
    window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 40);
  }, [messages, isReplying]);

  const rootTasks = tasks.filter((task) => !task.parent_id);
  const summarize = (items: TaskItem[], empty: string) => items.length ? items.slice(0, 8).map((task, index) => `${index + 1}. ${task.title}\n   Due date: ${dueLabel(task.due_date)}\n   Last update: ${dateLabel(task.updated_at)}`).join('\n\n') : empty;
  const isAssignedTo = (task: TaskItem, profile: Profile) => task.assignees.some((assignee) => assignee.id === profile.id || assignee.name.toLowerCase() === profile.name.toLowerCase());
  const myOpenTasks = () => rootTasks.filter((task) => !isDone(task) && task.assignees.some((assignee) => assignee.id === currentUserId));
  const scopedTasks = (lower: string) => /我|my/.test(lower) && currentUserId ? rootTasks.filter((task) => task.assignees.some((assignee) => assignee.id === currentUserId)) : rootTasks;
  const isQuestionLike = (lower: string) => /有無|有冇|有咩|有乜|邊啲|邊d|咩|乜|list|show|what|which|睇|搵|果啲|嗰啲|果d|嗰d|啲|\?|？/.test(lower);
  const isActionLike = (lower: string) => /改做|set|設做|轉做|mark|更新為|改成|變成|deadline\s*(去|做|係|為|:|：)|俾.+跟|assign/.test(lower);
  const explainFollowup = '要唔要我再列埋「未完成」或者「冇 due date」嗰啲？';
  const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
  const hasActionIntent = (lower: string) => Boolean(parseDate(lower) || findProfileFromText(lower) || (parseStatus(lower) && isActionLike(lower)) || /deadline|due|交|負責|俾|跟|assign|focus|重點|優先|未定|冇 deadline|clear deadline/.test(lower));
  const profileName = (id?: string | null) => profiles.find((profile) => profile.id === id)?.name ?? '未分配';
  const orderedProfiles = () => {
    const me = profiles.find((profile) => profile.id === currentUserId);
    return me ? [me, ...profiles.filter((profile) => profile.id !== currentUserId)] : profiles;
  };
  const profileTips = () => orderedProfiles().slice(0, 5).map((profile, index) => `${index + 1} ${index === 0 && profile.id === currentUserId ? `${profile.name}（自己）` : profile.name}`).join('\n');

  const findTaskFromText = (lower: string) => {
    const normalized = lower.replace(/[，。？?！!、]/g, ' ');
    const compactText = compact(normalized);
    const numbers = normalized.match(/\d+/g) ?? [];
    const byNumber = numbers.length ? rootTasks.find((task) => numbers.some((num) => task.title.toLowerCase().includes(num))) : null;
    if (byNumber) return byNumber;

    const words = normalized.split(/\s+/).filter((word) => word.length >= 2 && !['task', 'deadline', 'status', 'progress'].includes(word));
    return rootTasks.find((task) => {
      const title = task.title.toLowerCase();
      const compactTitle = compact(title);
      return title.includes(normalized.trim()) || compactTitle.includes(compactText) || words.some((word) => title.includes(word) || compactTitle.includes(compact(word)));
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
    const iso = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (iso) return iso[1];
    // English month: "31 may", "may 31", "31st may"
    const enMonthMap: Record<string, number> = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
    const enMatch = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,})/) || lower.match(/([a-z]{3,})\s+(\d{1,2})(?:st|nd|rd|th)?/);
    if (enMatch) {
      const day = Number(enMatch[1].match(/\d+/)?.[0] || enMatch[2].match(/\d+/)?.[0]);
      const monthStr = enMatch[1].match(/[a-z]+/)?.[0] || enMatch[2].match(/[a-z]+/)?.[0];
      if (monthStr) {
        const month = enMonthMap[monthStr.slice(0, 3)];
        if (month !== undefined && day >= 1 && day <= 31) {
          const d = new Date(today.getFullYear(), month, day);
          return toIso(d);
        }
      }
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

  const handleAddTaskFlow = async (text: string, flow: AddTaskFlow) => {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();
    if (/取消|cancel|唔加|不用/.test(lower)) {
      setAddTaskFlow(null);
      return '好，取消咗新增 task。';
    }
    if (flow.step !== 'title' && /改.*(task name|task名|標題|名)/.test(lower)) {
      setAddTaskFlow({ ...flow, step: 'title' });
      return '好啊，改返 Task name。\n\n新 task name 係咩？';
    }
    if (flow.step !== 'deadline' && /改.*(due|deadline|日期|時間)|due date|deadline/.test(lower)) {
      setAddTaskFlow({ ...flow, step: 'deadline' });
      return '好，改 due date。\n\nDeadline 想點 set？\n1 今日\n2 聽日\n3 揀日期\n0 未定\n或者直接打「星期五 / 5月8」。';
    }
    if (flow.step !== 'assignee' && /改.*(人|負責|邊個|assignee)|負責人|邊個做/.test(lower)) {
      setAddTaskFlow({ ...flow, step: 'assignee' });
      return `好，改負責人。\n\n邊個做？\n${profileTips()}\n0 未分配\n或者直接打人名。`;
    }

    if (flow.step === 'title') {
      if (/^(取消|cancel|唔加|stop)$/i.test(trimmed)) {
        setAddTaskFlow(null);
        return '取消咗，冇加新 task。';
      }
      if (/我要加\s*task|加task$|add task$/.test(lower)) return '好啊，已經準備緊加 task。\n\n直接打個 Task name 就得。';
      const title = trimmed.replace(/^(?:加|add)\s*(?:task)?\s*[:：]?\s*/i, '').trim();
      if (!title) return 'Task name 係咩？直接打名就得。';
      setAddTaskFlow({ step: 'deadline', title });
      return '好啊！\n\nDeadline 想點 set？\n1 今日\n2 聽日\n3 揀日期\n0 未定\n或者直接打「星期五 / 5月8」。';
    }

    if (flow.step === 'deadline') {
      const isNoDeadline = /^0\b/.test(lower) || /未定|no|冇/.test(lower);
      const parsedDate = /^1\b/.test(lower) ? parseDate('今日') : /^2\b/.test(lower) ? parseDate('聽日') : parseDate(lower);
      if (!isNoDeadline && !parsedDate) {
        const isOffTopic = /\?|what|who|why|how|name|you|your|hello|hi/.test(lower) && !/今日|聽日|明日|tomorrow|deadline|due|日期/.test(lower);
        if (isOffTopic) return '我係 TaskFlow AI Coach，幫你管理同追 task 嘅。你而家喺緊加 task，可以講返個 deadline，例如「聽日」或者「5月8」。';
        return 'Deadline 我未睇明，可以揀：\n1 今日\n2 聽日\n3 揀日期\n0 未定\n或者直接打「31 may / 5月8」。';
      }
      const dueDate = isNoDeadline ? null : parsedDate;
      setAddTaskFlow({ ...flow, step: 'assignee', dueDate });
      return `Deadline：${dueLabel(dueDate)}\n\n邊個做？\n${profileTips()}\n0 未分配\n或者直接打人名。`;
    }

    if (flow.step === 'assignee') {
      const numeric = trimmed.match(/^\d+/)?.[0];
      const pickedByNumber = numeric && numeric !== '0' ? orderedProfiles()[Number(numeric) - 1] : null;
      const picked = pickedByNumber ?? findProfileFromText(lower);
      const assigneeId = numeric === '0' || /未分配|skip|no/.test(lower) ? null : picked?.id;
      if (assigneeId === undefined) return `負責人我未 match 到，可以揀：\n${profileTips()}\n0 未分配`;
      setAddTaskFlow({ ...flow, step: 'confirm', assigneeId });
      return `Confirm 新 task：\n${flow.title}\nDue date: ${dueLabel(flow.dueDate ?? null)}\nAssignee: ${profileName(assigneeId)}\n\n1 確認建立\n2 取消`;
    }

    if (flow.step === 'confirm') {
      const isConfirm = /^1\b|確認|confirm|ok|好/.test(lower);
      const wantsMore = /description|desc|detail|更多|補充|補資料|想加|加多/.test(lower);
      const newDate = parseDate(lower);
      const safeTitle = flow.title || '未命名 task';
      if (newDate && !isConfirm) {
        setAddTaskFlow({ ...flow, step: 'confirm', dueDate: newDate });
        return `Due date 改做 ${dueLabel(newDate)}。Confirm：\n${safeTitle}\nDue: ${dueLabel(newDate)}\nAssignee: ${profileName(flow.assigneeId)}\n\n1 確認建立\n2 取消`;
      }
      if (wantsMore && !isConfirm) {
        setAddTaskFlow({ ...flow, step: 'description' });
        return '想加 description？直接打內容，或者打「skip」唔加。';
      }
      if (!isConfirm) return '未建立。你可以揀：\n1 確認建立\n2 取消\n或者直接講「加 description」或者改 due date。';
      setSaving(true);
      try {
        await createTask({ title: safeTitle, description: flow.description ?? '', status: 'todo', priority: 'medium', due_date: flow.dueDate ?? undefined, assignee_ids: flow.assigneeId ? [flow.assigneeId] : [], tags: [], parent_id: null });
        await loadTasks();
        setAddTaskFlow(null);
        return `加咗：${safeTitle}\nDue date: ${dueLabel(flow.dueDate ?? null)}\nAssignee: ${profileName(flow.assigneeId)}${flow.description ? `\nDescription: ${flow.description.slice(0, 40)}${flow.description.length > 40 ? '...' : ''}` : ''}`;
      } finally { setSaving(false); }
    }

    if (flow.step === 'description') {
      if (/skip|唔加|取消|no/.test(lower)) {
        setAddTaskFlow({ ...flow, step: 'confirm' });
        return `Confirm 新 task：\n${flow.title}\nDue date: ${dueLabel(flow.dueDate ?? null)}\nAssignee: ${profileName(flow.assigneeId)}\n\n1 確認建立\n2 取消`;
      }
      setAddTaskFlow({ ...flow, description: trimmed, step: 'confirm' });
      return `已加 description。Confirm 新 task：\n${flow.title}\nDue: ${dueLabel(flow.dueDate ?? null)}\nAssignee: ${profileName(flow.assigneeId)}\n\n1 確認建立\n2 取消`;
    }

    return '我未睇明，試吓答返上一步，或者打「取消」。';
  };

  const getReply = async (text: string) => {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // Try AI bridge first
    try {
      const resp = await fetch(`${AI_BRIDGE_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      if (resp.ok) {
        const intent = await resp.json();
        if (intent.intent === 'list_tasks') {
          const filter = intent.filter;
          const scope = intent.scope;
          const assigneeName = intent.assignee;
          const pool = scope === 'my' && currentUserId
            ? rootTasks.filter((task) => task.assignees.some((a) => a.id === currentUserId))
            : assigneeName
              ? rootTasks.filter((task) => task.assignees.some((a) => a.name.toLowerCase() === assigneeName.toLowerCase()))
              : rootTasks;
          const items = filter === 'done'
            ? pool.filter(isDone)
            : filter === 'overdue'
              ? pool.filter(isOverdue)
              : filter === 'open'
                ? pool.filter((task) => !isDone(task))
                : pool;
          const scopeLabel = scope === 'my' ? '你' : assigneeName || '全部';
          const filterLabel = filter === 'done' ? '已完成' : filter === 'overdue' ? '已過 deadline' : filter === 'open' ? '未完成' : '';
          return `${scopeLabel} ${filterLabel} task：\n${summarize(items, `暫時冇 ${filterLabel} task。`)}`;
        }
        if (intent.intent === 'update_task' && intent.task_ref) {
          const task = findTaskFromText(intent.task_ref);
          if (task) {
            const field = intent.field;
            const value = intent.value;
            if (field === 'status') await updateTask(task.id, { status: value });
            if (field === 'due_date') await updateTask(task.id, { due_date: value === 'null' ? null : value });
            if (field === 'assignee') {
              const profile = profiles.find((p) => p.name.toLowerCase() === value.toLowerCase());
              if (profile) await updateTaskAssignees(task.id, [profile.id]);
            }
            await loadTasks();
            return `${task.title}\n已更新 ${field} → ${value}`;
          }
        }
        if (intent.intent === 'query_missing' && intent.task_ref) {
          const task = findTaskFromText(intent.task_ref);
          if (task) return missingInfoReply(task);
        }
        if (intent.intent === 'add_task' && intent.title) {
          const title = intent.title;
          const dueDate = intent.due_date === 'next_friday' ? parseDate('星期五') : intent.due_date;
          const assigneeName = intent.assignee;
          const profile = assigneeName ? profiles.find((p) => p.name.toLowerCase() === assigneeName.toLowerCase()) : null;
          const assigneeId = profile ? profile.id : null;
          if (dueDate && assigneeId) {
            setAddTaskFlow({ step: 'confirm', title, dueDate, assigneeId });
            return `Confirm 新 task：\n${title}\nDue date: ${dueLabel(dueDate)}\nAssignee: ${profileName(assigneeId)}\n\n1 確認建立\n2 取消`;
          } else if (dueDate) {
            setAddTaskFlow({ step: 'assignee', title, dueDate });
            return `Deadline：${dueLabel(dueDate)}\n\n邊個做？\n${profileTips()}\n0 未分配\n或者直接打人名。`;
          } else {
            setAddTaskFlow({ step: 'deadline', title });
            return '好啊！\n\nDeadline 想點 set？\n1 今日\n2 聽日\n3 揀日期\n0 未定\n或者直接打「星期五 / 5月8」。';
          }
        }
      }
    } catch {
      /* fallback to rule-based */
    }

    const mentionedProfile = findProfileFromText(lower);
    const statusQuery = parseStatus(lower);
    if (addTaskFlow) return handleAddTaskFlow(trimmed, addTaskFlow);

    if (pendingDeleteTaskId) {
      const isConfirm = /^(1|確認|confirm|yes|係|y)$/i.test(trimmed);
      const isCancel = /^(2|取消|cancel|no|唔|n)$/i.test(trimmed);
      if (isConfirm) {
        const target = rootTasks.find((t) => t.id === pendingDeleteTaskId);
        setPendingDeleteTaskId(null);
        if (target) {
          try {
            const { deleteTask } = await import('../lib/api');
            await deleteTask(target.id);
            await loadTasks();
            return `已刪除「${target.title}」。`;
          } catch (e: any) {
            return `刪除失敗：${e?.message || 'Unknown error'}`;
          }
        }
        return '找不到該 task。';
      }
      if (isCancel) {
        setPendingDeleteTaskId(null);
        return '取消咗，冇刪除。';
      }
      return '係咪確認刪除？\n1 確認刪除\n2 取消';
    }

    if (/我要加\s*task|加task$|add task$/.test(lower)) {
      setAddTaskFlow({ step: 'title' });
      return '好呀，逐條問你，快啲。\n\nTask name 係咩？';
    }
    if (/my task list|my tasks|我的 task|我有咩|我有乜|我啲 task|我啲task/.test(lower)) return `你未完成嘅 task：\n${summarize(myOpenTasks(), '暫時冇 assign 咗俾你嘅未完成 main task。')}`;
    if (/今日重點|today focus|今日 focus|今日focus/.test(lower)) {
      const todayFocus = rootTasks.filter((task) => !isDone(task) && (isToday(task) || task.is_focus));
      return `今日重點：\n${summarize(todayFocus, '今日暫時冇 deadline / focus task。')}`;
    }
    if (/^(有野|有嘢)\s*update$|^update$|^更新$/.test(lower)) return '想 update 邊個 task？可以直接打：\n「CRCE1357 今日已交俾 PC review」\n或者「1357 改做 in progress」。';

    if (statusQuery && isQuestionLike(lower) && !isActionLike(lower)) {
      const pool = mentionedProfile ? rootTasks.filter((task) => isAssignedTo(task, mentionedProfile)) : scopedTasks(lower);
      const statusTasks = pool.filter((task) => statusQuery === 'done' ? isDone(task) : task.status === statusQuery && !isDone(task));
      const scopeText = mentionedProfile ? mentionedProfile.name : /我|my/.test(lower) ? '你' : '全部';
      return `${scopeText} ${STATUS_META[statusQuery].label} task：\n${summarize(statusTasks, `暫時冇 ${STATUS_META[statusQuery].label} task。`)}\n\n${explainFollowup}`;
    }

    const addMatch = trimmed.match(/^(?:加|add)\s*(?:task)?\s*[:：]?\s*(.+)$/i);
    if (addMatch?.[1]?.trim()) {
      const title = addMatch[1].trim();
      setAddTaskFlow({ step: 'deadline', title });
      return '好啊！\n\nDeadline 想點 set？\n1 今日\n2 聽日\n3 揀日期\n0 未定\n或者直接打「星期五 / 5月8」。';
    }

    if (mentionedProfile && /有乜|有咩|要做|跟|負責|assigned|task|tasks|todo|做乜/.test(lower)) {
      const assignedTasks = rootTasks.filter((task) => !isDone(task) && isAssignedTo(task, mentionedProfile));
      return assignedTasks.length
        ? `${mentionedProfile.name} 要跟呢啲：\n${summarize(assignedTasks, '')}`
        : `${mentionedProfile.name} 暫時冇未完成 main task。`;
    }

    const previousTask = rootTasks.find((task) => task.id === lastTaskId) ?? null;
    const matchedTask = findTaskFromText(lower) ?? (/佢|呢個|this|that/.test(lower) || hasActionIntent(lower) ? previousTask : null);
    if (matchedTask) {
      setLastTaskId(matchedTask.id);
      if (/delete|del|刪除|remove|取消/i.test(lower) && !/加|add/i.test(lower)) {
        setPendingDeleteTaskId(matchedTask.id);
        return `係咪刪除「${matchedTask.title}」？\n1 確認刪除\n2 取消`;
      }
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

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const revealAiReply = async (reply: string) => {
    setMessages((current) => [...current, { role: 'ai', text: '諗緊…' }]);
    await wait(1250);

    const step = Math.max(1, Math.ceil(reply.length / 90));
    for (let index = step; index < reply.length; index += step) {
      const partial = reply.slice(0, index);
      setMessages((current) => current.map((message, messageIndex) => messageIndex === current.length - 1 ? { ...message, text: partial } : message));
      await wait(22);
    }
    setMessages((current) => current.map((message, messageIndex) => messageIndex === current.length - 1 ? { ...message, text: reply } : message));
  };

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || saving || isReplying) return;
    const showUserBubble = !(preset && !addTaskFlow && /我要加\s*task|加task$|add task$/i.test(preset));
    setInput('');
    if (composerRef.current) composerRef.current.textContent = '';
    if (showUserBubble) setMessages((current) => [...current, { role: 'user', text }]);
    setIsReplying(true);
    try {
      const reply = await getReply(text);
      await revealAiReply(reply);
    } catch (error: any) {
      await revealAiReply(`處理唔到：${error?.message || 'Unknown error'}`);
    } finally {
      setIsReplying(false);
    }
  };

  const openDatePicker = () => {
    // Remove any existing temp picker
    const existing = document.getElementById('temp-date-picker');
    if (existing) existing.remove();

    const input = document.createElement('input');
    input.type = 'date';
    input.id = 'temp-date-picker';
    input.style.cssText = 'position:fixed;top:50%;left:0;width:100%;height:60px;opacity:0.01;z-index:99999;pointer-events:auto;border:none;outline:none;';
    input.onchange = (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (val) void send(val);
      setTimeout(() => input.remove(), 50);
    };
    // Blur composer first so iOS Safari allows the new input to take focus
    if (document.activeElement && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.appendChild(input);
    // Small delay after blur before clicking, helps iOS Safari
    window.setTimeout(() => {
      input.click();
      input.focus();
    }, 50);
    // Fallback cleanup
    window.setTimeout(() => {
      if (document.getElementById('temp-date-picker')) input.remove();
    }, 30000);
  };

  const handleQuickAction = (preset: string) => {
    if (addTaskFlow?.step === 'deadline' && preset.startsWith('3')) {
      openDatePicker();
      return;
    }
    void send(preset);
  };

  const renderMessageText = (text: string, role: 'ai' | 'user') => {
    if (role === 'user') return text;
    return text.split('\n').map((line, index) => {
      const isTaskName = /^\d+\.\s/.test(line);
      const isHeading = index === 0 && /：$/.test(line.trim());
      return (
        <span key={`${line}-${index}`} style={{ display: 'block', fontWeight: isTaskName || isHeading ? 900 : 500, marginTop: isTaskName && index > 0 ? 16 : 0 }}>
          {line || ' '}
        </span>
      );
    });
  };

  const quickActions = pendingDeleteTaskId
    ? ['1 確認刪除', '2 取消']
    : addTaskFlow?.step === 'title'
      ? ['取消']
      : addTaskFlow?.step === 'deadline'
        ? ['1 今日', '2 聽日', '3 揀日期', '0 未定']
        : addTaskFlow?.step === 'assignee'
          ? [...orderedProfiles().slice(0, 4).map((profile, index) => `${index + 1} ${index === 0 && profile.id === currentUserId ? '自己' : profile.name.split(/\s+/)[0]}`), '0 未分配']
          : addTaskFlow?.step === 'description'
            ? ['skip 唔加']
            : addTaskFlow?.step === 'confirm'
              ? ['1 確認建立', '2 取消']
              : ['我要加Task', 'My Task list', '今日重點', '有野update'];

  return (
    <div style={{ minHeight: '100vh', height: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr auto', background: 'linear-gradient(180deg, #f0f9ff 0%, #f8fafc 100%)', overflow: 'hidden' }}>
      <header style={{ padding: '14px 16px 10px', background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(226,232,240,0.9)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button onClick={() => navigate('/canton-mode')} style={{ border: 'none', background: 'transparent', color: '#475569', display: 'flex', gap: 8, alignItems: 'center', fontWeight: 900, padding: 0 }}><ArrowLeft size={18} /> Canton</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#0369a1', fontWeight: 950 }}><Sparkles size={17} /> AI Coach</div>
        </div>
      </header>

      <main style={{ overflowY: 'auto', padding: '14px 16px 12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'flex-end', width: '100%' }}>
          {loading ? <div style={{ padding: 14, color: '#64748b', fontWeight: 800 }}>Loading tasks…</div> : null}
          {messages.map((message, index) => <div key={index} style={{ justifySelf: message.role === 'user' ? 'end' : 'start', alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', whiteSpace: 'pre-wrap', padding: message.role === 'user' ? '13px 15px' : '16px 17px', borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '20px 20px 20px 4px', background: message.role === 'user' ? '#111827' : '#fff', color: message.role === 'user' ? '#fff' : '#0f172a', fontSize: message.role === 'user' ? 16 : 17, lineHeight: 1.48, fontWeight: message.role === 'user' ? 800 : 500, letterSpacing: '-0.01em', boxShadow: message.role === 'user' ? 'none' : '0 8px 24px rgba(148,163,184,0.12)' }}>{renderMessageText(message.text, message.role)}</div>)}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer style={{ padding: '10px 16px calc(12px + env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(18px)', borderTop: '1px solid rgba(226,232,240,0.9)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            {addTaskFlow?.step === 'deadline' ? (
              <>
                <button onClick={() => void send('1 今日')} style={{ flexShrink: 0, border: '1px solid #dbeafe', background: '#fff', color: '#0369a1', borderRadius: 999, padding: '8px 11px', fontSize: 13, fontWeight: 850 }}>1 今日</button>
                <button onClick={() => void send('2 聽日')} style={{ flexShrink: 0, border: '1px solid #dbeafe', background: '#fff', color: '#0369a1', borderRadius: 999, padding: '8px 11px', fontSize: 13, fontWeight: 850 }}>2 聽日</button>
                <label style={{ flexShrink: 0, position: 'relative', border: '1px solid #dbeafe', background: '#fff', color: '#0369a1', borderRadius: 999, padding: '8px 11px', fontSize: 13, fontWeight: 850, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="date"
                    onChange={(e) => { if (e.target.value) { void send(e.target.value); e.target.value = ''; } }}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 1 }}
                  />
                  3 揀日期
                </label>
                <button onClick={() => void send('0 未定')} style={{ flexShrink: 0, border: '1px solid #dbeafe', background: '#fff', color: '#0369a1', borderRadius: 999, padding: '8px 11px', fontSize: 13, fontWeight: 850 }}>0 未定</button>
              </>
            ) : (
              quickActions.map((preset) => <button key={preset} onClick={() => handleQuickAction(preset)} style={{ flexShrink: 0, border: '1px solid #dbeafe', background: '#fff', color: '#0369a1', borderRadius: 999, padding: '8px 11px', fontSize: 13, fontWeight: 850 }}>{preset}</button>)
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              {!input ? <span style={{ position: 'absolute', left: 15, top: 14, color: '#94a3b8', fontSize: 16, pointerEvents: 'none' }}>問 task / 補 deadline / 加 task</span> : null}
              <div
                ref={composerRef}
                contentEditable={!saving && !isReplying}
                role="textbox"
                aria-label="AI message"
                onInput={(e) => setInput(e.currentTarget.textContent ?? '')}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                style={{ minHeight: 22, maxHeight: 96, overflowY: 'auto', border: '1px solid #dbeafe', borderRadius: 18, padding: '14px 15px', outline: 'none', fontSize: 16, lineHeight: 1.35, background: '#fff', WebkitUserSelect: 'text', userSelect: 'text' }}
              />
            </div>
            <button onClick={() => void send()} disabled={saving || isReplying} style={{ border: 'none', borderRadius: 18, background: '#0f172a', color: '#fff', padding: '0 18px', fontWeight: 950, fontSize: 16, opacity: saving || isReplying ? 0.72 : 1 }}>{saving ? '加緊…' : isReplying ? '諗緊…' : 'Send'}</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

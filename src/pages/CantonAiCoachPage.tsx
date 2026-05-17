import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createTask, fetchProfiles, fetchTasksForCantonAi, updateTask, updateTaskAssignees, deleteTask, fetchBridgeUrl, createTaskEventLog, fetchAllLogs } from '../lib/api';
import { buildTrackerRows } from '../lib/report';
import { exportTrackerWorkbook } from '../lib/reportWorkbook';
import { supabase } from '../lib/supabase';
import { VersionBadge } from '../components/VersionBadge';
import { BackButton } from '../components/BackButton';
import { generateLocalChatReply, type LocalModelId } from '../lib/localOllamaChat';
import { tryBuildDeterministicSummary } from '../lib/cantonSummary';
import { buildDecisionContext } from '../lib/cantonDecisionContext';
import { getStatusMeta } from '../types';
import type { LogEntry, Profile, Role, TaskItem, TaskStatus } from '../types';
import { SubtaskInlineEdit } from '../components/SubtaskInlineEdit';
import { TaskFormModal } from '../components/TaskFormModal';

// Fallback bridge URL if Supabase config is not available
const FALLBACK_BRIDGE_URL = 'https://ai.ans67.xyz';
const LOCAL_ONLY_MODE = true;
const FIXED_LOCAL_MODEL: LocalModelId = 'qwen2.5:3b';

export function CantonAiCoachPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<Role>('member');
  const [input, setInput] = useState('');
  const [bridgeUrl, setBridgeUrl] = useState<string>(FALLBACK_BRIDGE_URL);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  // pendingConfirm removed - using message._action instead

  const [typingTarget, setTypingTarget] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typedMessageMeta, setTypedMessageMeta] = useState<{ _action?: string; _data?: any } | null>(null);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [revealedTaskListCounts, setRevealedTaskListCounts] = useState<Record<string, number>>({});
  const [streamingTaskListMessageId, setStreamingTaskListMessageId] = useState<string | null>(null);
  const [streamingReportMessageId, setStreamingReportMessageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ id?: string; role: 'ai' | 'user'; text: string; _action?: string; _data?: any }[]>([]);
  const [introText, setIntroText] = useState('');
  const [introTypingIndex, setIntroTypingIndex] = useState(0);
  const [pendingTaskAction, setPendingTaskAction] = useState<{ taskId: string; title: string; kind: 'today' | 'tomorrow' | 'blocker' | 'progress_update' } | null>(null);
  const [reportEditorState, setReportEditorState] = useState<{ taskId: string; title: string; field: 'today' | 'tomorrow' | 'blocker'; text: string } | null>(null);
  const [dueDatePicker, setDueDatePicker] = useState<{ taskId: string; title: string; value: string } | null>(null);
  const [lockedCreateActions, setLockedCreateActions] = useState<Record<string, 'confirming' | 'cancelled'>>({});
  // expandedMoreTaskId / statusPickerTaskId removed — now using openPanel accordion
  const [assigneePickerTaskId, setAssigneePickerTaskId] = useState<string | null>(null);
  const [subtaskComposerTaskId, setSubtaskComposerTaskId] = useState<string | null>(null);
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({});
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const [progressSlider, setProgressSlider] = useState<{ taskId: string; title: string; value: number } | null>(null);
  const [editingTaskFromChat, setEditingTaskFromChat] = useState<TaskItem | null>(null);
  const [myLogs, setMyLogs] = useState<LogEntry[]>([]);
  const [reportLogDate, setReportLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [collapsedNoReportSection, setCollapsedNoReportSection] = useState(true);
  const [revealedReportCounts, setRevealedReportCounts] = useState<Record<string, { withLogs: number; withoutLogs: number }>>({});
  // Track which inline panel is open per task (accordion behavior)
  const [openPanel, setOpenPanel] = useState<{ taskId: string; panel: 'status' | 'more' | 'progress' | null }>({ taskId: '', panel: null });
  // Track expanded subtask (only one at a time)
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null);
  const [taskListVisibleCounts, setTaskListVisibleCounts] = useState<Record<string, number>>({});
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [composerHeight, setComposerHeight] = useState(190);
  const [lastLifeReply, setLastLifeReply] = useState<string>('');
  const keyboardAdjustRafRef = useRef<number | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const createModeRef = useRef<CreateMode>('idle');
  const [lastReplyType, setLastReplyType] = useState<'life' | 'task' | null>(null);
  // Refs for scrolling to inline panels
  const statusPickerRef = useRef<HTMLDivElement | null>(null);
  const assigneePickerRef = useRef<HTMLDivElement | null>(null);
  const subtaskComposerRef = useRef<HTMLDivElement | null>(null);
  const morePanelRef = useRef<HTMLDivElement | null>(null);
  const reportAnchorRef = useRef<HTMLDivElement | null>(null);
  // ── Guided creation flow ──
  type CreateMode = 'idle' | 'main' | 'subtask';
  type QuickAction = 'search' | 'add' | 'focus' | 'my-task' | 'report-log' | 'free-talk' | null;
  const [, setCreateMode] = useState<CreateMode>('idle');
  const [activeQuickAction, setActiveQuickAction] = useState<QuickAction>(null);
  const [guidedStep, setGuidedStep] = useState(0); // main: 0:title 1:desc | subtask: -1 parent 0:title 1:desc 2:assignee 3:due 4:confirm
  const [guidedDraft, setGuidedDraft] = useState<{
    title: string; description: string; assignee: string; dueDate: string; dueLabel: string; parentTaskId: string | null;
  }>({ title: '', description: '', assignee: '', dueDate: '', dueLabel: '', parentTaskId: null });

  const startTypingMessage = (text: string, meta?: { _action?: string; _data?: any }) => {
    const id = `typing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setTypedMessageMeta(meta ?? null);
    setTypingMessageId(id);
    setTypingTarget(text);
    setTypingIndex(0);
    setIsTyping(true);
    setRevealedTaskListCounts(current => ({ ...current, [id]: 0 }));
    setRevealedReportCounts(current => ({ ...current, [id]: { withLogs: 0, withoutLogs: 0 } }));
    setMessages(current => [...current, { id, role: 'ai', text: '', ...(meta ?? {}) }]);
  };

  // Load bridge URL from Supabase on mount
  useEffect(() => {
    fetchBridgeUrl().then(url => {
      if (url) {
        console.log('[CantonAI] Bridge URL from Supabase:', url);
        setBridgeUrl(url);
      } else {
        console.log('[CantonAI] Using fallback bridge URL');
      }
    });
  }, []);

  const loadTasks = async () => {
    try { 
      const fetchedTasks = await fetchTasksForCantonAi();
      console.log('[CantonAI::v2335] Tasks loaded:', fetchedTasks.length);
      setTasks(fetchedTasks); 
      return fetchedTasks;
    } catch (e) { console.error(e); return null; }
  };

  const loadLogs = async () => {
    try {
      const fetchedLogs = await fetchAllLogs();
      setMyLogs(fetchedLogs);
      return fetchedLogs;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  useEffect(() => {
    void loadTasks();
    void loadLogs();
    fetchProfiles().then((fetchedProfiles) => {
      console.log('[CantonAI] Profiles loaded:', fetchedProfiles.map(p => ({name: p.name, id: p.id})));
      console.log('[CantonAI] Total profiles:', fetchedProfiles.length);
      setProfiles(fetchedProfiles);
    }).catch((err) => {
      console.error('[CantonAI] fetchProfiles ERROR:', err);
    });
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.name || data.user?.email?.split('@')[0] || 'User';
      setCurrentUserId(data.user?.id ?? null);
      setCurrentUserName(name);
      // Initial welcome should render directly as bottom intro card, not normal chat message
      setTimeout(() => {
        const welcome = `參見 ${name.split(' ')[0]} 大人~\n小人係Silly，有咩吩咐儘管開聲～`;
        setIntroText(welcome);
        setIntroTypingIndex(0);
      }, 300);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const matchedProfile = profiles.find((profile) => profile.id === currentUserId);
    if (matchedProfile?.role) {
      setCurrentUserRole(matchedProfile.role);
    }
  }, [profiles, currentUserId]);

  useEffect(() => {
    if (!isTyping || !typingMessageId) return;

    if (typingIndex >= typingTarget.length) {
      setMessages(current => current.map(message =>
        message.id === typingMessageId
          ? { ...message, text: typingTarget, ...(typedMessageMeta ?? {}) }
          : message
      ));
      setIsTyping(false);
      if (typedMessageMeta?._action === 'task_list' && typingMessageId) {
        setStreamingTaskListMessageId(typingMessageId);
      }
      if (typedMessageMeta?._action === 'report_log_list' && typingMessageId) {
        setStreamingReportMessageId(typingMessageId);
      }
      setTypingTarget('');
      setTypingIndex(0);
      setTypedMessageMeta(null);
      setTypingMessageId(null);
      return;
    }

    setMessages(current => current.map(message =>
      message.id === typingMessageId
        ? { ...message, text: typingTarget.slice(0, typingIndex) }
        : message
    ));

    const timer = setTimeout(() => {
      setTypingIndex(prev => prev + 1);
    }, 18);
    return () => clearTimeout(timer);
  }, [isTyping, typingIndex, typingTarget, typedMessageMeta, typingMessageId]);

  useEffect(() => {
    if (!streamingTaskListMessageId) return;

    const message = messages.find(item => item.id === streamingTaskListMessageId);
    const tasksToReveal = message?._data?.tasks;
    if (!tasksToReveal?.length) {
      setStreamingTaskListMessageId(null);
      return;
    }

    const currentCount = revealedTaskListCounts[streamingTaskListMessageId] ?? 0;
    if (currentCount >= tasksToReveal.length) {
      setStreamingTaskListMessageId(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setRevealedTaskListCounts(current => ({
        ...current,
        [streamingTaskListMessageId]: Math.min(tasksToReveal.length, (current[streamingTaskListMessageId] ?? 0) + 1),
      }));
    }, currentCount === 0 ? 120 : 180);

    return () => window.clearTimeout(timer);
  }, [streamingTaskListMessageId, messages, revealedTaskListCounts]);

  useEffect(() => {
    if (!streamingReportMessageId) return;

    const message = messages.find(item => item.id === streamingReportMessageId);
    const withLogsToday = message?._data?.withLogsToday || [];
    const withoutLogsToday = message?._data?.withoutLogsToday || [];
    const counts = revealedReportCounts[streamingReportMessageId] ?? { withLogs: 0, withoutLogs: 0 };

    if (counts.withLogs < withLogsToday.length) {
      const timer = window.setTimeout(() => {
        setRevealedReportCounts(current => ({
          ...current,
          [streamingReportMessageId]: {
            withLogs: Math.min(withLogsToday.length, (current[streamingReportMessageId]?.withLogs ?? 0) + 1),
            withoutLogs: current[streamingReportMessageId]?.withoutLogs ?? 0,
          },
        }));
      }, counts.withLogs === 0 ? 120 : 180);
      return () => window.clearTimeout(timer);
    }

    if (!collapsedNoReportSection && counts.withoutLogs < withoutLogsToday.length) {
      const timer = window.setTimeout(() => {
        setRevealedReportCounts(current => ({
          ...current,
          [streamingReportMessageId]: {
            withLogs: current[streamingReportMessageId]?.withLogs ?? withLogsToday.length,
            withoutLogs: Math.min(withoutLogsToday.length, (current[streamingReportMessageId]?.withoutLogs ?? 0) + 1),
          },
        }));
      }, 180);
      return () => window.clearTimeout(timer);
    }

    if (counts.withLogs >= withLogsToday.length && (collapsedNoReportSection || counts.withoutLogs >= withoutLogsToday.length)) {
      setStreamingReportMessageId(null);
    }
  }, [streamingReportMessageId, messages, revealedReportCounts, collapsedNoReportSection]);

  useEffect(() => {
    if (!introText || introTypingIndex >= introText.length) return;
    const timer = setTimeout(() => {
      setIntroTypingIndex(prev => prev + 1);
    }, 18);
    return () => clearTimeout(timer);
  }, [introText, introTypingIndex]);

  // Smooth scroll with special handling for task list/report streaming
  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    const isLatestReportLog = latestMessage?._action === 'report_log_list';

    if (isLatestReportLog) {
      const timer = window.setTimeout(() => {
        reportAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
      return () => window.clearTimeout(timer);
    }

    if (isTyping) {
      const rafId = requestAnimationFrame(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      });
      return () => cancelAnimationFrame(rafId);
    }
    if (streamingTaskListMessageId) {
      const timer = window.setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
      return () => window.clearTimeout(timer);
    }
    window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 40);
  }, [messages, isReplying, typingIndex, isTyping, streamingTaskListMessageId]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const updateInset = () => {
      if (keyboardAdjustRafRef.current) {
        cancelAnimationFrame(keyboardAdjustRafRef.current);
      }
      keyboardAdjustRafRef.current = requestAnimationFrame(() => {
        const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setKeyboardInset(prev => Math.abs(prev - inset) < 4 ? prev : inset);
        if (footerRef.current) {
          const nextHeight = footerRef.current.getBoundingClientRect().height;
          setComposerHeight(prev => Math.abs(prev - nextHeight) < 4 ? prev : nextHeight);
        }
      });
    };

    updateInset();
    vv.addEventListener('resize', updateInset);
    vv.addEventListener('scroll', updateInset);
    window.addEventListener('resize', updateInset);

    return () => {
      if (keyboardAdjustRafRef.current) {
        cancelAnimationFrame(keyboardAdjustRafRef.current);
      }
      vv.removeEventListener('resize', updateInset);
      vv.removeEventListener('scroll', updateInset);
      window.removeEventListener('resize', updateInset);
    };
  }, []);

  // Auto-scroll to inline panels when they open
  useEffect(() => {
    if (openPanel.panel === 'status') {
      ensureElementVisibleAboveKeyboard(statusPickerRef.current, 100);
    } else if (openPanel.panel === 'more') {
      ensureElementVisibleAboveKeyboard(morePanelRef.current, 100);
    }
  }, [openPanel]);
  useEffect(() => {
    if (assigneePickerTaskId) {
      ensureElementVisibleAboveKeyboard(assigneePickerRef.current, 100);
    }
  }, [assigneePickerTaskId]);
  useEffect(() => {
    if (openPanel.panel === 'progress') {
      window.setTimeout(() => {
        const sliderEl = document.querySelector('[data-testid="progress-slider"]');
        ensureElementVisibleAboveKeyboard(sliderEl, 0);
      }, 100);
    }
  }, [openPanel]);

  const isTodayDate = (date: string) => date === new Date().toISOString().slice(0, 10);

  const formatReportDateLabel = (date: string) => {
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return date;
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `${date} · ${weekday}`;
  };

  const shiftReportDate = (date: string, deltaDays: number) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + deltaDays);
    return next.toISOString().slice(0, 10);
  };

  const getBlockerText = (task: TaskItem, logs: LogEntry[], reportDate: string = reportLogDate) => {
    const dateLogs = logs.filter(log => log.task_id === task.id && log.date === reportDate);
    const blockerLog = dateLogs.find(log => /blocker/i.test(log.event))?.event?.replace(/^\[[^\]]+\]\n?/,'') || '';
    const blockerFromDescription = isTodayDate(reportDate) ? (task.description?.match(/Blocker:\s*([\s\S]*)/i)?.[1]?.trim() || '') : '';
    return blockerLog || blockerFromDescription;
  };

  const summarizeReportText = (task: TaskItem, logs: LogEntry[], reportDate: string = reportLogDate) => {
    const dateLogs = logs.filter(log => log.task_id === task.id && log.date === reportDate);
    const todayDone = (isTodayDate(reportDate) ? task.today_update?.trim() : '') || dateLogs.find(log => /what i have done|today/i.test(log.event))?.event?.replace(/^\[[^\]]+\]\n?/,'') || '';
    const tomorrow = (isTodayDate(reportDate) ? task.next_day_focus?.trim() : '') || dateLogs.find(log => /next day focus|tomorrow/i.test(log.event))?.event?.replace(/^\[[^\]]+\]\n?/,'') || '';
    const blocker = getBlockerText(task, logs, reportDate);

    const sentences: string[] = [];
    if (todayDone) sentences.push(`Completed ${todayDone.replace(/[。！!]+$/,'')}.`);
    if (tomorrow) sentences.push(`Next, ${tomorrow.replace(/^[A-Z]/, (m) => m.toLowerCase()).replace(/[。！!]+$/,'')}.`);
    if (blocker) sentences.push(`Blocked by ${blocker.replace(/^[A-Z]/, (m) => m.toLowerCase()).replace(/[。！!]+$/,'')}.`);

    return sentences.slice(0, 2).join(' ');
  };

  const canAccessMainTask = (task: TaskItem) => {
    if (currentUserRole === 'admin') return true;
    if (!currentUserId) return false;
    if (task.assignees?.some((assignee) => assignee.id === currentUserId)) return true;
    return task.subtasks?.some((subtask) => subtask.assignees?.some((assignee) => assignee.id === currentUserId)) ?? false;
  };

  const getReportCandidateMainTasks = (targetDate: string) => {
    const selectedUser = currentUserRole === 'admin' ? 'all' : (currentUserId || 'all');
    const includedIds = new Set(
      buildTrackerRows(tasks, myLogs, targetDate, selectedUser, { mainTasksOnly: true }).map((row) => row.mainTaskId),
    );

    return tasks
      .filter((task) => !task.parent_id && includedIds.has(task.id) && canAccessMainTask(task))
      .sort((a, b) => {
        const aDue = a.due_date || '9999-12-31';
        const bDue = b.due_date || '9999-12-31';
        return aDue.localeCompare(bDue) || a.title.localeCompare(b.title);
      });
  };

  const exportCurrentReport = async (targetDate: string) => {
    const selectedUser = currentUserRole === 'admin' ? 'all' : (currentUserId || 'all');
    const rows = buildTrackerRows(tasks, myLogs, targetDate, selectedUser, { mainTasksOnly: true });
    await exportTrackerWorkbook(rows, targetDate);
  };

  const openReportLogMode = (targetDate: string = reportLogDate) => {
    setActiveQuickAction('report-log');
    setReportLogDate(targetDate);
    const reportTasks = getReportCandidateMainTasks(targetDate);
    const withLogsToday = reportTasks
      .filter(task => {
        const hasToday = ((isTodayDate(targetDate) ? task.today_update?.trim() : '') || myLogs.some(log => log.task_id === task.id && log.date === targetDate && /what i have done|today/i.test(log.event)));
        const hasTomorrow = ((isTodayDate(targetDate) ? task.next_day_focus?.trim() : '') || myLogs.some(log => log.task_id === task.id && log.date === targetDate && /next day focus|tomorrow/i.test(log.event)));
        const hasBlocker = !!getBlockerText(task, myLogs, targetDate)?.trim();
        return !!(hasToday || hasTomorrow || hasBlocker);
      })
      .map(task => {
        const todayDone = (isTodayDate(targetDate) ? task.today_update?.trim() : '') || myLogs.some(log => log.task_id === task.id && log.date === targetDate && /what i have done|today/i.test(log.event));
        const tomorrow = (isTodayDate(targetDate) ? task.next_day_focus?.trim() : '') || myLogs.some(log => log.task_id === task.id && log.date === targetDate && /next day focus|tomorrow/i.test(log.event));
        const blocker = getBlockerText(task, myLogs, targetDate)?.trim();
        return {
          id: task.id,
          title: task.title,
          due_date: task.due_date,
          status: task.status,
          assignees: task.assignees.map(a => a.name),
          subtasks: (task.subtasks || []).map((subtask) => ({
            id: subtask.id,
            title: subtask.title,
            status: subtask.status,
            progress: subtask.is_finished ? 100 : subtask.progress_percent ?? 0,
            is_focus: !!subtask.is_focus && !subtask.is_finished,
            assignees: subtask.assignees.map((a) => ({ id: a.id, name: a.name })),
          })),
          summary: summarizeReportText(task, myLogs, targetDate),
          hasToday: !!todayDone,
          hasTomorrow: !!tomorrow,
          hasBlocker: !!blocker,
        };
      });
    const withoutLogsToday = reportTasks
      .filter(task => !withLogsToday.some(item => item.id === task.id))
      .map(task => ({
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        status: task.status,
        assignees: task.assignees.map(a => a.name),
        subtasks: (task.subtasks || []).map((subtask) => ({
          id: subtask.id,
          title: subtask.title,
          status: subtask.status,
          progress: subtask.is_finished ? 100 : subtask.progress_percent ?? 0,
          is_focus: !!subtask.is_focus && !subtask.is_finished,
          assignees: subtask.assignees.map((a) => ({ id: a.id, name: a.name })),
        })),
        summary: '',
      }));
    startTypingMessage(`小人稟報恩公，${targetDate} 可 review 嘅 main task 有 ${reportTasks.length} 個。下面已經幫你分好有 report 同未補 report 嘅 task。`, {
      _action: 'report_log_list',
      _data: { withLogsToday, withoutLogsToday, reportDate: targetDate, isAdmin: currentUserRole === 'admin' }
    });
  };

  const openReportFieldEditor = (taskId: string, field: 'today' | 'tomorrow' | 'blocker', targetDate: string = reportLogDate) => {
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;
    const dateLogs = myLogs.filter(log => log.task_id === task.id && log.date === targetDate);
    const nextText = field === 'today'
      ? ((isTodayDate(targetDate) ? task.today_update?.trim() : '') || dateLogs.find(log => /what i have done|today/i.test(log.event))?.event?.replace(/^\[[^\]]+\]\n?/,'') || '')
      : field === 'tomorrow'
        ? ((isTodayDate(targetDate) ? task.next_day_focus?.trim() : '') || dateLogs.find(log => /next day focus|tomorrow/i.test(log.event))?.event?.replace(/^\[[^\]]+\]\n?/,'') || '')
        : (getBlockerText(task, myLogs, targetDate) || '');
    setPendingTaskAction({ taskId, title: task.title, kind: field });
    setReportEditorState({ taskId, title: task.title, field, text: nextText });
    setInput(nextText);
    scrollToInput();
  };

  const getContext = (searchResult?: any) => {
    const today = new Date().toISOString().slice(0, 10);
    // Include ALL tasks (not just first 20) for accurate search
    const taskList = tasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      assignees: t.assignees.map(a => a.name),
      is_finished: t.is_finished,
      progress: t.progress_percent,
      subtasks: t.subtasks?.map((s: any) => ({
        title: s.title,
        status: s.status,
        assignees: s.assignees.map((a: any) => a.name),
      })) || [],
    }));
    const profileList = profiles.map(p => ({ id: p.id, name: p.name }));
    const result: any = { today, current_user: currentUserId, current_user_name: currentUserName, tasks: taskList, profiles: profileList };
    if (searchResult) {
      result.search_result = searchResult;
    } else if (searchResult === null && arguments.length > 0) {
      // Frontend tried to search but found nothing
      result.search_result = null;
    }
    return result;
  };

  const executeAction = async (action: any): Promise<string> => {
    if (!action) return '';
    try {
      switch (action.action) {
        case 'create_task': {
          let dueDate = action.due_date;
          if (dueDate && typeof dueDate === 'string') {
            const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDate);
            if (!isValidDate) dueDate = undefined;
          }
          const assignee = action.assignee ? profiles.find(p => p.name.toLowerCase() === action.assignee.toLowerCase()) : null;
          await createTask({
            title: action.title || '未命名 task',
            description: action.description || '',
            status: action.status || 'todo',
            priority: 'medium',
            due_date: dueDate || undefined,
            assignee_ids: assignee ? [assignee.id] : [],
            tags: [],
            parent_id: action.parent_id ?? null,
          });
          await loadTasks();
          return `✅ 已建立「${action.title || '未命名 task'}」\n\n📋 Task Details:\n• 名稱：${action.title || '未命名 task'}\n• 到期：${dueDate || '未設定'}\n• 負責：${assignee ? assignee.name : currentUserName}\n• 內容：${action.description || '無'}\n• Status：${action.status || 'todo'}`;
        }
        case 'update_task': {
          const task = tasks.find(t => t.id === action.task_id || t.title.toLowerCase().includes((action.task_ref || '').toLowerCase()));
          if (!task) return '❌ 搵唔到該 task';
          if (action.due_date !== undefined) await updateTask(task.id, { due_date: action.due_date });
          if (action.status) await updateTask(task.id, { status: action.status });
          if (action.assignee) {
            const profile = profiles.find(p => p.name.toLowerCase() === action.assignee.toLowerCase());
            if (profile) await updateTaskAssignees(task.id, [profile.id]);
          }
          await loadTasks();
          return `✅ 已更新「${task.title}」\n\n📋 更新內容：\n• ${action.due_date !== undefined ? `到期：${action.due_date}` : ''}${action.status ? `Status：${action.status}` : ''}${action.assignee ? `負責：${action.assignee}` : ''}\n\n📋 最新狀態：\n• 名稱：${task.title}\n• 到期：${action.due_date || task.due_date || '未設定'}\n• 負責：${action.assignee || task.assignees.map(a => a.name).join(', ') || '未指派'}\n• Status：${action.status || task.status}`;
        }
        case 'delete_task': {
          const task = tasks.find(t => t.id === action.task_id || t.title.toLowerCase().includes((action.task_ref || '').toLowerCase()));
          if (!task) return '❌ 搵唔到該 task';
          await deleteTask(task.id);
          await loadTasks();
          return `✅ 已刪除「${task.title}」`;
        }
        default:
          return '';
      }
    } catch (e: any) {
      return `❌ 操作失敗：${e?.message || 'Unknown error'}`;
    }
  };

  // Strip any leaked action tags and format text for display
  const formatAiText = (text: string) => {
    // Remove any ###ACTION###...###END### from visible text
    let cleaned = text.replace(/###ACTION###[\s\S]*?###END###/g, '').trim();
    // Replace markdown-style bold
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
    return cleaned;
  };

  const renderMessage = (text: string, role: 'ai' | 'user') => {
    const displayText = role === 'ai' ? formatAiText(text) : text;
    const isTaskDetailMessage = role === 'ai' && displayText.includes('📋') && displayText.includes('📊');
    return displayText.split('\n').map((line, i) => {
      const isBullet = /^[•*-]\s/.test(line);
      const isNumbered = /^\d+[.)]\s/.test(line);
      const isTaskTitle = isTaskDetailMessage && i === 0;
      return (
        <div key={i} style={{ 
          marginTop: i > 0 ? 6 : 0,
          fontWeight: isTaskTitle ? 900 : (isBullet || isNumbered ? 600 : 400),
          fontSize: isTaskTitle ? 21 : undefined,
          lineHeight: isTaskTitle ? 1.25 : undefined,
          letterSpacing: isTaskTitle ? '-0.02em' : undefined,
          paddingLeft: isBullet || isNumbered ? 16 : 0,
          textIndent: isBullet || isNumbered ? -16 : 0,
        }}>
          {line || ' '}
        </div>
      );
    });
  };

  const getCreateActionKey = (data: any) => `${data.title || ''}|${data.description || ''}|${data.dueDate || ''}|${data.assignee || ''}|${data.status || ''}`;

  const handleConfirmCreate = async (data: any) => {
    const actionKey = getCreateActionKey(data);
    if (lockedCreateActions[actionKey] || isReplying) return;
    setLockedCreateActions(current => ({ ...current, [actionKey]: 'confirming' }));
    setIsReplying(true);
    
    const assigneeProfile = profiles.find(p => p.name === data.assignee);
    
    try {
      await createTask({
        title: data.title,
        description: data.description || '',
        status: data.status || 'todo',
        priority: 'medium',
        due_date: data.dueDate || undefined,
        assignee_ids: assigneeProfile ? [assigneeProfile.id] : [],
        tags: [],
        parent_id: data.parentTaskId || null,
      });
      
      await loadTasks();
      
      const isSub = !!data.parentTaskId;
      startTypingMessage(`✅ 小人稟報恩公，已建立「${data.title}」${isSub ? '（Subtask）' : ''}\n\n📋 Task Details:\n• 名稱：${data.title}\n• 到期：${data.dueDateLabel || data.dueDate || '未設定'}\n• 負責：${data.assignee}\n• Status：${data.statusLabel}\n• Description：${data.description || '無'}`);
      
      // Reset guided flow
      setCreateMode('idle');
      setGuidedStep(0);
      setGuidedDraft({ title:'',description:'',assignee:'',dueDate:'',dueLabel:'',parentTaskId: null });
    } catch (e: any) {
      setLockedCreateActions(current => {
        const next = { ...current };
        delete next[actionKey];
        return next;
      });
      startTypingMessage(`❌ 小人該死，建立失敗：${e?.message || 'Unknown error'}`);
    } finally {
      setIsReplying(false);
    }
  };

  const handleCancelCreate = (data: any) => {
    const actionKey = getCreateActionKey(data);
    if (lockedCreateActions[actionKey]) return;
    setLockedCreateActions(current => ({ ...current, [actionKey]: 'cancelled' }));
    // Reset guided flow on cancel too
    setCreateMode('idle');
    setGuidedStep(0);
    setGuidedDraft({ title:'',description:'',assignee:'',dueDate:'',dueLabel:'',parentTaskId: null });
    startTypingMessage('小人遵命，已取消～有咩再講 💕');
  };

  const showTaskActions = (task: Pick<TaskItem, 'id' | 'title' | 'status' | 'due_date' | 'progress_percent' | 'assignees' | 'subtasks'>) => {
    setActiveQuickAction(null);
    const statusMeta = getStatusMeta(task.status);
    // Subtasks are now shown as inline editable section, not text list
    startTypingMessage(
      `✅ 搵到「${task.title}」\n📋 ${statusMeta.label}  |  📅 ${task.due_date || '未設定'}  |  👤 ${task.assignees.map(a => a.name.split(' ')[0]).join('/')}  |  📊 ${task.progress_percent ?? 0}%\n\n仲想改咩？`,
      { _action: 'task_actions', _data: { taskId: task.id, title: task.title } }
    );
  };

  const updateTaskActionBubble = (task: TaskItem) => {
    const statusMeta = getStatusMeta(task.status);
    // Subtasks are now shown as inline editable section, not text list
    const newText = `✅ 搵到「${task.title}」\n📋 ${statusMeta.label}  |  📅 ${task.due_date || '未設定'}  |  👤 ${task.assignees.map(a => a.name.split(' ')[0]).join('/')}  |  📊 ${task.progress_percent ?? 0}%\n\n仲想改咩？`;
    setMessages(current => {
      const idx = current.findLastIndex(m => m._action === 'task_actions' && m._data?.taskId === task.id);
      if (idx === -1) return current;
      const next = [...current];
      next[idx] = { role: 'ai', text: newText, _action: 'task_actions', _data: { taskId: task.id, title: task.title } } as typeof next[0];
      return next;
    });
    resetInlineTaskPanels();
  };

  const getLatestTask = (taskId: string) => tasks.find(t => t.id === taskId);

  const resetInlineTaskPanels = () => {
    setAssigneePickerTaskId(null);
    setSubtaskComposerTaskId(null);
    setPendingDeleteTaskId(null);
    setProgressSlider(null);
    setOpenPanel({ taskId: '', panel: null });
    setExpandedSubtaskId(null); // Close expanded subtask inline editor
  };

  const clearInputAndPanels = () => {
    setInput('');
    setPendingTaskAction(null);
    setReportEditorState(null);
    resetInlineTaskPanels();
    setDueDatePicker(null);
  };

  const resetGuidedCreateFlow = () => {
    createModeRef.current = 'idle';
    setCreateMode('idle');
    setGuidedStep(0);
    setGuidedDraft({ title:'',description:'',assignee:'',dueDate:'',dueLabel:'',parentTaskId: null });
  };

  const getQuickActionButtonStyle = (preset: string): CSSProperties => {
    const key = preset === '搵 Task'
      ? 'search'
      : preset === '加Task'
        ? 'add'
        : preset === 'Focus'
          ? 'focus'
          : preset === 'My Task'
            ? 'my-task'
            : preset === 'Report Log'
              ? 'report-log'
              : preset === 'Free talk'
                ? 'free-talk'
                : null;
    const isActive = key !== null && activeQuickAction === key;
    const isLocked = isReplying || isTyping;
    if (preset === '退下') {
      return {
        flexShrink: 0,
        border: '1px solid #fecdd3',
        background: '#fff1f2',
        color: '#be123c',
        borderRadius: 999,
        padding: '8px 11px',
        fontSize: 13,
        fontWeight: 850,
        opacity: isLocked ? 0.55 : 1,
        cursor: isLocked ? 'default' : 'pointer',
      };
    }
    return {
      flexShrink: 0,
      border: `1px solid ${isActive ? '#7dd3fc' : '#dbeafe'}`,
      background: isActive ? '#e0f2fe' : '#fff',
      color: isActive ? '#075985' : '#0369a1',
      borderRadius: 999,
      padding: '8px 11px',
      fontSize: 13,
      fontWeight: 850,
      boxShadow: isActive ? '0 0 0 2px rgba(14,165,233,0.12) inset' : 'none',
      opacity: isLocked ? 0.55 : 1,
      cursor: isLocked ? 'default' : 'pointer',
    };
  };

  const ensureElementVisibleAboveKeyboard = (el: Element | null, delay = 80) => {
    window.setTimeout(() => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const safeTop = 72;
      const safeBottom = viewportHeight - 24;

      // Already comfortably visible: do nothing to avoid jumpiness
      if (rect.top >= safeTop && rect.bottom <= safeBottom) return;

      let targetTop = window.scrollY;
      if (rect.top < safeTop) {
        targetTop = window.scrollY + rect.top - safeTop;
      } else if (rect.bottom > safeBottom) {
        targetTop = window.scrollY + (rect.bottom - safeBottom);
      }

      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }, delay);
  };

  const immediateFocusInput = () => {
    const inputEl = document.querySelector('textarea[data-testid="chat-input"]') as HTMLTextAreaElement;
    if (!inputEl) return;
    inputEl.readOnly = false;
    inputEl.disabled = false;
    inputEl.focus();
    const len = inputEl.value.length;
    inputEl.setSelectionRange(len, len);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const scrollToInput = () => {
    window.setTimeout(() => {
      const inputEl = document.querySelector('textarea[data-testid="chat-input"]') as HTMLTextAreaElement;
      if (inputEl) {
        ensureElementVisibleAboveKeyboard(inputEl, 0);
        // iOS requires this pattern to show keyboard
        inputEl.readOnly = false;
        inputEl.disabled = false;
        inputEl.focus({ preventScroll: true });
        // Place cursor at the end
        const len = inputEl.value.length;
        inputEl.setSelectionRange(len, len);
        // Trigger input event to resize
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 200);
  };

  const handleDeleteTask = async (taskId: string) => {
    setIsReplying(true);
    try {
      await deleteTask(taskId);
      setPendingDeleteTaskId(null);
      setMessages(current => {
        const idx = current.findLastIndex(m => m._action === 'task_actions' && m._data?.taskId === taskId);
        if (idx === -1) return current;
        const next = [...current];
        next[idx] = {
          role: 'ai',
          text: `🗑️ 已刪除「${next[idx]._data?.title || '該 task'}」`,
        };
        return next;
      });
      await loadTasks();
    } catch (e: any) {
      startTypingMessage(`❌ 小人該死，刪除失敗：${e?.message || 'Unknown error'}`);
    } finally {
      setIsReplying(false);
    }
  };

  const confirmTaskMutation = async (taskId: string, _title: string, _message: string) => {
    const fresh = await loadTasks();
    await loadLogs();
    const updated = fresh?.find(t => t.id === taskId);
    if (updated) updateTaskActionBubble(updated);
  };

  const quickUpdateTask = async (taskId: string, title: string, payload: Parameters<typeof updateTask>[1], message: string) => {
    setIsReplying(true);
    try {
      await updateTask(taskId, payload);
      await confirmTaskMutation(taskId, title, message);
    } catch (e: any) {
      startTypingMessage(`❌ 更新失敗：${e?.message || 'Unknown error'}`);
    } finally {
      setIsReplying(false);
    }
  };

  const assignTaskTo = async (taskId: string, title: string, profile: Profile) => {
    setIsReplying(true);
    try {
      await updateTaskAssignees(taskId, [profile.id]);
      await confirmTaskMutation(taskId, title, `負責：${profile.name}`);
      setAssigneePickerTaskId(null);
    } catch (e: any) {
      startTypingMessage(`❌ 小人該死，指派失敗：${e?.message || 'Unknown error'}`);
    } finally {
      setIsReplying(false);
    }
  };

  const addSubtask = async (taskId: string, title: string) => {
    const subtaskTitle = (subtaskDrafts[taskId] || '').trim();
    if (!subtaskTitle) return;
    const parentTask = getLatestTask(taskId);
    setIsReplying(true);
    try {
      await createTask({
        title: subtaskTitle,
        description: '',
        status: 'todo',
        priority: 'medium',
        due_date: parentTask?.due_date || undefined,
        assignee_ids: parentTask?.assignees.map(a => a.id) || [],
        tags: [],
        parent_id: taskId,
      });
      setSubtaskDrafts(current => ({ ...current, [taskId]: '' }));
      setSubtaskComposerTaskId(null);
      await confirmTaskMutation(taskId, title, `已加 SubTask：${subtaskTitle}`);
    } catch (e: any) {
      startTypingMessage(`❌ 小人該死，加 SubTask 失敗：${e?.message || 'Unknown error'}`);
    } finally {
      setIsReplying(false);
    }
  };

  const actionButtonStyle = (variant: 'primary' | 'soft' | 'danger' | 'focus' | 'panel' | 'success' = 'soft') => ({
    background:
      variant === 'primary' ? '#0f172a' :
      variant === 'danger' ? '#fff1f2' :
      variant === 'focus' ? '#7c3aed' :
      variant === 'panel' ? '#ffffff' :
      variant === 'success' ? '#ecfdf5' :
      '#f0f9ff',
    color:
      variant === 'primary' ? '#fff' :
      variant === 'danger' ? '#be123c' :
      variant === 'focus' ? '#ffffff' :
      variant === 'panel' ? '#475569' :
      variant === 'success' ? '#047857' :
      '#0369a1',
    border:
      variant === 'danger' ? '1px solid #fecdd3' :
      variant === 'focus' ? '1px solid #8b5cf6' :
      variant === 'panel' ? '1px solid #e2e8f0' :
      variant === 'success' ? '1px solid #86efac' :
      '1px solid #bae6fd',
    boxShadow: variant === 'focus' ? '0 8px 18px rgba(124,58,237,0.28)' : 'none',
    borderRadius: 14,
    padding: variant === 'panel' ? '10px 10px' : '11px 10px',
    fontSize: variant === 'panel' ? 13 : 14,
    fontWeight: 900,
    cursor: isReplying ? 'default' : 'pointer',
    opacity: isReplying ? 0.58 : 1,
  });

  const renderAssigneeEditor = (taskId: string, title: string, assignees: Array<{ id: string; name: string }>, compact = false) => (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ color: compact ? '#64748b' : '#475569', fontSize: compact ? 12 : 13, fontWeight: 700 }}>
          Assignee：{assignees.map((item) => item.name).join('、') || '未指派'}
        </div>
        <button
          disabled={isReplying}
          onClick={() => setAssigneePickerTaskId((current) => current === taskId ? null : taskId)}
          style={{ ...actionButtonStyle(assigneePickerTaskId === taskId ? 'focus' : 'panel'), padding: compact ? '7px 10px' : '9px 12px', fontSize: compact ? 12 : 13 }}
        >
          改 Assignee
        </button>
      </div>
      {assigneePickerTaskId === taskId && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {profiles.map((profile) => (
            <button
              key={profile.id}
              disabled={isReplying}
              onClick={() => void assignTaskTo(taskId, title, profile)}
              style={actionButtonStyle(assignees.some((item) => item.id === profile.id) ? 'primary' : 'soft')}
            >
              {profile.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const applyDueDate = async (taskId: string, _title: string, dueDate: string | null) => {
    setDueDatePicker(null);
    setIsReplying(true);
    try {
      await updateTask(taskId, { due_date: dueDate || null });
      const fresh = await loadTasks();
      const updated = fresh?.find(t => t.id === taskId);
      if (updated) updateTaskActionBubble(updated);
    } catch (e: any) {
      startTypingMessage(`❌ 小人該死，更新 Due date 失敗：${e?.message || 'Unknown error'}`);
    } finally {
      setIsReplying(false);
    }
  };

  const buildFreeTalkPrompt = (userPrompt: string) => `你而家係一個廣東話 AI 陪伴，語氣要同 Silly AI 一樣：古代小廝 / 軍師口吻，自稱小人、小的，稱呼對方做大人或恩公。\n\n任務：陪對方 free talk，用正向思維、心靈雞湯、少少風水師 / 軍師式鼓勵去回應，但唔好太迷信，重點係安定人心、俾方向、俾情緒價值。\n\n規則：\n1. 一律用繁體廣東話。\n2. 唔好拉返去 task 管理，除非大人主動問。\n3. 語氣溫柔、有智慧、有少少古風。\n4. 可以講運勢、氣場、心境、節奏、收心、聚氣、順勢而行，但要自然。\n5. 回覆短中篇幅，似真人傾偈，唔好太公式。\n6. 適度用句式如：小人斗膽稟報、依小人愚見、恩公且寬心、順勢而行、養神蓄銳。\n\n大人而家講：${userPrompt}`;

  const send = async (text?: string, options?: { suppressUserBubble?: boolean }) => {
    // Verify current user before sending
    const { data: { user } } = await supabase.auth.getUser();
    const actualName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
    if (actualName !== currentUserName) {
      // User changed, reset session
      window.location.reload();
      return;
    }
    
    const userText = (text ?? input).trim();
    const shouldEchoUserBubble = !options?.suppressUserBubble;
    setDueDatePicker(null);
    if (!userText || isReplying) return;
    setIntroText('');

    const cleanPendingActionText = (value: string, title: string, _kind: NonNullable<typeof pendingTaskAction>['kind']) => {
      const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patterns: RegExp[] = [
        new RegExp(`^${escapedTitle}\\s*(今日做咗|今日做咗乜|今日做咗：|今日做咗:|today\\s*update:?|daily\\s*log:?)\\s*`, 'i'),
        new RegExp(`^${escapedTitle}\\s*(明天focus|明天做乜|聽日focus|next\\s*day\\s*focus:?|tomorrow:?|明天focus：)\\s*`, 'i'),
        new RegExp(`^${escapedTitle}\\s*(blocker|阻礙|卡住|blocker：|blocker:)\\s*`, 'i'),
        new RegExp(`^${escapedTitle}\\s*(progress\\s*update|進度更新|update progress|progress update：|progress update:)\\s*`, 'i'),
      ];
      let cleaned = value.trim();
      patterns.forEach(pattern => { cleaned = cleaned.replace(pattern, '').trim(); });
      // If empty after stripping prefix, return null to indicate no actual input
      if (!cleaned) return null;
      return cleaned;
    };

    if (pendingTaskAction) {
      const pendingTask = tasks.find(t => t.id === pendingTaskAction.taskId);
      if (pendingTask) {
        const isReportEditing = !!reportEditorState && reportEditorState.taskId === pendingTask.id && reportEditorState.field === pendingTaskAction.kind;
        if (!isReportEditing) {
          if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
        }
        setInput('');
        setIsReplying(true);
        try {
          const actionText = cleanPendingActionText(userText, pendingTaskAction.title, pendingTaskAction.kind);
          if (!actionText) {
            setIsReplying(false);
            if (isReportEditing) {
              setInput(reportEditorState?.text || '');
              return;
            }
            setPendingTaskAction(null);
            startTypingMessage(`小人斗膽稟報，冇收到新資料，還請恩公輸入內容後再 send～`, {
              _action: 'task_actions',
              _data: { taskId: pendingTask.id, title: pendingTask.title }
            });
            return;
          }
          if (pendingTaskAction.kind === 'today') {
            await updateTask(pendingTask.id, { today_update: actionText });
            await createTaskEventLog(pendingTask.id, `[What I have done]\n${actionText}`);
          } else if (pendingTaskAction.kind === 'tomorrow') {
            await updateTask(pendingTask.id, { next_day_focus: actionText, is_focus: true });
            await createTaskEventLog(pendingTask.id, `[Next Day Focus]\n${actionText}`);
          } else if (pendingTaskAction.kind === 'blocker') {
            const merged = [pendingTask.description?.replace(/\n\n?Blocker:[\s\S]*$/i, ''), `Blocker: ${actionText}`].filter(Boolean).join('\n\n');
            await updateTask(pendingTask.id, { description: merged });
            await createTaskEventLog(pendingTask.id, `[Blocker]\n${actionText}`);
          } else if (pendingTaskAction.kind === 'progress_update') {
            await createTaskEventLog(pendingTask.id, `[Progress Update]\n${actionText}`);
          }
          const freshTasks = await loadTasks();
          await loadLogs();
          const actionKind = pendingTaskAction.kind;
          const refreshedTask = freshTasks?.find(t => t.id === pendingTask.id) || tasks.find(t => t.id === pendingTask.id) || pendingTask;

          if (isReportEditing && (actionKind === 'today' || actionKind === 'tomorrow' || actionKind === 'blocker')) {
            setReportEditorState({ taskId: refreshedTask.id, title: refreshedTask.title, field: actionKind, text: actionText });
            setInput(actionText);
            setPendingTaskAction({ taskId: refreshedTask.id, title: refreshedTask.title, kind: actionKind });
          } else {
            setPendingTaskAction(null);
            setReportEditorState(null);
            const actionLabel = actionKind === 'today' ? 'What I have done' : actionKind === 'tomorrow' ? 'Next Day Focus' : actionKind === 'blocker' ? 'Blocker' : 'Progress Update';
            startTypingMessage(`✅ 小人稟報恩公，已更新「${pendingTask.title}」\n\n• ${actionLabel}：${actionText}\n\n仲想改其他嘢嗎？`, {
              _action: 'task_actions',
              _data: { taskId: pendingTask.id, title: pendingTask.title }
            });
          }
        } catch (e: any) {
          if (isReportEditing) {
            startTypingMessage(`❌ 更新失敗：${e?.message || 'Unknown error'}`);
          } else {
            startTypingMessage(`❌ 更新失敗：${e?.message || 'Unknown error'}`);
          }
        } finally {
          setIsReplying(false);
        }
        return;
      }
      setPendingTaskAction(null);
    }
    
    // ── Guided Creation Flow State Machine ──
    if (createModeRef.current !== 'idle') {
      const activeCreateMode = createModeRef.current;
      setActiveQuickAction(activeCreateMode === 'subtask' || activeCreateMode === 'main' ? 'add' : null);
      if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
      setInput('');
      const userVal = userText.trim();

      if (activeCreateMode === 'main') {
        if (guidedStep === 0) {
          if (!userVal) { startTypingMessage('小人斗膽一問，唔該先俾個 Task 名稱～'); return; }
          setGuidedDraft(d => ({ ...d, title: userVal }));
          setGuidedStep(1);
          startTypingMessage(`小人收到！「${userVal}」\n\nDescription 寫啲咩？（選填，直接 Enter 可留空）`);
          return;
        }

        if (guidedStep === 1) {
          const draft = { ...guidedDraft, title: guidedDraft.title || userVal, description: userVal };
          setIsReplying(true);
          try {
            const created = await createTask({
              title: draft.title,
              description: draft.description,
              status: 'todo',
              priority: 'medium',
              due_date: undefined,
              assignee_ids: currentUserId ? [currentUserId] : [],
              tags: [],
            });
            await loadTasks();
            const freshTasks = await fetchTasksForCantonAi();
            if (freshTasks) setTasks(freshTasks);
            const createdTask = freshTasks?.find(t => t.id === created.id) || null;
            createModeRef.current = 'idle';
            setCreateMode('idle');
            setGuidedStep(0);
            setGuidedDraft({ title:'',description:'',assignee:'',dueDate:'',dueLabel:'',parentTaskId: null });
            setActiveQuickAction(null);
            if (createdTask) {
              showTaskActions(createdTask);
              setEditingTaskFromChat(createdTask);
            } else {
              startTypingMessage(`✅ 已建立「${draft.title}」`);
            }
          } catch (e: any) {
            startTypingMessage(`❌ 小人該死，建立失敗：${e?.message || 'Unknown error'}`);
          } finally {
            setIsReplying(false);
          }
          return;
        }
      }

      if (activeCreateMode === 'subtask') {
        if (guidedStep === -1) {
          const mainTasks = tasks.filter(t => !t.parent_id);
          let parentId: string | null = null;
          // 嘗試 match 數字
          const num = parseInt(userVal);
          if (!isNaN(num) && num >= 1 && num <= mainTasks.length) {
            parentId = mainTasks[num-1].id;
          } else {
            // 嘗試 match 名稱
            const found = mainTasks.find(t => t.title.toLowerCase().includes(userVal.toLowerCase()));
            if (found) parentId = found.id;
          }
          if (!parentId) {
            startTypingMessage('小人稟報恩公，搵唔到呢個 Main Task，還請恩公試吓打數字或者完整名稱？');
            return;
          }
          setGuidedDraft(d => ({ ...d, parentTaskId: parentId }));
          setGuidedStep(0);
          startTypingMessage('小人遵命！\n\nSubtask 名係？（可用 [Wed] [App] [Kiosk] 做 prefix，例如：Wed UI Fix）');
          return;
        }
        if (guidedStep === 0) {
          if (!userVal) { startTypingMessage('小人斗膽一問，唔該俾個 Subtask 名稱～'); return; }
          setGuidedDraft(d => ({ ...d, title: userVal }));
          setGuidedStep(1);
          startTypingMessage(`小人收到！「${userVal}」\n\nDescription 寫啲咩？（選填，直接 Enter 可跳過）`);
          return;
        }
        if (guidedStep === 1) {
          setGuidedDraft(d => ({ ...d, description: userVal }));
          setGuidedStep(2);
          const btns = profiles.slice(0, 6).map(p => `[${p.name}]`).join(' ');
          startTypingMessage(`小人斗膽一問，Assign 俾邊個？\n${btns}\n（打名稱或 Me）`);
          return;
        }
        if (guidedStep === 2) {
          const norm = userVal.toLowerCase();
          const target = ['me','myself','我','自己'].includes(norm) ? currentUserName : userVal;
          const profile = profiles.find(p => p.name.toLowerCase() === target.toLowerCase() || p.name.toLowerCase().split(' ')[0] === target.toLowerCase());
          const resolved = profile?.name || target;
          setGuidedDraft(d => ({ ...d, assignee: resolved }));
          setGuidedStep(3);
          startTypingMessage(`小人收到，Assign 俾 ${resolved}\n\n幾時到期？\n[TBC] [Today] [Tomorrow]`);
          return;
        }
        if (guidedStep === 3) {
          let dueIso = '', dueLabel = 'TBC';
          const lower = userVal.toLowerCase();
          if (lower === 'tbc' || !userVal) { dueIso = ''; dueLabel = 'TBC'; }
          else if (['today','今日'].includes(lower)) { dueIso = new Date().toISOString().split('T')[0]; dueLabel = 'Today'; }
          else if (['tomorrow','明天','聽日'].includes(lower)) { const t=new Date();t.setDate(t.getDate()+1);dueIso=t.toISOString().split('T')[0];dueLabel='Tomorrow'; }
          else if (/^\d{4}-\d{2}-\d{2}$/.test(userVal)) { dueIso = userVal; dueLabel = userVal; }
          setGuidedDraft(d => ({ ...d, dueDate: dueIso, dueLabel }));
          setGuidedStep(4);
          setTimeout(() => {
            const draft = { ...guidedDraft, dueDate: dueIso, dueLabel };
            startTypingMessage(
              `📋 確認新增 Subtask\n\n` +
              `• 名稱：${draft.title}\n` +
              `${draft.description ? `• 描述：${draft.description}\n` : ''}` +
              `• 負責：${draft.assignee}\n` +
              `• 到期：${dueLabel}\n` +
              `• Status：Todo\n` +
              `• 綁定 Main Task：${draft.parentTaskId ? tasks.find(t => t.id === draft.parentTaskId)?.title || '已選' : '已選'}\n\n` +
              `確定要加嗎？`,
              { _action: 'confirm_create', _data: { ...draft, status: 'todo', statusLabel: '待辦', dueDate: dueIso, dueDateLabel: dueLabel } }
            );
          }, 0);
          return;
        }
      }
    }
    
    // Frontend search setup
    let searchResult: { id: string; title: string; status: string; due_date: string | null; assignees: string[]; description: string; progress: number; subtasks?: any[] } | null = null;
    // taskNamePattern removed - using universal search instead
    const normalizeTaskRef = (value: string) => value.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
    
    // CR/CRCE code must mean search/check first unless user explicitly says create/add.
    const crMatch = userText.match(/^(?:ok[:：]\s*)?(CR\s*-?\s*\d+|CRCE\s*-?\s*\d+)/i) || userText.match(/\b(CR\s*-?\s*\d+|CRCE\s*-?\s*\d+)\b/i);
    const hasPipe = userText.includes('|');
    const lines = userText.split('\n').map(l => l.trim()).filter(Boolean);
    const addSubtaskIntent = /add\s+subtask|加\s*subtask|新增\s*subtask|new\s+subtask/i.test(userText);
    const explicitCreateIntent = /我要加\s*task|加\s*task|新增|create\s*task|new\s*task/i.test(userText);
    const checkIntent = /check|查|搵|睇|點樣|status|進度|progress|咩情況/i.test(userText);
    const looksLikeMultilineTask = lines.length >= 3 && !checkIntent && !/^(check|查|搵|睇)\b/i.test(lines[0]);
    let parsedFields: any = null;
    
    // ── Subtask creation via AI text ──
    if (addSubtaskIntent) {
      setInput('');
      const myMainTasks = tasks.filter(t => !t.parent_id).slice(0, 8);
      if (myMainTasks.length === 0) {
        setActiveQuickAction(null);
        startTypingMessage(`小人謹遵台命，恩公而家冇 Main Task，不如先加個 Main Task？恩公可以打「我要加Task」開始。`);
        return;
      }
      setActiveQuickAction('add');
      createModeRef.current = 'subtask';
      setCreateMode('subtask');
      setGuidedStep(-1); // -1 = pick parent task
      setGuidedDraft({ title:'',description:'',assignee:'',dueDate:'',dueLabel:'',parentTaskId: null });
      const list = myMainTasks.map((t,i) => `${i+1}. ${t.title}`).join('\n');
      startTypingMessage(`想加 Subtask 去邊個 Main Task？\n${list}\n\n（打數字 1-${myMainTasks.length}，或 Task 名）`);
      return;
    }

    // ── Main Task creation via AI (quick help, not guided) ──
    if (explicitCreateIntent) {
      setActiveQuickAction('add');
      createModeRef.current = 'main';
      setCreateMode('main');
      setGuidedStep(0);
      setGuidedDraft({ title:'',description:'',assignee:'',dueDate:'',dueLabel:'',parentTaskId: null });
      setInput('');
      startTypingMessage('好呀～先俾我 task name。');
      return;
    }

    // Expert mode: pipe-separated or multiline bypasses guided flow
    if (hasPipe || looksLikeMultilineTask) {
      const today = new Date();
      const isoToday = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isoTomorrow = tomorrow.toISOString().split('T')[0];
      const currentYear = today.getFullYear();
      const monthMap: Record<string, number> = {
        jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
        may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
        september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
      };
      const toISO = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const getNextWeekday = (targetDay: number) => {
        const d = new Date(today);
        const currentDay = d.getDay();
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        d.setDate(d.getDate() + diff);
        return d.toISOString().split('T')[0];
      };
      const parseDueDate = (raw: string) => {
        const value = raw.trim();
        const lowerValue = value.toLowerCase();
        const dateMap: Record<string, string> = {
          today: isoToday, '今日': isoToday,
          tomorrow: isoTomorrow, '聽日': isoTomorrow, '明天': isoTomorrow,
          'next mon': getNextWeekday(1), 'next tue': getNextWeekday(2), 'next wed': getNextWeekday(3), 'next thu': getNextWeekday(4), 'next fri': getNextWeekday(5),
          monday: getNextWeekday(1), tuesday: getNextWeekday(2), wednesday: getNextWeekday(3), thursday: getNextWeekday(4), friday: getNextWeekday(5),
          '下星期一': getNextWeekday(1), '下星期二': getNextWeekday(2), '下星期三': getNextWeekday(3), '下星期四': getNextWeekday(4), '下星期五': getNextWeekday(5),
        };
        for (const [kw, iso] of Object.entries(dateMap)) {
          if (lowerValue.includes(kw.toLowerCase())) return { iso, label: value };
        }
        const isoMatch = lowerValue.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
        if (isoMatch) return { iso: toISO(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])), label: value };
        const slashMatch = lowerValue.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
        if (slashMatch) return { iso: toISO(Number(slashMatch[3] || currentYear), Number(slashMatch[2]), Number(slashMatch[1])), label: value };
        const dayMonthMatch = lowerValue.match(/\b(\d{1,2})\s+([a-z]{3,9})\b/);
        if (dayMonthMatch && monthMap[dayMonthMatch[2]]) return { iso: toISO(currentYear, monthMap[dayMonthMatch[2]], Number(dayMonthMatch[1])), label: value };
        const monthDayMatch = lowerValue.match(/\b([a-z]{3,9})\s+(\d{1,2})\b/);
        if (monthDayMatch && monthMap[monthDayMatch[1]]) return { iso: toISO(currentYear, monthMap[monthDayMatch[1]], Number(monthDayMatch[2])), label: value };
        return { iso: '', label: value || '未設定' };
      };

      const parts = hasPipe
        ? userText.split('|').map(part => part.trim()).filter(Boolean)
        : lines;
      const crCode = crMatch?.[1] ?? '';
      const title = parts[0] || crCode || '未命名 task';
      const description = parts[1] || '';
      const dueRaw = parts[2] || '';
      const assigneeRaw = parts[3] || '';
      const statusRaw = parts[4] || '';
      const parsedDue = parseDueDate(dueRaw || userText);
      const normalizedAssignee = assigneeRaw.trim().toLowerCase();
      const assigneeTarget = ['me', 'myself', '我', '自己'].includes(normalizedAssignee)
        ? currentUserName
        : assigneeRaw;
      const assignee = profiles.find(p => {
        const fullName = p.name.toLowerCase();
        const firstName = fullName.split(' ')[0];
        const target = assigneeTarget.toLowerCase() || userText.toLowerCase();
        return fullName === target || target.includes(firstName);
      })?.name || (assigneeTarget || currentUserName);

      let status = 'todo';
      let statusLabel = '待辦';
      const normalizedStatusRaw = statusRaw.trim().toLowerCase();
      if (['review', 'internal review', 'internal_review', '檢查', '審批'].includes(normalizedStatusRaw)) {
        status = 'review';
        statusLabel = 'Review';
      } else if (['wip', 'in progress', '進行中', '進行'].includes(normalizedStatusRaw)) {
        status = 'in_progress';
        statusLabel = '進行中';
      } else if (['done', 'finished', '完成'].includes(normalizedStatusRaw)) {
        status = 'finished';
        statusLabel = '完成';
      } else if (['todo', 'to do', '待辦'].includes(normalizedStatusRaw)) {
        status = 'todo';
        statusLabel = '待辦';
      }
      
      const subtaskMatch = userText.match(/Sub task[s]?[：:]\s*(.+)/i);
      const subtasks = subtaskMatch 
        ? subtaskMatch[1].split(/[,，]/).map(s => s.trim()).filter(Boolean)
        : [];
      
      parsedFields = {
        title,
        description,
        dueDate: parsedDue.iso,
        dueDateLabel: parsedDue.iso ? parsedDue.label : '未設定',
        status,
        statusLabel,
        assignee,
        subtasks
      };
      
      // Don't execute yet - show confirmation
      setInput('');
      setMessages(current => [...current, 
        { role: 'user', text: userText },
        { 
          role: 'ai', 
          text: `📋 **確認新增 Task**\n\n` +
            `**Task 名稱：** ${title}\n` +
            `${description ? `**Description：** ${description}\n` : ''}` +
            `${parsedFields.dueDateLabel ? `**到期：** ${parsedFields.dueDateLabel}\n` : ''}` +
            `**負責人：** ${assignee}\n` +
            `**Status：** ${statusLabel}\n` +
            `${subtasks.length ? `**Subtasks：** ${subtasks.join('、')}\n` : ''}` +
            `\n確定要加呢個 task 嗎？`,
          _action: 'confirm_create',
          _data: parsedFields
        }
      ]);
      return;
    }

    // ── Check for "today due" intent ──
    const todayDueIntent = /今日要交|今日到期|今日有咩做|今日做咩|due today|today due/i.test(userText);
    if (todayDueIntent && !parsedFields && !explicitCreateIntent && !addSubtaskIntent) {
      const today = new Date().toISOString().slice(0, 10);
      const todayTasks = tasks.filter(t => !t.parent_id && t.due_date === today && !t.is_finished && t.status !== 'finished' && t.status !== 'archived');
      
      if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
      setInput('');
      
      if (todayTasks.length > 0) {
        const list = todayTasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));
        startTypingMessage(`小人稟報恩公，今日有 ${todayTasks.length} 個 task 到期：\n\n${todayTasks.map((t, i) => `${i+1}. ${t.title} (${getStatusMeta(t.status).label})`).join('\n')}\n\n撳 task 名可以睇 details。`, {
          _action: 'task_list',
          _data: { tasks: list }
        });
      } else {
        startTypingMessage(`小人稟報恩公，今日暫時冇 task 到期。\n\n恩公可以問「明日有咩做？」或「我有咩未做？」睇其他 task。`);
      }
      return;
    }

    // ── Check for "overdue" intent ──
    const overdueIntent = /overdue|過期|逾期|遲咗|有咩遲咗|有咩過期/i.test(userText);
    if (overdueIntent && !parsedFields && !explicitCreateIntent && !addSubtaskIntent) {
      const today = new Date().toISOString().slice(0, 10);
      const overdueTasks = tasks.filter(t => !t.parent_id && t.due_date && t.due_date < today && !t.is_finished && t.status !== 'finished' && t.status !== 'archived');
      
      if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
      setInput('');
      
      if (overdueTasks.length > 0) {
        const list = overdueTasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));
        startTypingMessage(`小人稟報恩公，有 ${overdueTasks.length} 個 task 已過期：\n\n${overdueTasks.map((t, i) => `${i+1}. ${t.title} (到期：${t.due_date})`).join('\n')}\n\n撳 task 名可以睇 details。`, {
          _action: 'task_list',
          _data: { tasks: list }
        });
      } else {
        startTypingMessage(`小人稟報恩公，暫時冇 task 過期。恩公好嘢！👍`);
      }
      return;
    }

    // ── Check for "this week" intent ──
    const thisWeekIntent = /今個禮拜|本週|this week|呢個禮拜/i.test(userText);
    if (thisWeekIntent && !parsedFields && !explicitCreateIntent && !addSubtaskIntent) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const weekTasks = tasks.filter(t => {
        if (t.parent_id || !t.due_date || t.is_finished || t.status === 'finished' || t.status === 'archived') return false;
        const due = new Date(t.due_date);
        return due >= startOfWeek && due <= endOfWeek;
      });
      
      if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
      setInput('');
      
      if (weekTasks.length > 0) {
        const list = weekTasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));
        startTypingMessage(`小人稟報恩公，今個禮拜有 ${weekTasks.length} 個 task 到期：\n\n${weekTasks.map((t, i) => `${i+1}. ${t.title} (${t.due_date})`).join('\n')}\n\n撳 task 名可以睇 details。`, {
          _action: 'task_list',
          _data: { tasks: list }
        });
      } else {
        startTypingMessage(`小人稟報恩公，今個禮拜暫時冇 task 到期。`);
      }
      return;
    }

    // ── Check for "high priority" intent ──
    const highPriorityIntent = /high priority|urgent|緊急|急|重要|priority/i.test(userText);
    if (highPriorityIntent && !parsedFields && !explicitCreateIntent && !addSubtaskIntent) {
      const urgentTasks = tasks.filter(t => !t.parent_id && (t.priority === 'urgent' || t.priority === 'high') && !t.is_finished && t.status !== 'finished' && t.status !== 'archived');
      
      if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
      setInput('');
      
      if (urgentTasks.length > 0) {
        const list = urgentTasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));
        startTypingMessage(`小人稟報恩公，有 ${urgentTasks.length} 個 urgent/high priority task：\n\n${urgentTasks.map((t, i) => `${i+1}. ${t.title} [${t.priority.toUpperCase()}]`).join('\n')}\n\n撳 task 名可以睇 details。`, {
          _action: 'task_list',
          _data: { tasks: list }
        });
      } else {
        startTypingMessage(`小人稟報恩公，暫時冇 urgent/high priority task。`);
      }
      return;
    }

    // ── Check for "recently added" intent ──
    const recentIntent = /最近加咗|新加|最近新增|recently added|new task/i.test(userText);
    if (recentIntent && !parsedFields && !explicitCreateIntent && !addSubtaskIntent) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentTasks = tasks.filter(t => {
        if (t.parent_id) return false;
        const created = new Date(t.created_at);
        return created >= sevenDaysAgo;
      }).slice(0, 10);
      
      if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
      setInput('');
      
      if (recentTasks.length > 0) {
        const list = recentTasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));
        startTypingMessage(`小人稟報恩公，最近 7 日加咗 ${recentTasks.length} 個 task：\n\n${recentTasks.map((t, i) => `${i+1}. ${t.title} (${getStatusMeta(t.status).label})`).join('\n')}\n\n撳 task 名可以睇 details。`, {
          _action: 'task_list',
          _data: { tasks: list }
        });
      } else {
        startTypingMessage(`小人稟報恩公，最近 7 日冇新加 task。`);
      }
      return;
    }
    const tomorrowDueIntent = /明日要交|明日到期|明日有咩做|明天到期|明天要交|明天有咩做|聽日到期|聽日要交|聽日有咩做|tomorrow due|due tomorrow/i.test(userText);
    if (tomorrowDueIntent && !parsedFields && !explicitCreateIntent && !addSubtaskIntent) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      const tomorrowTasks = tasks.filter(t => !t.parent_id && t.due_date === tomorrowStr && !t.is_finished && t.status !== 'finished' && t.status !== 'archived');
      
      if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
      setInput('');
      
      if (tomorrowTasks.length > 0) {
        const list = tomorrowTasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));
        startTypingMessage(`小人稟報恩公，明日有 ${tomorrowTasks.length} 個 task 到期：\n\n${tomorrowTasks.map((t, i) => `${i+1}. ${t.title} (${getStatusMeta(t.status).label})`).join('\n')}\n\n撳 task 名可以睇 details。`, {
          _action: 'task_list',
          _data: { tasks: list }
        });
      } else {
        startTypingMessage(`小人稟報恩公，明日暫時冇 task 到期。\n\n恩公可以問「今日有咩做？」或「我有咩未做？」睇其他 task。`);
      }
      return;
    }

    const greetingIntent = /^(hi+|hello+|hey+|halo+|哈囉|你好|嗨|hey there|早晨|午安|晚安)\b/i.test(userText.trim());
    if (greetingIntent) {
      if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
      setInput('');
      setActiveQuickAction(null);
      startTypingMessage('小人喺度 ✨ 想我幫你睇 task、加 task，定係陪你傾兩句都可以。');
      return;
    }

    // ── Explicit / Search-mode Task Search ──
    // Search mode should be one-shot, and must not hijack normal task-intent questions.
    const lowerTrimmedUserText = userText.trim().toLowerCase();
    const hasExplicitSearchPrefix = /^(搵|查|睇|search|find|check)\s*/i.test(userText.trim());
    const looksLikeStructuredTaskIntent = /(focus|foucs|今日focus|show focus|focus有啲咩|focus有d咩|my task|my tasks|有咩未交|overdue|risk|風險|過期|今日有咩做|今日做咩|我今日有啲乜嘢做|今日重點|today|而家我有啲乜嘢做|有乜嘢我可以做|我依家有咩做|report\s*log|reportlog|report|加task|新增|create|add task)/.test(lowerTrimmedUserText);
    const isSearchModeQuery = activeQuickAction === 'search' && !looksLikeStructuredTaskIntent;
    if (activeQuickAction === 'search' && !hasExplicitSearchPrefix && looksLikeStructuredTaskIntent) {
      setActiveQuickAction(null);
    }
    const isExplicitSearch = hasExplicitSearchPrefix || isSearchModeQuery;
    const searchKeywords = lowerTrimmedUserText.replace(/^(搵|查|睇|search|find|check)\s*/i, '').replace(/^#/, '');
    const isKnownQuery = /^(focus|foucs|今日focus|show focus|focus有啲咩|focus有d咩|my task|my tasks|有咩未交|overdue|risk|風險|過期|今日有咩做|今日做咩|我今日有啲乜嘢做|今日重點|today|而家我有啲乜嘢做|有乜嘢我可以做|我依家有咩做)$/.test(lowerTrimmedUserText);
    if (isExplicitSearch && searchKeywords && !parsedFields && !explicitCreateIntent && !addSubtaskIntent && !isKnownQuery) {
      console.log(`[Frontend Search] Searching for: "${searchKeywords}"`);
      
      // Search in all tasks (both title and ID)
      const foundTasks = tasks.filter(t => {
        const normalizedTitle = normalizeTaskRef(t.title);
        const normalizedId = normalizeTaskRef(t.id);
        const normalizedKeyword = normalizeTaskRef(searchKeywords);
        const titleMatch = normalizedTitle.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedTitle);
        const idMatch = normalizedId.includes(normalizedKeyword);
        return titleMatch || idMatch;
      });
      
      if (foundTasks.length > 0) {
        // Show first match with details
        const foundTask = foundTasks[0];
        searchResult = {
          id: foundTask.id,
          title: foundTask.title,
          status: foundTask.status,
          due_date: foundTask.due_date || null,
          assignees: foundTask.assignees.map(a => a.name),
          description: foundTask.description || '',
          progress: foundTask.progress_percent ?? 0,
          subtasks: foundTask.subtasks?.map((s: any) => ({
            title: s.title,
            status: s.status,
            assignees: s.assignees.map((a: any) => a.name),
          })) || [],
        };
        
        if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
        setInput('');
        setActiveQuickAction(null);
        setIsReplying(true);
        
        const statusMeta2 = getStatusMeta((searchResult as any).status);
        const subtaskList2 = (searchResult as any).subtasks?.length
          ? `\n📁 Subtasks (${(searchResult as any).subtasks.length}):\n${(searchResult as any).subtasks.map((s: any) => `• ${s.title} — ${getStatusMeta(s.status).label}`).join('\n')}`
          : '';
        startTypingMessage(`✅ 搵到「${(searchResult as any).title}」\n📋 ${statusMeta2.label}  |  📅 ${(searchResult as any).due_date || '未設定'}  |  👤 ${(searchResult as any).assignees.join('/') || '未指派'}  |  📊 ${(searchResult as any).progress}%${subtaskList2}\n\n仲想改咩？`, {
          _action: 'task_actions',
          _data: { taskId: (searchResult as any).id, title: (searchResult as any).title }
        });
        setIsReplying(false);
        return;
      } else {
        // No results - show all tasks
        const allTasksList = tasks
          .filter(t => !t.parent_id)
          .slice(0, 10)
          .map((t, i) => `${i+1}. ${t.title} (${getStatusMeta(t.status).label})`)
          .join('\n');
        
        if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
        setInput('');
        setActiveQuickAction(null);
          
        startTypingMessage(`小人該死，搵唔到「${userText}」相關嘅 task。\n\n還請恩公過目全部 task 列表，或再試其他關鍵字：\n\n${allTasksList}\n\n...共 ${tasks.filter(t => !t.parent_id).length} 個 task`, {
          _action: 'task_list',
          _data: { tasks: tasks.filter(t => !t.parent_id).slice(0, 10).map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, assignees: t.assignees.map(a => a.name) })) }
        });
        return;
      }
    }
    if (LOCAL_ONLY_MODE) {
      if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
      setInput('');
      setIsReplying(true);

      const lower = userText.toLowerCase();

      const profileNames = Array.from(new Set(tasks.flatMap((task) => task.assignees?.map((assignee) => assignee.name) || []))).sort((a, b) => b.length - a.length);
      const personAliases = profileNames.flatMap((name) => {
        const lowerName = name.toLowerCase();
        const parts = lowerName.split(' ');
        const aliases = new Set<string>([lowerName, lowerName.replace(/\s+/g, ' '), parts[0]]);
        if (parts[0] && parts[0].length >= 3) aliases.add(parts[0].slice(0, 3));
        return Array.from(aliases).map((alias) => ({ alias, name }));
      }).sort((a, b) => b.alias.length - a.alias.length);
      const matchedPerson = personAliases.find((item) => lower.includes(item.alias))?.name;
      if (matchedPerson && /(focus|foucs|今日focus|show focus|focus task|focus tasks|focus有啲咩|focus有d咩|有冇focus|有無focus|有冇\s*focus|有無\s*focus)/.test(lower)) {
        setActiveQuickAction('focus');
        const personFocusTasks = tasks
          .filter(t => !t.parent_id && t.is_focus === true && !t.is_finished && t.status !== 'finished' && t.status !== 'archived' && t.assignees.some(a => a.name === matchedPerson))
          .sort((a, b) => (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99'));
        const list = personFocusTasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));
        const focusPreview = personFocusTasks.slice(0, 5).map((task, index) => `${index + 1}. ${task.title}`).join('\n');
        startTypingMessage(
          personFocusTasks.length
            ? `${matchedPerson} 而家有 ${personFocusTasks.length} 個 Focus main task：\n\n${focusPreview}${personFocusTasks.length > 5 ? `\n...仲有 ${personFocusTasks.length - 5} 個` : ''}\n\n撳 task 名可以即刻開新對話睇 detail。`
            : `${matchedPerson} 而家暫時未有標記做 Focus 嘅 main task。`,
          personFocusTasks.length
            ? {
                _action: 'task_list',
                _data: { tasks: list }
              }
            : undefined
        );
        setIsReplying(false);
        return;
      }

      if (matchedPerson && /(task|tasks|有咩做|有啲咩做|有冇做|有無做|而家做緊乜|而家做緊咩|做緊乜|做緊咩|做緊乜嘢|做緊啲乜|做乜|做咩|未做|手上|跟緊|負責|check)/.test(lower)) {
        const personTasks = tasks.filter(t => !t.parent_id && !t.is_finished && t.status !== 'finished' && t.status !== 'archived' && t.assignees.some(a => a.name === matchedPerson));
        const list = personTasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));
        const taskPreview = personTasks.slice(0, 5).map((task, index) => `${index + 1}. ${task.title}`).join('\n');
        startTypingMessage(`${matchedPerson} 大人而家手上未完成 main task 有 ${personTasks.length} 個：\n\n${taskPreview}${personTasks.length > 5 ? `\n...仲有 ${personTasks.length - 5} 個` : ''}\n\n撳 task 可以睇 details。`, {
          _action: 'task_list',
          _data: { tasks: list }
        });
        setIsReplying(false);
        return;
      }

      if (/(focus|foucs|今日focus|show focus|focus有啲咩|focus有d咩)/.test(lower)) {
        setActiveQuickAction('focus');
        const focusTasks = tasks.filter((t) => !t.parent_id && t.is_focus === true).map((t) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));
        const focusPreview = focusTasks.slice(0, 5).map((task, index) => `${index + 1}. ${task.title}`).join('\n');
        startTypingMessage(`小人稟報恩公，而家 Focus task 總共有 ${focusTasks.length} 個：\n\n${focusPreview}${focusTasks.length > 5 ? `\n...仲有 ${focusTasks.length - 5} 個` : ''}\n\n撳 task 可以睇 details。`, {
          _action: 'task_list',
          _data: { tasks: focusTasks }
        });
        setIsReplying(false);
        return;
      }

      if (/(有咩未交|overdue|risk|風險|過期)/.test(lower)) {
        const today = new Date().toISOString().slice(0, 10);
        const overdueTasks = tasks
          .filter(t => !t.parent_id && !t.is_finished && t.status !== 'finished' && t.status !== 'cancelled' && t.status !== 'archived' && t.due_date && t.due_date < today)
          .sort((a, b) => (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99'))
          .map(t => ({
            id: t.id,
            title: t.title,
            due_date: t.due_date,
            status: t.status,
            assignees: t.assignees.map(a => a.name),
          }));
        startTypingMessage(`小人稟報恩公，而家 overdue main task 有 ${overdueTasks.length} 個。撳 task 名可以即刻開新對話睇 detail。`, {
          _action: 'task_list',
          _data: { tasks: overdueTasks }
        });
        setIsReplying(false);
        return;
      }

      if (/report\s*log|reportlog|report/.test(lower)) {
        openReportLogMode();
        setIsReplying(false);
        return;
      }

      if (/my\s*task|task\s*list|我.?task/.test(lower)) {
        setActiveQuickAction('my-task');
        console.log('[MyTaskList] currentUserName:', currentUserName, 'currentUserId:', currentUserId);
        const myTasks = tasks.filter(t => {
          const isAssignee = t.assignees?.some(a => a.name === currentUserName);
          const shouldInclude = !t.parent_id && !t.is_finished && t.status !== 'finished' && t.status !== 'archived' && isAssignee;
          if (t.title.includes('CRCE') || t.title.includes('個Task俾我')) {
            console.log(`[MyTaskList] Task: ${t.title}, assignees: ${t.assignees?.map(a=>a.name).join(',')}, created_by: ${t.created_by}, isAssignee: ${isAssignee}, include: ${shouldInclude}`);
          }
          return shouldInclude;
        });
        const list = myTasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));
        startTypingMessage(`小人稟報恩公，你而家有 ${myTasks.length} 個未完成 main task。撳 task 名可以即刻開新對話睇 detail。`, {
          _action: 'task_list',
          _data: { tasks: list }
        });
        setIsReplying(false);
        return;
      }

      if (/(今日focus|focus task|focus tasks|今日有咩做|今日做咩|我今日有啲乜嘢做|今日重點|today|而家我有啲乜嘢做|有乜嘢我可以做|我依家有咩做)/.test(lower)) {
        setActiveQuickAction('focus');
        const focusTasks = tasks
          .filter((t) => !t.parent_id && t.is_focus === true)
          .sort((a, b) => (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99'));

        const list = focusTasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));

        const focusPreview = focusTasks.slice(0, 5).map((task, index) => `${index + 1}. ${task.title}`).join('\n');
        startTypingMessage(
          focusTasks.length
            ? `小人稟報恩公，今日 Focus 係而家 database 入面標記咗 Focus 嘅 main task，共 ${focusTasks.length} 個：\n\n${focusPreview}${focusTasks.length > 5 ? `\n...仲有 ${focusTasks.length - 5} 個` : ''}\n\n口徑同 landing page 一樣。撳 task 名可以即刻開新對話睇 detail。`
            : '小人稟報恩公，而家 database 入面暫時未有標記做 Focus 嘅 main task。',
          focusTasks.length
            ? {
                _action: 'task_list',
                _data: { tasks: list }
              }
            : undefined
        );
        setIsReplying(false);
        return;
      }

      const deterministicReply = tryBuildDeterministicSummary(userText, tasks, currentUserName, currentUserId);
      if (deterministicReply) {
        setActiveQuickAction(null);
        startTypingMessage(deterministicReply);
        setIsReplying(false);
        return;
      }

      // v2-reload: life-chat refresh 2026-05-09
      const looksLikeTaskQuery = /(task|tasks|deadline|due|overdue|urgent|priority|focus|今日focus|progress|status|assign|assignee|subtask|todo|in progress|done|未做|有咩做|有啲咩做|今日重點|今日到期|最 urgent|最緊急|最重要|我.?task|my\s*task|check|job|jobs|工作|任務|做唔到|放棄|做不完|交唔到|趕唔切|壓力大|好多嘢做|好多做|做左未)/.test(lower);
      const looksLikeLifeChat = /(放工|收工|今晚|放假|週末|weekend|食咩|去邊|做咩好|hea|chill|休息|行街|睇戲|玩咩|有咩好做|好食|想食|宵夜|下午茶|早餐|午餐|晚餐|飲咩|甜品|唔講公事|唔講工作|唔講task|chat|傾偈|聊聊|肚餓|餓|食嘢|肚空|餓到|餓咗|肚仔餓|好餓)/.test(lower);

      const exactDateMatch = userText.match(/(\d{1,2})\s*[\/月.-]\s*(\d{1,2})\s*(?:日|號)?/) || userText.match(/(\d{1,2})\s*(?:號|日)/);
      const asksHowMany = /(幾多個|多少個|幾多|幾個|how many)/i.test(userText);
      const asksDueOrComplete = /(完成|到期|due|deadline)/i.test(userText);
      if (exactDateMatch && asksHowMany && asksDueOrComplete) {
        const now = new Date();
        const year = now.getFullYear();
        const month = exactDateMatch[2] ? Number(exactDateMatch[1]) : now.getMonth() + 1;
        const day = exactDateMatch[2] ? Number(exactDateMatch[2]) : Number(exactDateMatch[1]);
        const targetDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const matchedTasks = tasks.filter(t => !t.parent_id && !t.is_finished && t.status !== 'finished' && t.status !== 'cancelled' && t.status !== 'archived' && t.due_date === targetDate);
        const list = matchedTasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          status: t.status,
          assignees: t.assignees.map(a => a.name),
        }));
        startTypingMessage(`小人稟報恩公，而家有 ${matchedTasks.length} 個 main task 係 ${targetDate} 到期。${matchedTasks.length ? '撳 task 名可以即刻開新對話睇 detail。' : ''}`, matchedTasks.length ? {
          _action: 'task_list',
          _data: { tasks: list }
        } : undefined);
        setIsReplying(false);
        return;
      }

      if (activeQuickAction === 'free-talk' && !looksLikeTaskQuery) {
        try {
          const reply = await generateLocalChatReply(
            bridgeUrl,
            FIXED_LOCAL_MODEL,
            buildFreeTalkPrompt(userText),
            `${sessionId}-free-talk`,
            buildDecisionContext(tasks, currentUserName, profiles.map((profile) => ({ name: profile.name }))),
          );
          setLastReplyType('life');
          setActiveQuickAction('free-talk');
          startTypingMessage(reply || '小人斗膽稟報，今日宜放鬆心神、順氣養神。恩公有咩心事，儘管講來。');
        } catch (error: any) {
          startTypingMessage(`小人斗膽稟報，今日氣場宜靜不宜躁。恩公且寬心，慢慢講，小人喺度陪住你。`);
        } finally {
          setIsReplying(false);
        }
        return;
      }

      if (looksLikeLifeChat && !looksLikeTaskQuery) {
        const lifeReplies = [
          '放工就放松下啦，食餐好嘅，hea 吓都係應該嘅 😌',
          '餓嘅話就食嘢先啦，食飽先有力做嘢 🍜',
          '想食乜？食嘢最開心 🥢',
          '放工後嘅時間係自己嘅，想做咩都好 💆\u200d♂️',
          '唔好太緊張，搵個舒服嘅地方坐低飲杯嘢先 ☕',
          '我建議試下長洲大魚蛋，或者去中環食碗靚拉麵 🍜',
          '糖水舖？豆腐花配薑汁都幾正 🍮',
          '想輕食嘅話，去茶餐廳食個蛋治奶茶啦 🥪',
          '如果唔介意遠少少，可以去西環食海鮮盅飯 🦐',
        ];
        let idx = Math.floor(Math.random() * lifeReplies.length);
        if (lifeReplies[idx] === lastLifeReply && lifeReplies.length > 1) {
          idx = (idx + 1) % lifeReplies.length;
        }
        const reply = lifeReplies[idx];
        setActiveQuickAction(null);
        setLastLifeReply(reply);
        setLastReplyType('life');
        startTypingMessage(reply);
        setIsReplying(false);
        return;
      }

      // Context-aware: if last reply was life-chat, keep the casual vibe
      if (lastReplyType === 'life' && !looksLikeTaskQuery) {
        const followUpReplies = [
          '再講多樣：冰室嘅奶油豬都幾好食 🥐',
          '或者去試下新開嘅 cafe，飲杯凍檸茶 ☕',
          '你想食辣定清淡？我可以再 narrow down 😄',
          '長洲街市附近都有幾間隱世好食嘅店 🏮',
          '最緊要食得開心，唔好諗咁多，隨便搵間順眼嘅入去就得 🍽️',
        ];
        let idx = Math.floor(Math.random() * followUpReplies.length);
        if (followUpReplies[idx] === lastLifeReply && followUpReplies.length > 1) {
          idx = (idx + 1) % followUpReplies.length;
        }
        const reply = followUpReplies[idx];
        setActiveQuickAction(null);
        setLastLifeReply(reply);
        setLastReplyType('life');
        startTypingMessage(reply);
        setIsReplying(false);
        return;
      }

      try {
        setActiveQuickAction(null);
        const reply = await generateLocalChatReply(
          bridgeUrl,
          FIXED_LOCAL_MODEL,
          userText,
          sessionId,
          buildDecisionContext(tasks, currentUserName, profiles.map((profile) => ({ name: profile.name }))),
        );
        startTypingMessage(reply || '我收到你嘅問題，但今次本地 AI 未完整答到。你可以再問得直接少少，例如：我依家最應該做邊樣先？');
      } catch (error: any) {
        startTypingMessage(`${error?.message || '本地 AI 暫時無法回應。'}\n\n你可以再試一次，或者直接問：今日有咩做／最 urgent 係乜。`);
      } finally {
        setIsReplying(false);
      }
      return;
    }

    // Show user message immediately
    if (shouldEchoUserBubble) setMessages(current => [...current, { role: 'user', text: userText }]);
    setInput('');
    setIsReplying(true);

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 90000); // 90s timeout
      
      const resp = await fetch(`${bridgeUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText, session_id: sessionId, context: getContext(searchResult) }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      let data: any = null;
      try {
        data = await resp.json();
      } catch {
        data = null;
      }

      const replyText = data?.reply || '';
      const upstreamAuthBroken = /User not found/i.test(replyText) || /HTTP Error 401/i.test(replyText);

      if (!resp.ok || upstreamAuthBroken) {
        if (searchResult) {
          const sr = searchResult as any;
          const statusMetaFallback = getStatusMeta(sr.status);
          startTypingMessage(
            `✅ 搵到「${sr.title}」\n📋 ${statusMetaFallback.label}  |  📅 ${sr.due_date || '未設定'}  |  👤 ${sr.assignees?.join('/') || '未指派'}  |  📊 ${sr.progress ?? 0}%\n\n仲想改咩？`,
            { _action: 'task_actions', _data: { taskId: sr.id, title: sr.title } }
          );
          return;
        }

        const friendly = upstreamAuthBroken
          ? '小人稟報恩公，AI backend 而家登入有問題，小人已經搵到原因，唔係恩公操作錯。恩公而家仍然可以先用快捷功能：check task、加 task、睇今日Focus。'
          : `AI 暫時無法回應：HTTP ${resp.status}`;
        throw new Error(friendly);
      }
      
      // Execute action if any - but only if parameters are valid
      let actionResult = '';
      if (data.action && data.action.action) {
        const act = data.action;
        const isValid = (
          (act.action === 'create_task' && act.title && act.title.trim()) ||
          (act.action === 'update_task' && (act.task_id || act.task_ref)) ||
          (act.action === 'delete_task' && (act.task_id || act.task_ref))
        );
        if (isValid) {
          actionResult = await executeAction(data.action);
        }
      }
      
      // Execute multiple actions if present (e.g., multiple subtasks)
      if (data.actions && Array.isArray(data.actions)) {
        const results = [];
        for (const act of data.actions) {
          const isValid = (
            (act.action === 'create_task' && act.title && act.title.trim()) ||
            (act.action === 'update_task' && (act.task_id || act.task_ref)) ||
            (act.action === 'delete_task' && (act.task_id || act.task_ref))
          );
          if (isValid) {
            results.push(await executeAction(act));
          }
        }
        actionResult = results.join('\n\n');
      }
      
      // Final reply - use typewriter effect
      const finalReply = [data.reply, actionResult].filter(Boolean).join('\n\n');
      setMessages(current => current.filter(m => m.text !== '諗緊…'));
      startTypingMessage(finalReply || '收到。');
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages(current => current.filter(m => m.text !== '諗緊…'));
        startTypingMessage('AI 諗得太耐，可能網絡慢或者伺服器忙。請再試一次，或者打短啲嘅問題。');
      } else {
        setMessages(current => current.filter(m => m.text !== '諗緊…'));
        startTypingMessage(`${error?.message || '小人稟報恩公，AI 暫時無法回應，還請恩公檢查網絡連接。'}\n\n恩公可以繼續用小人嘅基本功能，例如：\n• 撳「我要加Task」逐步加 task\n• 問「有咩未交？」睇風險`);
      }
    } finally {
      setIsReplying(false);
    }
  };

  const showIntroCard = !!introText && messages.length === 0;
  const visibleMessages = messages;
  const isDesktopViewport = typeof window !== 'undefined' ? window.innerWidth >= 768 : false;

  return (
    <div style={{ minHeight: '100vh', height: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr auto', background: 'linear-gradient(180deg, #f0f9ff 0%, #f8fafc 100%)', overflow: 'hidden' }}>
      <header style={{ padding: '14px 16px 10px', background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(226,232,240,0.9)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <BackButton onClick={() => navigate('/canton-mode')} label="Canton" style={{ padding: '10px 12px' }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, color: '#0369a1', fontWeight: 950 }}><Sparkles size={17} /> Silly AI <VersionBadge align="inline" /></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 700 }}>
              Local AI: Qwen 2.5 3B
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 600 }}>
              speed + accuracy mode
            </div>
          </div>
        </div>
      </header>

      <main style={{ overflow: 'hidden', padding: keyboardInset > 0 ? '6px 16px 0' : '14px 16px 0', paddingBottom: `${composerHeight + keyboardInset + 8}px`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', minHeight: 0 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: keyboardInset > 0 ? 6 : 10, overflowY: 'auto', justifyContent: isDesktopViewport ? 'flex-start' : 'flex-end', paddingBottom: keyboardInset > 0 ? 6 : 16, minHeight: 0, flex: 1, overscrollBehavior: 'contain' }}>
          {visibleMessages.map((message, index) => {
            const isCompactTaskListBubble = message.role === 'ai' && message._action === 'task_list';
            const compactTaskListText = isCompactTaskListBubble
              ? (message.text.split('\n').find(line => line.trim()) || '小人搵到喇，請大人過目。')
              : '';
            return (
            <div key={message.id ?? index} style={{ 
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', 
              maxWidth: '90%', 
              minWidth: message.role === 'user' ? undefined : 'min(90%, 300px)',
              whiteSpace: 'pre-wrap', 
              padding: message.role === 'user' ? '13px 15px' : '16px 17px', 
              borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '20px 20px 20px 4px', 
              background: message.role === 'user' ? '#111827' : '#fff', 
              color: message.role === 'user' ? '#fff' : '#0f172a', 
              fontSize: message.role === 'user' ? 16 : 17, 
              lineHeight: 1.48, 
              fontWeight: message.role === 'user' ? 800 : 400, 
              letterSpacing: '-0.01em', 
              boxShadow: message.role === 'user' ? 'none' : '0 8px 24px rgba(148,163,184,0.12)' 
            }}>
              {renderMessage(isCompactTaskListBubble ? compactTaskListText : message.text, message.role)}
              {isTyping && typingMessageId && message.id === typingMessageId && (
                <span style={{ 
                  display: 'inline-block', 
                  width: 2, 
                  height: '1em', 
                  background: '#0369a1', 
                  marginLeft: 2,
                  animation: 'blink 1s step-end infinite',
                  verticalAlign: 'text-bottom'
                }} />
              )}
              
              {/* Confirmation/buttons/panels should appear only after typing is done for that message */}
              {(!isTyping || message.id !== typingMessageId) && message._action === 'confirm_create' && message._data && (() => {
                const actionKey = getCreateActionKey(message._data);
                const lockState = lockedCreateActions[actionKey];
                const isLocked = Boolean(lockState) || isReplying;
                return (
                  <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                    <button 
                      disabled={isLocked}
                      onClick={() => handleConfirmCreate(message._data)}
                      style={{ 
                        flex: 1, 
                        background: isLocked ? '#cbd5e1' : '#0f172a', 
                        color: isLocked ? '#64748b' : '#fff', 
                        border: 'none', 
                        borderRadius: 12, 
                        padding: '10px 16px', 
                        fontSize: 15, 
                        fontWeight: 700,
                        cursor: isLocked ? 'default' : 'pointer',
                        opacity: isLocked ? 0.68 : 1
                      }}
                    >
                      {lockState === 'confirming' ? '⏳ 建立中…' : lockState === 'cancelled' ? '✅ 已取消' : '✅ Confirm 建立'}
                    </button>
                    <button 
                      disabled={isLocked}
                      onClick={() => handleCancelCreate(message._data)}
                      style={{ 
                        flex: 1, 
                        background: isLocked ? '#e2e8f0' : '#f1f5f9', 
                        color: isLocked ? '#94a3b8' : '#64748b', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: 12, 
                        padding: '10px 16px', 
                        fontSize: 15, 
                        fontWeight: 600,
                        cursor: isLocked ? 'default' : 'pointer',
                        opacity: isLocked ? 0.68 : 1
                      }}
                    >
                      ❌ Cancel
                    </button>
                  </div>
                );
              })()}

              {(!isTyping || message.id !== typingMessageId) && message._action === 'task_actions' && message._data && (() => {
                const taskId = message._data.taskId;
                const title = message._data.title;
                const selectedTask = getLatestTask(taskId);
                const isSubtask = !!selectedTask?.parent_id;
                const hasSubtasks = (selectedTask?.subtask_count ?? 0) > 0;
                const focusLabel = selectedTask?.is_focus ? 'Unfocus' : 'Focus';
                return (
                  <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button disabled={isReplying} onClick={() => {
                        resetInlineTaskPanels();
                        setDueDatePicker(null);
                        setPendingTaskAction({ taskId, title, kind: 'today' });
                        setInput(`${title} 今日做咗：\n`);
                        scrollToInput();
                      }} style={actionButtonStyle()}>今日做咗</button>
                      <button disabled={isReplying} onClick={() => {
                        resetInlineTaskPanels();
                        setDueDatePicker(null);
                        setPendingTaskAction({ taskId, title, kind: 'tomorrow' });
                        setInput(`${title} 明天focus：\n`);
                        scrollToInput();
                      }} style={actionButtonStyle()}>明天做乜</button>
                      <button disabled={isReplying} onClick={() => {
                        resetInlineTaskPanels();
                        setDueDatePicker(null);
                        setPendingTaskAction({ taskId, title, kind: 'blocker' });
                        setInput(`${title} blocker：\n`);
                        scrollToInput();
                      }} style={actionButtonStyle()}>Blocker</button>
                      <button disabled={isReplying} onClick={() => void quickUpdateTask(taskId, title, { is_focus: !(selectedTask?.is_focus ?? false) }, `${focusLabel}：${selectedTask?.is_focus ? 'No' : 'Yes'}`)} style={actionButtonStyle(selectedTask?.is_focus ? 'focus' : 'soft')}>{focusLabel}</button>
                      <button disabled={isReplying} onClick={() => {
                        clearInputAndPanels();
                        setOpenPanel(current => current.taskId === taskId && current.panel === 'status' ? { taskId: '', panel: null } : { taskId, panel: 'status' });
                      }} style={actionButtonStyle(openPanel.taskId === taskId && openPanel.panel === 'status' ? 'primary' : undefined)}>Status</button>
                      <button disabled={isReplying} onClick={() => {
                        const willOpen = subtaskComposerTaskId !== taskId;
                        setInput('');
                        setPendingTaskAction(null);
                        setDueDatePicker(null);
                        setOpenPanel({ taskId: '', panel: null });
                        setAssigneePickerTaskId(null);
                        setPendingDeleteTaskId(null);
                        setProgressSlider(null);
                        setExpandedSubtaskId(null);
                        setSubtaskComposerTaskId(current => current === taskId ? null : taskId);
                        if (willOpen) {
                          ensureElementVisibleAboveKeyboard(subtaskComposerRef.current, 140);
                        }
                      }} style={actionButtonStyle(subtaskComposerTaskId === taskId ? 'primary' : undefined)}>加 Subtask</button>
                      <button disabled={isReplying} onClick={() => {
                        clearInputAndPanels();
                        setPendingTaskAction(null);
                        const isOpening = !(openPanel.taskId === taskId && openPanel.panel === 'progress');
                        if (isOpening) {
                          const task = getLatestTask(taskId);
                          setProgressSlider({ taskId, title, value: task?.progress_percent ?? 0 });
                          setOpenPanel({ taskId, panel: 'progress' });
                        } else {
                          setProgressSlider(null);
                          setOpenPanel({ taskId: '', panel: null });
                        }
                      }} style={actionButtonStyle(openPanel.taskId === taskId && openPanel.panel === 'progress' ? 'primary' : undefined)}>改進度</button>
                      <button disabled={isReplying} onClick={() => {
                        clearInputAndPanels();
                        setOpenPanel(current => current.taskId === taskId && current.panel === 'more' ? { taskId: '', panel: null } : { taskId, panel: 'more' });
                      }} style={actionButtonStyle(openPanel.taskId === taskId && openPanel.panel === 'more' ? 'primary' : undefined)}>其他</button>
                    </div>

                    {openPanel.taskId === taskId && openPanel.panel === 'status' && (
                      <div ref={statusPickerRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 10, paddingBottom: 18, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', maxHeight: 'min(52vh, 360px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        {[
                          ['Todo', 'todo'],
                          ['Planning', 'planning'],
                          ['WIP', 'in_progress'],
                          ['Internal Review', 'internal_review'],
                          ['Round 1 WIP', 'round_1_wip'],
                          ['Round 1 Review', 'round_1_review'],
                          ['Round 2 WIP', 'round_2_wip'],
                          ['Round 2 Review', 'round_2_review'],
                          ['Round 3 WIP', 'round_3_wip'],
                          ['Round 3 Review', 'round_3_review'],
                          ['Pending for NFC', 'pending_mpfa_pc_nfc'],
                          ['Finished', 'finished'],
                          ['Archived', 'archived'],
                        ].filter(([, value]) => {
                          // Subtasks cannot be 'finished'
                          if (isSubtask && value === 'finished') return false;
                          // Main tasks with subtasks cannot manually set 'finished' - computed from subtasks
                          if (!isSubtask && hasSubtasks && value === 'finished') return false;
                          return true;
                        }).map(([label, value]) => (
                          <button key={value} disabled={isReplying} onClick={() => void quickUpdateTask(taskId, title, { status: value as TaskStatus, is_finished: value === 'finished' || value === 'archived', is_focus: value === 'finished' || value === 'archived' ? false : selectedTask?.is_focus, progress_percent: value === 'finished' || value === 'archived' ? 100 : selectedTask?.progress_percent }, `Status：${label}`)} style={actionButtonStyle(value === selectedTask?.status ? 'focus' : 'panel')}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {openPanel.taskId === taskId && openPanel.panel === 'more' && (
                      <div ref={morePanelRef} style={{ display: 'grid', gap: 10, padding: 10, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {!isSubtask && !hasSubtasks && <button disabled={isReplying} onClick={() => void quickUpdateTask(taskId, title, { status: 'finished', progress_percent: 100, is_finished: true, is_focus: false }, '堅係Finished：100% Finished')} style={actionButtonStyle('focus')}>堅係Finished</button>}
                          <button disabled={isReplying} onClick={() => {
                            setAssigneePickerTaskId(current => current === taskId ? null : taskId);
                            setSubtaskComposerTaskId(null);
                          }} style={actionButtonStyle('panel')}>邊個做</button>
                          <button disabled={isReplying} onClick={() => {
                            clearInputAndPanels();
                            setDueDatePicker({ taskId, title, value: '' });
                          }} style={actionButtonStyle('panel')}>改Due date</button>
                          <button disabled={isReplying} onClick={() => { setPendingDeleteTaskId(taskId); setAssigneePickerTaskId(null); setSubtaskComposerTaskId(null); }} style={actionButtonStyle('danger')}>刪除</button>
                        </div>

                        {pendingDeleteTaskId === taskId && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10, background: '#fff1f2', borderRadius: 16, border: '1px solid #fecdd3' }}>
                            <div style={{ fontWeight: 800, color: '#be123c' }}>確定要刪除「{title}」？</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <button disabled={isReplying} onClick={() => void handleDeleteTask(taskId)} style={actionButtonStyle('danger')}>Confirm 刪除</button>
                              <button disabled={isReplying} onClick={() => setPendingDeleteTaskId(null)} style={actionButtonStyle()}>取消</button>
                            </div>
                          </div>
                        )}

                        {assigneePickerTaskId === taskId && (
                          <div ref={assigneePickerRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {profiles.map(profile => (
                              <button key={profile.id} disabled={isReplying} onClick={() => void assignTaskTo(taskId, title, profile)} style={actionButtonStyle(selectedTask?.assignees.some(a => a.id === profile.id) ? 'primary' : 'soft')}>
                                {profile.name.split(' ')[0]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {subtaskComposerTaskId === taskId && (
                      <div ref={subtaskComposerRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {['Web','App','Kiosk'].map(pr => (
                            <button
                              key={pr}
                              disabled={isReplying}
                              onClick={() => {
                                const parentTask = getLatestTask(taskId);
                                if (!parentTask) return;
                                setIsReplying(true);
                                createTask({
                                  title: pr,
                                  description: '',
                                  status: 'todo',
                                  priority: 'medium',
                                  due_date: parentTask.due_date || undefined,
                                  assignee_ids: parentTask.assignees.map(a => a.id) || [],
                                  tags: [],
                                  parent_id: taskId,
                                }).then(async () => {
                                  await loadTasks();
                                  const fresh = getLatestTask(taskId);
                                  if (fresh) updateTaskActionBubble(fresh);
                                }).catch((e: any) => {
                                  startTypingMessage(`❌ 加 Subtask 失敗：${e?.message || 'Unknown error'}`);
                                }).finally(() => {
                                  setIsReplying(false);
                                });
                              }}
                              style={{ ...actionButtonStyle('soft'), fontSize: 12, padding: '6px 10px' }}
                            >
                              +{pr}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                          <input value={subtaskDrafts[taskId] || ''} onChange={(e) => setSubtaskDrafts(current => ({ ...current, [taskId]: e.target.value }))} placeholder="SubTask 名稱" disabled={isReplying} style={{ minWidth: 0, border: '1px solid #bae6fd', borderRadius: 14, padding: '11px 12px', fontSize: 15, fontWeight: 700 }} />
                          <button
                            disabled={isReplying || !(subtaskDrafts[taskId] || '').trim()}
                            onClick={() => void addSubtask(taskId, title)}
                            style={actionButtonStyle('primary')}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}

                    {openPanel.taskId === taskId && openPanel.panel === 'progress' && (
                      <div data-testid="progress-slider" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, background: '#f0f9ff', borderRadius: 16, border: '1px solid #bae6fd' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: 16 }}>進度：{progressSlider?.value ?? 0}%</span>
                          <span style={{ fontSize: 13, color: '#64748b' }}>{title}</span>
                        </div>
                        <input
                          className="progress-range"
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={progressSlider?.value ?? 0}
                          onChange={(e) => setProgressSlider(prev => prev ? { ...prev, value: Number(e.target.value) } : null)}
                          disabled={isReplying}
                          style={{ width: '100%' }}
                        />
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button disabled={isReplying} onClick={() => {
                            if (!progressSlider) return;
                            const nextProgress = progressSlider.value;
                            setProgressSlider(null);
                            void quickUpdateTask(taskId, title, {
                              progress_percent: nextProgress,
                              status: nextProgress >= 100 ? 'finished' : (selectedTask?.status === 'todo' ? 'in_progress' : selectedTask?.status),
                              is_finished: nextProgress >= 100,
                            }, `Progress：${nextProgress}%`);
                          }} style={{ flex: 1, ...actionButtonStyle('primary') }}>Confirm</button>
                          <button disabled={isReplying} onClick={() => setProgressSlider(null)} style={{ flex: 1, ...actionButtonStyle() }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Subtasks with inline edit - only one expanded at a time */}
                    {hasSubtasks && selectedTask?.subtasks && selectedTask.subtasks.length > 0 && (
                      <div style={{ marginTop: 10, padding: '12px 14px', background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#64748b', marginBottom: 10 }}>📁 Subtasks ({selectedTask.subtasks.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedTask.subtasks.map((sub) => (
                            <SubtaskInlineEdit
                              key={sub.id}
                              subtask={sub}
                              profiles={profiles}
                              isExpanded={expandedSubtaskId === sub.id}
                              onToggle={() => {
                                if (expandedSubtaskId === sub.id) {
                                  setExpandedSubtaskId(null);
                                } else {
                                  setExpandedSubtaskId(sub.id);
                                  // Close other panels when opening subtask
                                  setOpenPanel({ taskId: '', panel: null });
                                }
                              }}
                              onUpdate={async () => {
                                await loadTasks();
                                const fresh = getLatestTask(taskId);
                                if (fresh) updateTaskActionBubble(fresh);
                              }}
                              onDelete={async (subtaskId) => {
                                setIsReplying(true);
                                try {
                                  await deleteTask(subtaskId);
                                  await loadTasks();
                                  const fresh = getLatestTask(taskId);
                                  if (fresh) updateTaskActionBubble(fresh);
                                } catch (e: any) {
                                  startTypingMessage(`❌ 刪除失敗：${e?.message || 'Unknown error'}`);
                                } finally {
                                  setIsReplying(false);
                                }
                              }}
                              isReplying={isReplying}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(!isTyping || message.id !== typingMessageId) && message._action === 'task_not_found' && message._data && (
                <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                  <button onClick={() => { setInput(`${message._data.code} | `); }} style={{ flex: 1, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 14, padding: '11px 10px', fontSize: 14, fontWeight: 900 }}>
                    加新Task
                  </button>
                  <button onClick={() => { setInput(message._data.originalText); }} style={{ flex: 1, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 14, padding: '11px 10px', fontSize: 14, fontWeight: 900 }}>
                    再搵一次
                  </button>
                </div>
              )}

              {message._action === 'report_log_list' && message._data && (() => {
                const withLogsToday = message._data.withLogsToday || [];
                const withoutLogsToday = message._data.withoutLogsToday || [];
                const reportDate = message._data.reportDate || reportLogDate;
                const counts = message.id
                  ? (revealedReportCounts[message.id] ?? { withLogs: withLogsToday.length, withoutLogs: withoutLogsToday.length })
                  : { withLogs: withLogsToday.length, withoutLogs: withoutLogsToday.length };
                const visibleWithLogs = withLogsToday.slice(0, counts.withLogs);
                const visibleWithoutLogs = withoutLogsToday.slice(0, collapsedNoReportSection ? 0 : (counts.withoutLogs || withoutLogsToday.length));
                const animatedItemStyle: CSSProperties = {
                  animation: 'taskListRiseIn 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                  transformOrigin: '50% 100%'
                };
                return (
                  <div ref={reportAnchorRef} style={{ marginTop: 14, display: 'grid', gap: 14, width: '100%', scrollMarginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <button onClick={() => openReportLogMode(shiftReportDate(reportDate, -1))} style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid #dbeafe', background: '#fff', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={18} /></button>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0D8A9C' }}>Ready for report</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{formatReportDateLabel(reportDate)}</div>
                      </div>
                      <button onClick={() => openReportLogMode(shiftReportDate(reportDate, 1))} style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid #dbeafe', background: '#fff', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={18} /></button>
                    </div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {withLogsToday.length === 0 ? (
                        <div style={{ padding: '12px 14px', borderRadius: 16, background: '#f8fafc', color: '#64748b', fontSize: 14 }}>今日暫時未有 report log。</div>
                      ) : visibleWithLogs.map((task: any) => (
                        <div key={task.id} style={{ ...animatedItemStyle, padding: '14px 14px 12px', borderRadius: 18, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'grid', gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>{task.title}</div>
                            <div style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>{task.status}｜{task.assignees?.join('、') || '未指派'}｜{task.due_date || '未設定'}</span>
                            </div>
                          </div>
                          {renderAssigneeEditor(task.id, task.title, (tasks.find((item) => item.id === task.id)?.assignees || []).map((item) => ({ id: item.id, name: item.name })))}
                          {task.subtasks?.length > 0 && (
                            <div style={{ display: 'grid', gap: 8, padding: '10px 12px', borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: 12, fontWeight: 900, color: '#64748b' }}>Subtasks ({task.subtasks.length})</div>
                              {task.subtasks.map((subtask: any) => (
                                <div key={subtask.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
                                  <div style={{ minWidth: 0, flex: 1, fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtask.title}</div>
                                  <div style={{ width: 96, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.max(0, Math.min(100, subtask.progress || 0))}%`, height: '100%', borderRadius: 999, background: subtask.status === 'finished' || subtask.progress >= 100 ? '#22c55e' : '#38bdf8' }} />
                                    </div>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', minWidth: 34, textAlign: 'right' }}>{subtask.progress}%</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize: 14, lineHeight: 1.55, color: '#334155' }}>{task.summary || 'No report summary yet.'}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                            <button onClick={() => openReportFieldEditor(task.id, 'today', reportDate)} style={actionButtonStyle(reportEditorState?.taskId === task.id && reportEditorState?.field === 'today' ? 'focus' : (task.hasToday ? 'success' : 'panel'))}>做咗乜</button>
                            <button onClick={() => openReportFieldEditor(task.id, 'tomorrow', reportDate)} style={actionButtonStyle(reportEditorState?.taskId === task.id && reportEditorState?.field === 'tomorrow' ? 'focus' : (task.hasTomorrow ? 'success' : 'panel'))}>明天做</button>
                            <button onClick={() => openReportFieldEditor(task.id, 'blocker', reportDate)} style={actionButtonStyle(reportEditorState?.taskId === task.id && reportEditorState?.field === 'blocker' ? 'focus' : (task.hasBlocker ? 'success' : 'panel'))}>Blocker</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ height: 1, background: '#e2e8f0', margin: '2px 0' }} />
                      <button onClick={() => setCollapsedNoReportSection(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', background: 'transparent', padding: 0, color: '#0D8A9C', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}>
                        <span>No report yet · {withoutLogsToday.length} tasks</span>
                        <span>{collapsedNoReportSection ? '＋' : '－'}</span>
                      </button>
                      {!collapsedNoReportSection && (
                        <div style={{ display: 'grid', gap: 10 }}>
                          {visibleWithoutLogs.map((task: any) => (
                            <div key={task.id} style={{ ...animatedItemStyle, padding: '14px 14px 12px', borderRadius: 18, background: '#ffffff', border: '1px solid #e2e8f0', display: 'grid', gap: 10 }}>
                              <div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>{task.title}</div>
                                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{task.status}｜{task.assignees?.join('、') || '未指派'}｜{task.due_date || '未設定'}</div>
                              </div>
                              {renderAssigneeEditor(task.id, task.title, (tasks.find((item) => item.id === task.id)?.assignees || []).map((item) => ({ id: item.id, name: item.name })))}
                              {task.subtasks?.length > 0 && (
                                <div style={{ display: 'grid', gap: 8, padding: '10px 12px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                  <div style={{ fontSize: 12, fontWeight: 900, color: '#64748b' }}>Subtasks ({task.subtasks.length})</div>
                                  {task.subtasks.map((subtask: any) => (
                                    <div key={subtask.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
                                      <div style={{ minWidth: 0, flex: 1, fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtask.title}</div>
                                      <div style={{ width: 96, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                                          <div style={{ width: `${Math.max(0, Math.min(100, subtask.progress || 0))}%`, height: '100%', borderRadius: 999, background: subtask.status === 'finished' || subtask.progress >= 100 ? '#22c55e' : '#38bdf8' }} />
                                        </div>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', minWidth: 34, textAlign: 'right' }}>{subtask.progress}%</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{ color: '#94a3b8', fontSize: 13 }}>No report yet today.</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                <button onClick={() => openReportFieldEditor(task.id, 'today', reportDate)} style={actionButtonStyle(reportEditorState?.taskId === task.id && reportEditorState?.field === 'today' ? 'focus' : 'panel')}>做咗乜</button>
                                <button onClick={() => openReportFieldEditor(task.id, 'tomorrow', reportDate)} style={actionButtonStyle(reportEditorState?.taskId === task.id && reportEditorState?.field === 'tomorrow' ? 'focus' : 'panel')}>明天做</button>
                                <button onClick={() => openReportFieldEditor(task.id, 'blocker', reportDate)} style={actionButtonStyle(reportEditorState?.taskId === task.id && reportEditorState?.field === 'blocker' ? 'focus' : 'panel')}>Blocker</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <button onClick={() => void exportCurrentReport(reportDate)} style={{ border: '1px solid #0f172a', background: '#0f172a', color: '#fff', borderRadius: 999, padding: '10px 14px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
                          Gen Report
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {message._action === 'task_list' && message._data?.tasks && (() => {
                const messageKey = `${index}-${message.text}`;
                const isThisTypingMessage = isTyping && message.id === typingMessageId;
                if (isThisTypingMessage) return null;
                const isStreamingThisList = !!message.id && message.id === streamingTaskListMessageId;
                const manualVisibleCount = taskListVisibleCounts[messageKey] ?? 10;
                const streamedVisibleCount = message.id ? (revealedTaskListCounts[message.id] ?? 0) : 0;
                const visibleCount = isStreamingThisList ? streamedVisibleCount : manualVisibleCount;
                const visibleTasks = message._data.tasks.slice(0, visibleCount);
                const hasMore = !isStreamingThisList && message._data.tasks.length > visibleCount;
                const animatedItemStyle: CSSProperties = {
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: '#0369a1',
                  fontSize: 16,
                  fontWeight: 800,
                  lineHeight: 1.45,
                  animation: 'taskListRiseIn 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                  transformOrigin: '50% 100%'
                };
                return (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {visibleTasks.map((task: any) => (
                      <button data-testid={`task-list-item-${task.id}`} key={task.id} onClick={() => {
                        const selectedTask = tasks.find(t => t.id === task.id);
                        setMessages(current => [...current, { role: 'user', text: `check ${task.title}` }]);
                        if (selectedTask) {
                          showTaskActions(selectedTask);
                        } else {
                          startTypingMessage('呢個 task 資料剛剛 refresh 咗，請再撳一次 task list。');
                        }
                      }} style={isStreamingThisList ? animatedItemStyle : { textAlign: 'left', background: 'transparent', border: 'none', padding: 0, color: '#0369a1', fontSize: 16, fontWeight: 800, lineHeight: 1.45 }}>
                        <span style={{ textDecoration: 'underline', fontSize: 19, fontWeight: 400 }}>{task.title}</span>
                        <div style={{ color: '#64748b', textDecoration: 'none', fontSize: 13, fontWeight: 400, marginTop: 2 }}>
                          {task.status}｜{task.assignees?.join('、') || '未指派'}｜{task.due_date || '未設定'}
                        </div>
                      </button>
                    ))}
                    {hasMore && (
                      <button
                        onClick={() => setTaskListVisibleCounts((current) => ({ ...current, [messageKey]: visibleCount + 10 }))}
                        style={{ alignSelf: 'flex-start', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', borderRadius: 999, padding: '8px 14px', fontSize: 14, fontWeight: 800 }}
                      >
                        ↓ 顯示更多（再睇 10 個）
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          );})}
          <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
          @keyframes taskListRiseIn { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes reportRiseIn { 0% { opacity: 0; transform: translateY(24px); } 100% { opacity: 1; transform: translateY(0); } }`}</style>
          <div ref={chatEndRef} />
          </div>
        </div>
      </main>

      {editingTaskFromChat && (
        <TaskFormModal
          mode="edit"
          variant="canton"
          initialTask={editingTaskFromChat}
          onClose={() => setEditingTaskFromChat(null)}
          onCreated={async () => {
            const fresh = await loadTasks();
            if (fresh) {
              const updated = fresh.find(task => task.id === editingTaskFromChat.id) || null;
              setEditingTaskFromChat(updated);
              if (updated) updateTaskActionBubble(updated);
            }
          }}
        />
      )}

      {dueDatePicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setDueDatePicker(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', minHeight: '46vh', background: 'linear-gradient(180deg, #fffafc 0%, #ffffff 18%)', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: '10px 16px calc(8px + env(safe-area-inset-bottom))', boxShadow: '0 -12px 40px rgba(15,23,42,0.2)', borderTop: '1px solid rgba(251,207,232,0.8)' }}>
            <div style={{ width: 42, height: 5, borderRadius: 999, background: '#cbd5e1', margin: '0 auto 10px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <img src="/taskflow-v2/hamster-mascot.jpg" alt="hamster" style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover', border: '3px solid #fce7f3', boxShadow: '0 6px 16px rgba(244,114,182,0.18)' }} />
              <div>
                <div style={{ fontWeight: 900, color: '#0f172a', fontSize: 20 }}>改 Due date</div>
                <div style={{ color: '#be185d', fontWeight: 700, fontSize: 13 }}>揀個好日俾佢啦～</div>
              </div>
            </div>
            <div style={{ color: '#475569', fontWeight: 700, marginBottom: 14 }}>{dueDatePicker.title}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <button onClick={() => applyDueDate(dueDatePicker.taskId, dueDatePicker.title, new Date().toISOString().slice(0,10))} style={{ border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', borderRadius: 999, padding: '10px 14px', fontWeight: 800 }}>☀️ 今日</button>
              <button onClick={() => { const d = new Date(); d.setDate(d.getDate()+1); applyDueDate(dueDatePicker.taskId, dueDatePicker.title, d.toISOString().slice(0,10)); }} style={{ border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', borderRadius: 999, padding: '10px 14px', fontWeight: 800 }}>🌤️ 聽日</button>
              <button onClick={() => applyDueDate(dueDatePicker.taskId, dueDatePicker.title, null)} style={{ border: '1px solid #fecdd3', background: '#fff1f2', color: '#be123c', borderRadius: 999, padding: '10px 14px', fontWeight: 800 }}>🧹 清除日期</button>
            </div>
            <input type="date" aria-label="其他好日" title="其他好日" value={dueDatePicker.value} onChange={(e) => setDueDatePicker(current => current ? { ...current, value: e.target.value } : current)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 14, padding: '14px 16px', fontSize: 18, marginBottom: 14, background: '#fff' }} />
            <div style={{ color: '#94a3b8', fontSize: 14, fontWeight: 700, marginTop: -6, marginBottom: 14 }}>📅 其他好日</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => applyDueDate(dueDatePicker.taskId, dueDatePicker.title, dueDatePicker.value || null)} style={{ flex: 1, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 14, padding: '14px 16px', fontWeight: 800, fontSize: 17 }}>Confirm</button>
              <button onClick={() => setDueDatePicker(null)} style={{ flex: 1, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', fontWeight: 800, fontSize: 17 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <footer ref={footerRef as any} style={{ position: 'fixed', left: 0, right: 0, bottom: keyboardInset, zIndex: 30, padding: keyboardInset > 0 ? '4px 16px calc(8px + env(safe-area-inset-bottom))' : '10px 16px calc(12px + env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(18px)', borderTop: '1px solid rgba(226,232,240,0.9)', transition: 'bottom 0.2s ease' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 10 }}>
          {showIntroCard && (
            <div style={{
              alignSelf: 'flex-start',
              maxWidth: '90%',
              minWidth: 'min(90%, 300px)',
              whiteSpace: 'pre-wrap',
              padding: '16px 17px',
              borderRadius: '20px 20px 20px 4px',
              background: '#fff',
              color: '#0f172a',
              fontSize: 17,
              lineHeight: 1.48,
              fontWeight: 400,
              letterSpacing: '-0.01em',
              boxShadow: '0 8px 24px rgba(148,163,184,0.12)'
            }}>
              {renderMessage(introText.slice(0, introTypingIndex), 'ai')}
              {introTypingIndex < introText.length && (
                <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#0369a1', marginLeft: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom' }} />
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            {['退下', '搵 Task', '加Task', 'Focus', 'My Task', 'Report Log', 'Free talk'].map(preset => (
              <button data-testid={`quick-${preset.replace(/\s+/g, '-').toLowerCase()}`} key={preset} disabled={isReplying || isTyping} onClick={() => {
                if (isReplying || isTyping) return;
                setPendingTaskAction(null);

                if (preset !== '加Task') {
                  resetGuidedCreateFlow();
                }

                if (preset === '退下') {
                  setActiveQuickAction(null);
                  navigate('/canton-mode');
                  return;
                }

                if (preset === '搵 Task') {
                  setActiveQuickAction('search');
                  immediateFocusInput();
                  const lastMsg = messages[messages.length - 1];
                  if (lastMsg?.role === 'ai' && lastMsg.text.includes('想搵邊個Task')) {
                    immediateFocusInput();
                    scrollToInput();
                    return;
                  }
                  setIntroText('');
                  
                  startTypingMessage('小人遵命，斗膽一問，大人想搵邊個Task呢？');
                  setInput('');
                  window.setTimeout(() => {
                    immediateFocusInput();
                    scrollToInput();
                  }, 0);
                  return;
                }

                if (preset === '加Task') {
                  setActiveQuickAction('add');
                  createModeRef.current = 'main';
                  setCreateMode('main');
                  setGuidedStep(0);
                  setGuidedDraft({ title:'',description:'',assignee:'',dueDate:'',dueLabel:'',parentTaskId: null });
                  setIntroText('');
                  
                  startTypingMessage('小人遵命～\n\n想加咩 task？先俾我 task name。');
                  return;
                }

                if (preset === 'Report Log') {
                  setIntroText('');
                  
                  openReportLogMode();
                  return;
                }

                if (preset === 'Free talk') {
                  setActiveQuickAction('free-talk');
                  setIntroText('');
                  
                  startTypingMessage('小人遵命。恩公若想隨意傾兩句、聽下寬心之言，儘管開口，小人願作軍師，亦可略談氣場風水，為恩公解悶寬心。');
                  setInput('');
                  window.setTimeout(() => {
                    immediateFocusInput();
                    scrollToInput();
                  }, 0);
                  return;
                }

                if (preset === 'Focus') {
                  setActiveQuickAction('focus');
                } else if (preset === 'My Task') {
                  setActiveQuickAction('my-task');
                } else if (preset === 'Report Log') {
                  setActiveQuickAction('report-log');
                } else {
                  setActiveQuickAction(null);
                }

                setIntroText('');
                void send(preset, { suppressUserBubble: true });
              }} style={getQuickActionButtonStyle(preset)}>
                {preset}
              </button>
            ))}
          </div>
          {(isReplying || isTyping) && (
            <div style={{ marginTop: -2, marginBottom: 8, paddingLeft: 4, fontSize: 12, fontWeight: 700, color: '#64748b' }}>
              諗緊緊，buttons 會暫時鎖住～
            </div>
          )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                {reportEditorState && (
                  <div style={{ marginBottom: 8, padding: '10px 12px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'grid', gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f766e' }}>{reportEditorState.title}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                      {reportEditorState.field === 'today' ? '今日做咗乜？' : reportEditorState.field === 'tomorrow' ? '明日會做乜？' : 'Blocker'}
                    </div>
                  </div>
                )}
                <textarea
                  data-testid="chat-input"
                  placeholder={reportEditorState ? '可直接修改呢段 report 內容…' : activeQuickAction === 'free-talk' ? '隨便傾下心事、運勢、心情都可以…' : (messages[messages.length - 1]?.text.includes('想搵邊個') ? '輸入 task 名稱或關鍵字...' : '隨意問 task 相關問題…')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Allow Enter for newline (Telegram style)
                      // Only send if explicitly clicking send button
                      e.stopPropagation();
                    }
                  }}
                  onInput={(e) => {
                    // Auto-resize textarea based on content - min 3 rows
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    const lineHeight = 28;
                    const minHeight = lineHeight * 3; // minimum 3 rows
                    const newHeight = Math.max(target.scrollHeight, minHeight);
                    target.style.height = newHeight + 'px';
                  }}
                  rows={3}
                  disabled={isReplying}
                  style={{ width: '100%', resize: 'none', minHeight: 84, maxHeight: 150, overflowY: 'auto', border: '1px solid #dbeafe', borderRadius: 18, padding: '10px 15px', outline: 'none', fontSize: 16, lineHeight: 1.6, background: '#fff', fontFamily: 'inherit', WebkitAppearance: 'none' }}
                />
                {/* Autocomplete dropdown for search mode */}
                {messages[messages.length - 1]?.text.includes('想搵邊個') 
                  && input.trim().length > 0 
                  && !tasks.some(t => t.title === input)
                  && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto', zIndex: 100, marginBottom: 4 }}>
                    {tasks
                      .filter(t => !t.parent_id && t.title.toLowerCase().includes(input.toLowerCase()) && t.title !== input)
                      .slice(0, 5)
                      .map(t => (
                        <div
                          key={t.id}
                          onClick={() => { 
                            setInput(t.title); 
                            // Auto-send and show task detail
                            setTimeout(() => {
                              void send(t.title);
                            }, 50);
                          }}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 14 }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                        >
                          <div style={{ fontWeight: 700 }}>{t.title}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{getStatusMeta(t.status).label} · {t.assignees.map(a => a.name.split(' ')[0]).join(', ') || '未指派'}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              {/* GO button - Telegram style */}
              <button 
                data-testid="go-button"
                onClick={() => { if (input.trim()) void send(); }} 
                disabled={isReplying || !input.trim()} 
                style={{ 
                  flexShrink: 0,
                  border: 'none', 
                  borderRadius: 999, 
                  background: input.trim() && !isReplying ? '#0088cc' : '#e2e8f0', 
                  color: input.trim() && !isReplying ? '#fff' : '#94a3b8', 
                  padding: '12px 20px', 
                  fontWeight: 950, 
                  fontSize: 16, 
                  opacity: isReplying ? 0.5 : 1, 
                  cursor: isReplying || !input.trim() ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  alignSelf: 'flex-end',
                  marginBottom: 2
                }}
              >
                {isReplying ? '諗緊…' : 'GO'}
              </button>
            </div>
        </div>
      </footer>
    </div>
  );
}

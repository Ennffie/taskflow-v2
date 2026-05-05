import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createTask, fetchProfiles, fetchTasks, updateTask, updateTaskAssignees, deleteTask, fetchBridgeUrl } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Profile, TaskItem } from '../types';

// Fallback bridge URL if Supabase config is not available
const FALLBACK_BRIDGE_URL = 'https://counting-hereby-manufacturers-dominant.trycloudflare.com';

export function CantonAiCoachPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [input, setInput] = useState('');
  const [bridgeUrl, setBridgeUrl] = useState<string>(FALLBACK_BRIDGE_URL);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  // pendingConfirm removed - using message._action instead

  // Version for debugging cache issues - updated 0505-0830
  const APP_VERSION = 'v2.2.8-0505-1306';
  const [typingTarget, setTypingTarget] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string; _action?: string; _data?: any }[]>([]);

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
      const fetchedTasks = await fetchTasks();
      console.log('[CantonAI] Tasks loaded:', fetchedTasks.length);
      setTasks(fetchedTasks); 
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    void loadTasks();
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
      // Start welcome typewriter after getting user name
      setTimeout(() => {
        const welcome = `Hi ${name.split(' ')[0]}~\n我係Silly，有咩可以直接問我…`;
        setTypingTarget(welcome);
        setTypingIndex(0);
        setIsTyping(true);
      }, 300);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isTyping || typingIndex >= typingTarget.length) {
      // Typing finished - add message to messages array
      if (isTyping && typingIndex >= typingTarget.length && typingTarget) {
        setMessages(current => [...current, { role: 'ai', text: typingTarget }]);
        setIsTyping(false);
        setTypingTarget('');
        setTypingIndex(0);
      }
      return;
    }
    const timer = setTimeout(() => {
      setTypingIndex(prev => prev + 1);
    }, 35);
    return () => clearTimeout(timer);
  }, [isTyping, typingIndex, typingTarget]);

  useEffect(() => {
    window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 40);
  }, [messages, isReplying, typingIndex]);

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
          // Validate/fix due_date - reject Chinese placeholder text
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
            parent_id: null,
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
    return displayText.split('\n').map((line, i) => {
      const isBullet = /^[•\-\*]\s/.test(line);
      const isNumbered = /^\d+[.\)]\s/.test(line);
      return (
        <div key={i} style={{ 
          marginTop: i > 0 ? 6 : 0,
          fontWeight: isBullet || isNumbered ? 600 : 400,
          paddingLeft: isBullet || isNumbered ? 16 : 0,
          textIndent: isBullet || isNumbered ? -16 : 0,
        }}>
          {line || ' '}
        </div>
      );
    });
  };

  const handleConfirmCreate = async (data: any) => {
    // no-op
    setIsReplying(true);
    
    const assigneeProfile = profiles.find(p => p.name === data.assignee);
    
    try {
      await createTask({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: 'medium',
        due_date: data.dueDate || undefined,
        assignee_ids: assigneeProfile ? [assigneeProfile.id] : [],
        tags: [],
        parent_id: null,
      });
      
      await loadTasks();
      
      setMessages(current => [...current, { 
        role: 'ai', 
        text: `✅ 已建立「${data.title}」\n\n📋 Task Details:\n• 名稱：${data.title}\n• 到期：${data.dueDateLabel || data.dueDate || '未設定'}\n• 負責：${data.assignee}\n• Status：${data.statusLabel}\n• Description：${data.description || '無'}` 
      }]);
    } catch (e: any) {
      setMessages(current => [...current, { role: 'ai', text: `❌ 建立失敗：${e?.message || 'Unknown error'}` }]);
    } finally {
      setIsReplying(false);
    }
  };

  const handleCancelCreate = () => {
    // no-op
    setMessages(current => [...current, { role: 'ai', text: '取消咗～有咩再講 💕' }]);
  };

  const send = async (text?: string) => {
    // Verify current user before sending
    const { data: { user } } = await supabase.auth.getUser();
    const actualName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
    if (actualName !== currentUserName) {
      // User changed, reset session
      window.location.reload();
      return;
    }
    
    const userText = (text ?? input).trim();
    
    // Frontend search setup
    let searchResult = null;
    const taskNamePattern = /^(CR\d+|CRCE\d+|task\s*\d+|#\d+)/i;
    
    // Smart parsing: check if input starts with CR/CRCE (potential task creation)
    // Also detect patterns like "ok:CR152", "CR152..." anywhere in text
    const crMatch = userText.match(/^(?:ok[:：]\s*)?(CR\d+|CRCE\d+)/i) || userText.match(/\b(CR\d+|CRCE\d+)\b/i);
    const hasPipe = userText.includes('|');
    const isCreateIntent = crMatch && !hasPipe;
    
    let parsedFields: any = null;
    
    if (isCreateIntent) {
      // Parse multi-line or single-line input
      const lines = userText.split('\n').map(l => l.trim()).filter(Boolean);
      const crCode = crMatch[1];
      
      // Title: first line (or CR code + first few words)
      const firstLine = lines[0] || '';
      const title = firstLine.length > crCode.length + 1 
        ? firstLine  // full first line as title
        : crCode;    // just the CR code
      
      // Description: second line, or everything after first line
      const description = lines[1] || '';
      
      // Calculate ISO due date from keywords
      const today = new Date();
      const isoToday = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isoTomorrow = tomorrow.toISOString().split('T')[0];
      
      // Get next weekday
      const getNextWeekday = (targetDay: number) => {
        const d = new Date(today);
        const currentDay = d.getDay(); // 0=Sun, 1=Mon, ...
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        d.setDate(d.getDate() + diff);
        return d.toISOString().split('T')[0];
      };
      
      const dateMap: Record<string, string> = {
        'today': isoToday,
        '今日': isoToday,
        'tomorrow': isoTomorrow,
        '聽日': isoTomorrow,
        '明天': isoTomorrow,
        'next mon': getNextWeekday(1),
        'next tue': getNextWeekday(2),
        'next wed': getNextWeekday(3),
        'next thu': getNextWeekday(4),
        'next fri': getNextWeekday(5),
        'monday': getNextWeekday(1),
        'tuesday': getNextWeekday(2),
        'wednesday': getNextWeekday(3),
        'thursday': getNextWeekday(4),
        'friday': getNextWeekday(5),
        '下星期一': getNextWeekday(1),
        '下星期二': getNextWeekday(2),
        '下星期三': getNextWeekday(3),
        '下星期四': getNextWeekday(4),
        '下星期五': getNextWeekday(5),
        '5 may': '2026-05-05',
        'may 5': '2026-05-05',
        '6 may': '2026-05-06',
        'may 6': '2026-05-06',
      };
      
      let dueDateISO = '';
      let dueDateLabel = '';
      for (const [kw, iso] of Object.entries(dateMap)) {
        if (userText.toLowerCase().includes(kw.toLowerCase())) {
          dueDateISO = iso;
          dueDateLabel = kw;
          break;
        }
      }
      
      // Search for assignee
      const assignee = profiles.find(p => {
        const firstName = p.name.toLowerCase().split(' ')[0];
        return userText.toLowerCase().includes(firstName) && firstName.length > 2;
      })?.name || currentUserName;
      
      // Status
      let status = 'todo';
      let statusLabel = '待辦';
      if (userText.toLowerCase().includes('wip') || userText.toLowerCase().includes('in progress')) {
        status = 'in_progress'; 
        statusLabel = '進行中';
      }
      if (userText.toLowerCase().includes('done') || userText.toLowerCase().includes('完成')) {
        status = 'done';
        statusLabel = '完成';
      }
      
      // Subtasks (extract "Sub task: xxx, yyy" pattern)
      const subtaskMatch = userText.match(/Sub task[s]?[：:]\s*(.+)/i);
      const subtasks = subtaskMatch 
        ? subtaskMatch[1].split(/[,，]/).map(s => s.trim()).filter(Boolean)
        : [];
      
      parsedFields = {
        title,
        description,
        dueDate: dueDateISO,        // ISO format for DB
        dueDateLabel: dueDateLabel || '未設定',  // Human readable
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
            `${dueDateLabel ? `**到期：** ${dueDateLabel}\n` : ''}` +
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

    // Use first token (before first space) as keyword for task search
    // This handles multi-line input where first line is task name
    const firstToken = userText.split(/\s/)[0];
    if (taskNamePattern.test(firstToken) && !parsedFields) {
      const keyword = firstToken.replace(/^(task\s*)/i, '').replace(/^#/, '').toLowerCase();
      console.log(`[Frontend Search] Pattern matched on first token. Keyword: "${keyword}"`);
      const foundTask = tasks.find(t => {
        const titleMatch = t.title.toLowerCase().includes(keyword);
        const idMatch = t.id.toLowerCase() === keyword;
        if (titleMatch || idMatch) {
          console.log(`[Frontend Search] Found: "${t.title}" (titleMatch=${titleMatch}, idMatch=${idMatch})`);
        }
        return titleMatch || idMatch;
      });
      if (foundTask) {
        searchResult = {
          id: foundTask.id,
          title: foundTask.title,
          status: foundTask.status,
          due_date: foundTask.due_date,
          assignees: foundTask.assignees.map(a => a.name),
          description: foundTask.description,
          subtasks: foundTask.subtasks?.map((s: any) => ({
            title: s.title,
            status: s.status,
            assignees: s.assignees.map((a: any) => a.name),
          })) || [],
        };
        console.log(`[Frontend Search] Result created:`, searchResult);
      } else {
        console.log(`[Frontend Search] No task found matching "${keyword}"`);
      }
    } else {
      console.log(`[Frontend Search] Pattern did NOT match for: "${userText}"`);
    }
    if (!userText || isReplying) return;

    // Show user message immediately
    setMessages(current => [...current, { role: 'user', text: userText }]);
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
      
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      
      // Show typing indicator
      setMessages(current => [...current, { role: 'ai', text: '諗緊…' }]);
      await new Promise(r => window.setTimeout(r, 500));
      
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
          setMessages(current => current.map((m, i) => i === current.length - 1 ? { ...m, text: '處理緊…' } : m));
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
      
      // Final reply
      const finalReply = [data.reply, actionResult].filter(Boolean).join('\n\n');
      setMessages(current => current.map((m, i) => i === current.length - 1 ? { ...m, text: finalReply || '收到。' } : m));
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages(current => [...current, { role: 'ai', text: 'AI 諗得太耐，可能網絡慢或者伺服器忙。請再試一次，或者打短啲嘅問題。' }]);
      } else {
        setMessages(current => [...current, { role: 'ai', text: `AI 暫時無法回應：${error?.message || '請檢查網絡連接。'}\n\n你可以繼續用我嘅基本功能，例如：\n• 撳「我要加Task」逐步加 task\n• 問「有咩未交？」睇風險` }]);
      }
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', height: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr auto', background: 'linear-gradient(180deg, #f0f9ff 0%, #f8fafc 100%)', overflow: 'hidden' }}>
      <header style={{ padding: '14px 16px 10px', background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(226,232,240,0.9)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button onClick={() => navigate('/canton-mode')} style={{ border: 'none', background: 'transparent', color: '#475569', display: 'flex', gap: 8, alignItems: 'center', fontWeight: 900, padding: 0 }}><ArrowLeft size={18} /> Canton</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#0369a1', fontWeight: 950 }}><Sparkles size={17} /> Silly AI <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>({APP_VERSION})</span></div>
        </div>
      </header>

      <main style={{ overflowY: 'auto', padding: '14px 16px 12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'flex-end', width: '100%' }}>
          {messages.map((message, index) => (
            <div key={index} style={{ 
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', 
              maxWidth: '90%', 
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
              {renderMessage(message.text, message.role)}
              
              {/* Confirmation buttons for create task */}
              {message._action === 'confirm_create' && message._data && (
                <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                  <button 
                    onClick={() => handleConfirmCreate(message._data)}
                    style={{ 
                      flex: 1, 
                      background: '#0f172a', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: 12, 
                      padding: '10px 16px', 
                      fontSize: 15, 
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ✅ Confirm 建立
                  </button>
                  <button 
                    onClick={handleCancelCreate}
                    style={{ 
                      flex: 1, 
                      background: '#f1f5f9', 
                      color: '#64748b', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: 12, 
                      padding: '10px 16px', 
                      fontSize: 15, 
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    ❌ Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
          {/* Welcome typing message */}
          {isTyping && typingTarget && (
            <div style={{ 
              alignSelf: 'flex-start', 
              maxWidth: '90%', 
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
              {typingTarget.slice(0, typingIndex)}
              <span style={{ 
                display: 'inline-block', 
                width: 2, 
                height: '1em', 
                background: '#0369a1', 
                marginLeft: 2,
                animation: 'blink 1s step-end infinite',
                verticalAlign: 'text-bottom'
              }} />
              <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer style={{ padding: '10px 16px calc(12px + env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(18px)', borderTop: '1px solid rgba(226,232,240,0.9)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            {['退下', '有咩未交？', '我要加Task', '今日重點', 'My Task list'].map(preset => (
              <button key={preset} onClick={() => {
                // 1) 先加 user message 到右邊
                setMessages(current => [...current, { role: 'user', text: preset }]);

                if (preset === '退下') {
                  navigate('/canton-mode');
                  return;
                }

                if (preset === '我要加Task') {
                  // Show guided creation hint
                  setMessages(current => [...current,
                    { role: 'ai', text: '好～直接講 task 資料，格式：\n「Task名 | Description | Due Date | 負責人 | Status」\n\n例如：「CRCE9876 test case | Make some fun | 下星期三 | Enfield | todo」' }
                  ]);
                } else {
                  void send(preset);
                }
              }} style={{ flexShrink: 0, border: '1px solid #dbeafe', background: preset === '我要加Task' ? '#0f172a' : (preset === '退下' ? '#fff1f2' : '#fff'), color: preset === '我要加Task' ? '#fff' : (preset === '退下' ? '#be123c' : '#0369a1'), borderRadius: 999, padding: '8px 11px', fontSize: 13, fontWeight: 850 }}>
                {preset}
              </button>
            ))}
            <button onClick={() => navigate('/')} style={{ flexShrink: 0, border: '1px solid #dbeafe', background: '#f0f9ff', color: '#0369a1', borderRadius: 999, padding: '8px 11px', fontSize: 13, fontWeight: 850 }}>📝 English Form</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              {!input ? <span style={{ position: 'absolute', left: 15, top: 14, color: '#94a3b8', fontSize: 16, pointerEvents: 'none' }}>隨意問 task 相關問題…</span> : null}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) void send();
                  }
                }}
                rows={1}
                disabled={isReplying}
                style={{ width: '100%', resize: 'none', minHeight: 22, maxHeight: 96, overflowY: 'auto', border: '1px solid #dbeafe', borderRadius: 18, padding: '14px 15px', outline: 'none', fontSize: 16, lineHeight: 1.35, background: '#fff', fontFamily: 'inherit', WebkitAppearance: 'none' }}
              />
            </div>
            <button 
              onClick={() => { if (input.trim()) void send(); }} 
              disabled={isReplying || !input.trim()} 
              style={{ border: 'none', borderRadius: 18, background: '#0f172a', color: '#fff', padding: '0 18px', fontWeight: 950, fontSize: 16, opacity: isReplying || !input.trim() ? 0.5 : 1, cursor: isReplying || !input.trim() ? 'default' : 'pointer' }}
            >
              {isReplying ? '諗緊…' : 'Send'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

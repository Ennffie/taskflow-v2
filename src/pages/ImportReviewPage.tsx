import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Plus, ArrowLeft, ChevronDown, ChevronUp, User } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { fetchTasks, fetchProfiles, fetchAllLogs, updateTask, createTask, createLog } from '../lib/api';
import type { TaskItem, Profile, TaskStatus } from '../types';
import { STATUS_META } from '../types';

interface ImportRow {
  rowIndex: number;
  taskId: string | null;
  title: string;
  status: string;
  assigneeNames: string[];
  dueDate: string | null;
  description: string;
}

interface MatchResult {
  row: ImportRow;
  action: 'create' | 'update' | 'skip';
  matchedTask: TaskItem | null;
  matchedAssignees: Profile[];
  parsedStatus: TaskStatus | null;
  reason: string;
  logExists?: boolean;
}

// Status mapping from XLS to TaskStatus
const STATUS_MAP: Record<string, TaskStatus> = {
  '完成': 'done',
  '進行中': 'in_progress',
  '新開始': 'todo',
  '等待中': 'todo',
  'Done': 'done',
  'In Progress': 'in_progress',
  'New': 'todo',
  'Waiting': 'todo',
  'Focus': 'focus',
  'Priority': 'focus',
};

function parseStatus(statusStr: string): TaskStatus | null {
  return STATUS_MAP[statusStr.trim()] || null;
}

function extractTaskId(title: string): string | null {
  const match = title.match(/^([A-Z]{2,6}-\d{2,6})/i);
  return match ? match[1].toUpperCase() : null;
}

function cleanTitle(title: string): string {
  return title.replace(/^([A-Z]{2,6}-\d{2,6})[\s:-]*/i, '').trim();
}

function similarityScore(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  const intersection = [...words1].filter(w => words2.has(w));
  return intersection.length / new Set([...words1, ...words2]).size;
}

function findAssigneesByName(names: string[], profiles: Profile[]): Profile[] {
  const matches: Profile[] = [];
  for (const name of names) {
    const normalizedName = name.trim().toLowerCase();
    const match = profiles.find(p => 
      p.name.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(p.name.toLowerCase().split(' ')[0])
    );
    if (match && !matches.find(m => m.id === match.id)) matches.push(match);
  }
  return matches;
}

export function ImportReviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    create: true,
    update: true,
    skip: true,
  });
  
  const importData: ImportRow[] = location.state?.importData || [];
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);

  useEffect(() => {
    if (!importData.length) { navigate('/'); return; }
    
    const loadData = async () => {
      try {
        const [tasks, profs, logs] = await Promise.all([
          fetchTasks(), 
          fetchProfiles(),
          fetchAllLogs()
        ]);
        
        // Build map: task_id -> Set of "event_date" keys
        const taskLogMap = new Map<string, Set<string>>();
        for (const log of logs) {
          if (!taskLogMap.has(log.task_id)) taskLogMap.set(log.task_id, new Set());
          taskLogMap.get(log.task_id)!.add(`${log.event.trim().toLowerCase()}_${log.date}`);
        }
        
        const results = performMatching(importData, tasks, profs, taskLogMap);
        setMatchResults(results);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [importData, navigate]);

  const performMatching = (
    rows: ImportRow[], 
    tasks: TaskItem[], 
    profs: Profile[],
    taskLogMap: Map<string, Set<string>>
  ): MatchResult[] => {
    // Detect Day 2: all unique dates, earliest = Day 1, others = Day 2
    const allDates = [...new Set(rows.map(r => r.dueDate).filter(Boolean) as string[])].sort();
    const day1Date = allDates.length > 0 ? allDates[0] : null;
    
    return rows.map((row) => {
      const isDay2 = day1Date && row.dueDate && row.dueDate !== day1Date;
      // Day 2 rows force focus status
      const parsedStatus = isDay2 ? 'focus' : parseStatus(row.status);
      const rowTaskId = row.taskId || extractTaskId(row.title);
      const cleanTitleStr = cleanTitle(row.title);
      const matchedAssignees = findAssigneesByName(row.assigneeNames, profs);
      
      // 1. Try find by Task ID
      let matchedTask = tasks.find(t => extractTaskId(t.title) === rowTaskId) || null;
      
      // 2. Try find by exact title
      if (!matchedTask) {
        matchedTask = tasks.find(t => 
          t.title === row.title || 
          t.title === `${row.taskId} - ${row.title}`
        ) || null;
      }
      
      // 3. Try fuzzy match
      if (!matchedTask) {
        const bestMatch = tasks
          .map(t => ({ task: t, score: similarityScore(cleanTitleStr, t.title) }))
          .filter(t => t.score > 0.6)
          .sort((a, b) => b.score - a.score)[0];
        if (bestMatch) matchedTask = bestMatch.task;
      }
      
      // No match → create new
      if (!matchedTask) {
        return {
          row,
          action: 'create',
          matchedTask: null,
          matchedAssignees,
          parsedStatus,
          reason: isDay2 ? 'New task (Day 2 → Focus)' : 'New task',
        };
      }
      
      // Task exists → check if log (event + date) already exists
      const existingLogs = taskLogMap.get(matchedTask.id);
      const logKey = `${row.description.trim().toLowerCase()}_${row.dueDate}`;
      const logExists = existingLogs?.has(logKey);
      
      // Day 2: always update status to Focus, skip log only if same log exists
      if (isDay2) {
        return {
          row,
          action: 'update',
          matchedTask,
          matchedAssignees,
          parsedStatus,
          reason: logExists 
            ? 'Day 2 → Focus (log exists, update status only)' 
            : 'Day 2 → Focus + add log',
          logExists: !!logExists,
        };
      }
      
      // Day 1: skip if same log exists
      if (logExists) {
        return {
          row,
          action: 'skip',
          matchedTask,
          matchedAssignees,
          parsedStatus,
          reason: 'Same log already exists',
        };
      }
      
      // Day 1 + new log → update
      return {
        row,
        action: 'update',
        matchedTask,
        matchedAssignees,
        parsedStatus,
        reason: parsedStatus !== matchedTask.status 
          ? `Status: ${STATUS_META[matchedTask.status].label} → ${parsedStatus ? STATUS_META[parsedStatus].label : '?'}`
          : 'Add new log',
        logExists: false,
      };
    });
  };

  const grouped = useMemo(() => ({
    create: matchResults.filter(r => r.action === 'create'),
    update: matchResults.filter(r => r.action === 'update'),
    skip: matchResults.filter(r => r.action === 'skip'),
  }), [matchResults]);

  const handleExecute = async () => {
    setProcessing(true);
    
    const createdTasksMap = new Map<string, TaskItem>();
    const importedTaskIds = new Set<string>(); // Track which tasks were touched in this import
    let created = 0, updated = 0, logsAdded = 0, skipped = 0;
    const failures: { row: number; title: string; error: string }[] = [];
    
    for (const result of matchResults) {
      try {
        if (result.action === 'skip') {
          skipped++;
          continue;
        }
        
        if (result.action === 'update' && result.matchedTask) {
          // Track this task was imported
          importedTaskIds.add(result.matchedTask.id);
          
          // Update status if changed
          if (result.parsedStatus && result.parsedStatus !== result.matchedTask.status) {
            await updateTask(result.matchedTask.id, { status: result.parsedStatus });
            updated++;
          }
          // Add log only if it's new (not existing)
          if (result.row.description && !result.logExists) {
            await createLog({
              task_id: result.matchedTask.id,
              date: result.row.dueDate || new Date().toISOString().slice(0, 10),
              event: result.row.description,
              category: 'other',
            });
            logsAdded++;
          }
        } else if (result.action === 'create') {
          const taskKey = result.row.taskId || result.row.title;
          const existingCreatedTask = createdTasksMap.get(taskKey);
          
          if (existingCreatedTask) {
            // Same task in batch → update status + add log (if new)
            importedTaskIds.add(existingCreatedTask.id);
            if (result.parsedStatus && result.parsedStatus !== existingCreatedTask.status) {
              await updateTask(existingCreatedTask.id, { status: result.parsedStatus });
              updated++;
            }
            if (result.row.description && !result.logExists) {
              await createLog({
                task_id: existingCreatedTask.id,
                date: result.row.dueDate || new Date().toISOString().slice(0, 10),
                event: result.row.description,
                category: 'other',
              });
              logsAdded++;
            }
          } else {
            // Create new task
            const fullTitle = result.row.taskId 
              ? `${result.row.taskId} - ${result.row.title}` 
              : result.row.title;
            
            const newTask = await createTask({
              title: fullTitle,
              description: result.row.description,
              status: result.parsedStatus || 'todo',
              priority: 'medium',
              due_date: result.row.dueDate || undefined,
              assignee_ids: result.matchedAssignees.map(a => a.id),
              tags: [],
            });
            
            created++;
            createdTasksMap.set(taskKey, newTask as TaskItem);
            importedTaskIds.add(newTask.id);
            
            if (result.row.description) {
              await createLog({
                task_id: newTask.id,
                date: result.row.dueDate || new Date().toISOString().slice(0, 10),
                event: result.row.description,
                category: 'other',
              });
              logsAdded++;
            }
          }
        }
      } catch (error) {
        console.error(`Failed row ${result.row.rowIndex}:`, error);
        failures.push({
          row: result.row.rowIndex,
          title: result.row.title,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }
    
    // Step: Post-import — reset old focus tasks that were NOT in this import to in_progress
    try {
      const allTasks = await fetchTasks();
      const oldFocusTasks = allTasks.filter(t => t.status === 'focus' && !importedTaskIds.has(t.id));
      for (const task of oldFocusTasks) {
        await updateTask(task.id, { status: 'in_progress' });
      }
      console.log(`Reset ${oldFocusTasks.length} old focus tasks to in_progress`);
    } catch (error) {
      console.error('Failed to reset old focus tasks:', error);
    }
    
    alert(
      `Import Results:\n\n` +
      `✅ Created: ${created}\n` +
      `📝 Updated: ${updated}\n` +
      `📋 Logs: ${logsAdded}\n` +
      `⏭️ Skipped: ${skipped}` +
      (failures.length ? `\n\n❌ Failed: ${failures.length}` : '')
    );
    navigate('/');
    setProcessing(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '16px' }}>Loading tasks...</div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ maxWidth: '1200px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '14px', color: '#475569' }}>
              <ArrowLeft size={16} />
              Back
            </button>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 }}>Import Review</h1>
          </div>
          
          <button 
            onClick={handleExecute}
            disabled={processing}
            style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#111827', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
          >
            {processing ? 'Importing...' : 'Import All'}
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <StatCard label="Create New" count={grouped.create.length} color="#3b82f6" icon={<Plus size={20} />} />
          <StatCard label="Update" count={grouped.update.length} color="#10b981" icon={<CheckCircle2 size={20} />} />
          <StatCard label="Skip" count={grouped.skip.length} color="#6b7280" icon={<AlertCircle size={20} />} />
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <MatchSection title="Create New" subtitle="New tasks" color="#3b82f6" expanded={expandedSections.create} onToggle={() => setExpandedSections(p => ({...p, create: !p.create}))} results={grouped.create} />
          <MatchSection title="Update" subtitle="Existing tasks with new logs" color="#10b981" expanded={expandedSections.update} onToggle={() => setExpandedSections(p => ({...p, update: !p.update}))} results={grouped.update} />
          <MatchSection title="Skip" subtitle="Day 1 only: same task + same log" color="#6b7280" expanded={expandedSections.skip} onToggle={() => setExpandedSections(p => ({...p, skip: !p.skip}))} results={grouped.skip} />
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, count, color, icon }: { label: string; count: number; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ flex: 1, background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}15`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '24px', fontWeight: 700 }}>{count}</div>
        <div style={{ fontSize: '13px', color: '#64748b' }}>{label}</div>
      </div>
    </div>
  );
}

function MatchSection({ title, subtitle, color, expanded, onToggle, results }: {
  title: string; subtitle: string; color: string; expanded: boolean; onToggle: () => void; results: MatchResult[];
}) {
  if (results.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: '#f8fafc', borderBottom: expanded ? '1px solid #e2e8f0' : 'none', cursor: 'pointer' }}>
        {expanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '15px', fontWeight: 600 }}>{title}</span>
          <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '12px' }}>{subtitle}</span>
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, color, background: `${color}15`, padding: '4px 12px', borderRadius: '20px' }}>
          {results.length}
        </span>
      </div>
      
      {expanded && (
        <div style={{ padding: '8px' }}>
          {results.map((result) => (
            <MatchResultRow key={result.row.rowIndex} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchResultRow({ result }: { result: MatchResult }) {
  const { row, matchedTask, matchedAssignees, parsedStatus, action, reason } = result;
  const statusConfig = parsedStatus ? STATUS_META[parsedStatus] : null;
  const extractedId = extractTaskId(row.title);

  const actionLabel = action === 'create' ? 'Create' : action === 'update' ? 'Update' : 'Skip';
  const actionColor = action === 'create' ? '#1d4ed8' : action === 'update' ? '#047857' : '#6b7280';
  const actionBg = action === 'create' ? '#eff6ff' : action === 'update' ? '#f0fdf4' : '#f3f4f6';

  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Action badge */}
        <div style={{ paddingTop: '4px' }}>
          <span style={{ fontSize: '11px', color: actionColor, background: actionBg, padding: '2px 8px', borderRadius: '4px' }}>
            {actionLabel}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            {extractedId && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', background: '#ede9fe', padding: '2px 8px', borderRadius: '4px' }}>
                {extractedId}
              </span>
            )}
            <span style={{ fontSize: '15px', fontWeight: 500 }}>
              {row.title}
            </span>
            {statusConfig && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: statusConfig.color, background: statusConfig.bg, padding: '2px 8px', borderRadius: '4px' }}>
                {statusConfig.label}
              </span>
            )}
          </div>

          {/* Reason */}
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
            {reason}
          </div>

          {/* Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Row {row.rowIndex}</span>
            {matchedAssignees.length > 0 && (
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                <User size={12} style={{ display: 'inline', marginRight: '4px' }} />
                {matchedAssignees.map(a => a.name).join(', ')}
              </span>
            )}
            {row.dueDate && (
              <span style={{ fontSize: '13px', color: '#64748b' }}>Due: {row.dueDate}</span>
            )}
          </div>

          {/* Matched task */}
          {matchedTask && (
            <div style={{ padding: '6px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
              → {matchedTask.title}
              <span style={{ marginLeft: '8px', color: '#94a3b8' }}>({STATUS_META[matchedTask.status].label})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

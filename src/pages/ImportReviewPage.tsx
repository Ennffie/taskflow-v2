import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Plus, ChevronDown, ChevronUp, User } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { BackButton } from '../components/BackButton';
import { fetchTasks, fetchProfiles, fetchAllLogs, updateTask, updateTaskAssignees, createLog, saveImportSnapshot } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { ImportedTaskRow, TaskItem, Profile, TaskStatus } from '../types';
import { getStatusMeta, parseTaskStatusInput } from '../types';

type ImportRow = ImportedTaskRow;

interface ImportMeta {
  sourceLabel?: string;
  restoredFromSnapshotId?: string;
}

interface MatchResult {
  row: ImportRow;
  action: 'create' | 'update' | 'skip';
  matchedTask: TaskItem | null;
  matchedMainTask?: TaskItem | null;
  matchedAssignees: Profile[];
  parsedStatus: TaskStatus | null;
  reason: string;
  isDay2?: boolean;
  logExists?: boolean;
}

function parseStatus(statusStr: string): TaskStatus | null {
  return parseTaskStatusInput(statusStr);
}

function normalizeTaskCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  const match = compact.match(/^([A-Z]{2,6})-?(\d{2,6})$/i);
  if (!match) return compact || null;
  return `${match[1].toUpperCase()}-${match[2]}`;
}

function extractTaskId(title: string): string | null {
  const match = title.match(/^([A-Z]{2,6})-?(\d{2,6})/i);
  return match ? normalizeTaskCode(`${match[1]}-${match[2]}`) : null;
}

function cleanTitle(title: string): string {
  return title.replace(/^([A-Z]{2,6})-?(\d{2,6})[\s:-]*/i, '').trim();
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

function buildMainTaskLookup(row: ImportRow): string {
  return normalizeTaskCode(row.mainTaskId || row.taskId || extractTaskId(row.mainTaskTitle || row.title)) || (row.mainTaskTitle || row.title).trim();
}

function normalizeTagList(tags: string[] | undefined): string[] {
  return Array.from(new Set((tags || []).map((tag) => tag.trim()).filter(Boolean))).sort();
}

function sameStringArray(a: string[], b: string[]) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

type PendingAssigneeInsert = { task_id: string; user_id: string };
type PendingTagInsert = { task_id: string; name: string };
type PendingLogInsert = {
  task_id: string;
  date: string;
  event: string;
  category: 'other';
  file_name: string | null;
  created_by: string;
};

export function ImportReviewPage() {
  "use no memo";
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const importData = useMemo<ImportRow[]>(() => location.state?.importData || [], [location.state]);
  const importMeta = useMemo<ImportMeta>(() => location.state?.importMeta || {}, [location.state]);
  const isCrceImport = useMemo(
    () => importData.some((row) => row.source === 'crce_tracker' || row.importKind === 'subtask'),
    [importData],
  );
  const [expandedSections, setExpandedSections] = useState({
    create: true,
    update: true,
    skip: true,
  });
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);

  useEffect(() => {
    if (!importData.length) { navigate('/'); return; }
    
    const loadData = async () => {
      try {
        const [tasks, profs, logs] = isCrceImport
          ? await Promise.all([
              Promise.resolve([] as TaskItem[]),
              fetchProfiles(),
              Promise.resolve([] as Awaited<ReturnType<typeof fetchAllLogs>>),
            ])
          : await Promise.all([
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
  }, [importData, isCrceImport, navigate]);

  const performMatching = (
    rows: ImportRow[], 
    tasks: TaskItem[], 
    profs: Profile[],
    taskLogMap: Map<string, Set<string>>
  ): MatchResult[] => {
    const rootTasks = tasks.filter((task) => !task.parent_id);
    const subtasks = tasks.filter((task) => !!task.parent_id);
    const allDates = [...new Set(rows.map(r => r.dueDate).filter(Boolean) as string[])].sort();
    const day1Date = allDates.length > 0 ? allDates[0] : null;
    
    return rows.map((row) => {
      const isCrce = row.source === 'crce_tracker' || row.importKind === 'subtask';
      const isDay2 = !isCrce && Boolean(day1Date && row.dueDate && row.dueDate !== day1Date);
      const parsedStatus = isDay2 ? 'in_progress' : parseStatus(row.status);
      const matchedAssignees = findAssigneesByName(row.assigneeNames, profs);
      if (isCrce) {
        const mainKey = buildMainTaskLookup(row);
        const mainTitle = (row.mainTaskTitle || row.title).trim();
        let matchedMainTask = rootTasks.find((task) => extractTaskId(task.title) === normalizeTaskCode(mainKey)) || null;
        if (!matchedMainTask) {
          matchedMainTask = rootTasks.find((task) => task.title.trim() === mainTitle) || null;
        }
        if (!matchedMainTask) {
          const bestMainMatch = rootTasks
            .map((task) => ({ task, score: similarityScore(mainTitle, task.title) }))
            .filter((item) => item.score > 0.75)
            .sort((a, b) => b.score - a.score)[0];
          if (bestMainMatch) matchedMainTask = bestMainMatch.task;
        }

        const desiredSubtaskTitle = (row.subtaskTitle || row.title).trim();
        let matchedTask = matchedMainTask
          ? subtasks.find((task) => task.parent_id === matchedMainTask!.id && task.title.trim() === desiredSubtaskTitle) || null
          : null;
        if (!matchedTask && matchedMainTask) {
          const bestSubtaskMatch = subtasks
            .filter((task) => task.parent_id === matchedMainTask!.id)
            .map((task) => ({ task, score: similarityScore(desiredSubtaskTitle, task.title) }))
            .filter((item) => item.score > 0.75)
            .sort((a, b) => b.score - a.score)[0];
          if (bestSubtaskMatch) matchedTask = bestSubtaskMatch.task;
        }

        if (!matchedMainTask || !matchedTask) {
          return {
            row,
            action: 'create',
            matchedTask,
            matchedMainTask,
            matchedAssignees,
            parsedStatus,
            reason: !matchedMainTask ? 'Create main task + subtask' : 'Create new subtask under existing main task',
          };
        }

        const existingLogs = taskLogMap.get(matchedTask.id);
        const logKey = `${row.description.trim().toLowerCase()}_${row.dueDate}`;
        const logExists = existingLogs?.has(logKey);
        if (logExists) {
          return {
            row,
            action: 'skip',
            matchedTask,
            matchedMainTask,
            matchedAssignees,
            parsedStatus,
            reason: 'Same subtask log already exists',
            logExists: true,
          };
        }

        return {
          row,
          action: 'update',
          matchedTask,
          matchedMainTask,
          matchedAssignees,
          parsedStatus,
          reason: parsedStatus && parsedStatus !== matchedTask.status
            ? `Same ticket no. → cover existing subtask (${getStatusMeta(matchedTask.status).label} → ${getStatusMeta(parsedStatus).label})`
            : 'Same ticket no. → cover existing subtask',
          logExists: false,
        };
      }

      const rowTaskId = normalizeTaskCode(row.taskId || extractTaskId(row.title));
      const cleanTitleStr = cleanTitle(row.title);
      let matchedTask = rootTasks.find(t => extractTaskId(t.title) === rowTaskId) || null;
      if (!matchedTask) {
        const normalizedFullTitle = rowTaskId ? `${rowTaskId} - ${cleanTitleStr}` : row.title;
        matchedTask = rootTasks.find(t => t.title === row.title || t.title === normalizedFullTitle) || null;
      }
      if (!matchedTask) {
        const bestMatch = rootTasks
          .map(t => ({ task: t, score: similarityScore(cleanTitleStr, t.title) }))
          .filter(t => t.score > 0.6)
          .sort((a, b) => b.score - a.score)[0];
        if (bestMatch) matchedTask = bestMatch.task;
      }
      if (!matchedTask) {
        return { row, action: 'create', matchedTask: null, matchedAssignees, parsedStatus, isDay2, reason: isDay2 ? 'New task (Day 2 → Focus)' : 'New task' };
      }
      const existingLogs = taskLogMap.get(matchedTask.id);
      const logKey = `${row.description.trim().toLowerCase()}_${row.dueDate}`;
      const logExists = existingLogs?.has(logKey);
      if (isDay2) {
        return { row, action: 'update', matchedTask, matchedAssignees, parsedStatus, isDay2: true, reason: logExists ? 'Day 2 → Focus (log exists, update flag only)' : 'Day 2 → Focus + add log', logExists: !!logExists };
      }
      if (logExists) {
        return { row, action: 'skip', matchedTask, matchedAssignees, parsedStatus, isDay2: false, reason: 'Same log already exists' };
      }
      return {
        row,
        action: 'update',
        matchedTask,
        matchedAssignees,
        parsedStatus,
        isDay2: false,
        reason: parsedStatus !== matchedTask.status ? `Status: ${getStatusMeta(matchedTask.status).label} → ${parsedStatus ? getStatusMeta(parsedStatus).label : '?'}` : 'Add new log',
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

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      alert('Import failed: user session expired. Please sign in again.');
      setProcessing(false);
      return;
    }

    const userId = authData.user.id;
    const pendingAssignees: PendingAssigneeInsert[] = [];
    const pendingTags: PendingTagInsert[] = [];
    const pendingLogs: PendingLogInsert[] = [];

    if (isCrceImport) {
      const confirmed = window.confirm(
        'This CRCE import will delete all current tasks, logs, assignees, and tags before importing the new file. Continue?'
      );
      if (!confirmed) {
        setProcessing(false);
        return;
      }

      if (!importMeta.restoredFromSnapshotId) {
        try {
          await saveImportSnapshot({
            sourceType: 'crce_tracker',
            sourceLabel: importMeta.sourceLabel || 'CRCE import',
            payload: importData,
          });
        } catch (error) {
          alert(`Import failed while saving snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setProcessing(false);
          return;
        }
      }

      const clearSteps = [
        { table: 'log_entries', key: 'id' },
        { table: 'task_assignees', key: 'task_id' },
        { table: 'tags', key: 'task_id' },
        { table: 'tasks', key: 'id' },
      ] as const;

      for (const step of clearSteps) {
        const { error } = await supabase
          .from(step.table)
          .delete()
          .neq(step.key, '00000000-0000-0000-0000-000000000000');
        if (error) {
          alert(`Import failed while clearing ${step.table}: ${error.message}`);
          setProcessing(false);
          return;
        }
      }
    }

    const flushPendingWrites = async () => {
      const jobs: Array<Promise<{ error: { message?: string } | null }>> = [];
      if (pendingAssignees.length > 0) {
        jobs.push(Promise.resolve(supabase.from('task_assignees').insert(pendingAssignees.splice(0, pendingAssignees.length))));
      }
      if (pendingTags.length > 0) {
        jobs.push(Promise.resolve(supabase.from('tags').insert(pendingTags.splice(0, pendingTags.length))));
      }
      if (pendingLogs.length > 0) {
        jobs.push(Promise.resolve(supabase.from('log_entries').insert(pendingLogs.splice(0, pendingLogs.length))));
      }
      const results = await Promise.all(jobs);
      for (const result of results) {
        if ((result as { error?: { message?: string } }).error) {
          throw new Error((result as { error?: { message?: string } }).error?.message || 'Bulk import write failed');
        }
      }
    };

    const queueRelatedRows = (taskId: string, assigneeIds: string[], tags: string[], row: ImportRow) => {
      if (assigneeIds.length > 0) {
        pendingAssignees.push(...assigneeIds.map((id) => ({ task_id: taskId, user_id: id })));
      } else {
        pendingAssignees.push({ task_id: taskId, user_id: userId });
      }
      if (tags.length > 0) {
        pendingTags.push(...tags.map((name) => ({ task_id: taskId, name })));
      }
      if (row.description) {
        pendingLogs.push({
          task_id: taskId,
          date: row.dueDate || new Date().toISOString().slice(0, 10),
          event: row.description,
          category: 'other',
          file_name: row.fileLink || null,
          created_by: userId,
        });
        logsAdded++;
      }
    };

    const maybeFlushPendingWrites = async () => {
      if (pendingAssignees.length + pendingTags.length + pendingLogs.length >= 120) {
        await flushPendingWrites();
      }
    };

    const createImportedTask = async (payload: {
      title: string;
      description: string;
      status: TaskStatus;
      due_date?: string;
      parent_id?: string | null;
      is_focus?: boolean;
      round_number?: number;
      assignee_ids: string[];
      tags: string[];
      row: ImportRow;
    }) => {
      const { data: insertedTask, error: insertTaskError } = await supabase
        .from('tasks')
        .insert({
          title: payload.title,
          description: payload.description,
          status: payload.status,
          priority: 'medium',
          due_date: payload.due_date ?? null,
          parent_id: payload.parent_id ?? null,
          is_focus: payload.is_focus ?? false,
          progress_percent: 0,
          round_number: payload.round_number ?? 1,
          is_finished: false,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (insertTaskError || !insertedTask) {
        throw insertTaskError ?? new Error('Task insert failed');
      }

      queueRelatedRows(insertedTask.id, payload.assignee_ids, payload.tags, payload.row);
      await maybeFlushPendingWrites();

      return {
        ...(insertedTask as TaskItem),
        assignees: [],
        tags: payload.tags,
        log_count: 0,
      } as TaskItem;
    };

    const replaceTaskTags = async (task: TaskItem, nextTags: string[]) => {
      const normalizedNextTags = normalizeTagList(nextTags);
      const currentTags = normalizeTagList(task.tags);
      if (sameStringArray(currentTags, normalizedNextTags)) return;

      const { error: deleteError } = await supabase.from('tags').delete().eq('task_id', task.id);
      if (deleteError) throw deleteError;
      if (normalizedNextTags.length > 0) {
        const { error: insertError } = await supabase
          .from('tags')
          .insert(normalizedNextTags.map((name) => ({ task_id: task.id, name })));
        if (insertError) throw insertError;
      }
      task.tags = normalizedNextTags;
    };

    const syncCrceMainTask = async (task: TaskItem, row: ImportRow) => {
      const nextTitle = (row.mainTaskTitle || row.title).trim();
      const nextDescription = nextTitle;
      const taskPatch: Parameters<typeof updateTask>[1] = {};
      if (nextTitle && nextTitle !== task.title) taskPatch.title = nextTitle;
      if (nextDescription !== (task.description || '')) taskPatch.description = nextDescription;
      if (row.dueDate && row.dueDate !== task.due_date) taskPatch.due_date = row.dueDate;
      if (Object.keys(taskPatch).length > 0) {
        await updateTask(task.id, taskPatch);
        if (taskPatch.title) task.title = taskPatch.title;
        if (taskPatch.description !== undefined) task.description = taskPatch.description ?? null;
        if (taskPatch.due_date !== undefined) task.due_date = taskPatch.due_date ?? null;
        updated++;
      }
    };
    
    for (const result of matchResults) {
      try {
        if (result.action === 'skip') {
          skipped++;
          continue;
        }

        if ((result.row.source === 'crce_tracker' || result.row.importKind === 'subtask') && result.row.importKind === 'subtask') {
          const mainKey = buildMainTaskLookup(result.row);
          let mainTask = result.matchedMainTask || createdTasksMap.get(`main:${mainKey}`) || null;

          if (!mainTask) {
            const createdMainTask = await createImportedTask({
              title: result.row.mainTaskTitle || result.row.title,
              description: result.row.mainTaskTitle || result.row.title,
              status: 'todo',
              due_date: result.row.dueDate || undefined,
              row: { ...result.row, description: '' },
              assignee_ids: [],
              tags: ['import:crce'],
            });
            mainTask = createdMainTask;
            createdTasksMap.set(`main:${mainKey}`, mainTask);
            importedTaskIds.add(mainTask.id);
            created++;
          }

          await syncCrceMainTask(mainTask, result.row);

          if (result.action === 'create') {
            const newSubtask = await createImportedTask({
              title: result.row.subtaskTitle || result.row.title,
              description: result.row.description || result.row.subtaskTitle || result.row.title,
              status: result.parsedStatus || 'todo',
              due_date: result.row.dueDate || undefined,
              row: result.row,
              assignee_ids: result.matchedAssignees.map((a) => a.id),
              tags: result.row.tags || [],
              parent_id: mainTask.id,
              round_number: 1,
            });
            created++;
            importedTaskIds.add(newSubtask.id);
            continue;
          }

          if (result.action === 'update' && result.matchedTask) {
            importedTaskIds.add(result.matchedTask.id);
            const taskPatch: Parameters<typeof updateTask>[1] = {};
            if (result.parsedStatus && result.parsedStatus !== result.matchedTask.status) taskPatch.status = result.parsedStatus;
            if (result.row.dueDate && result.row.dueDate !== result.matchedTask.due_date) taskPatch.due_date = result.row.dueDate;
            const nextDescription = result.row.description || result.row.subtaskTitle || result.row.title;
            if (nextDescription !== (result.matchedTask.description || '')) taskPatch.description = nextDescription;
            if (Object.keys(taskPatch).length > 0) {
              await updateTask(result.matchedTask.id, taskPatch);
              if (taskPatch.description !== undefined) result.matchedTask.description = taskPatch.description ?? null;
              if (taskPatch.status) result.matchedTask.status = taskPatch.status;
              if (taskPatch.due_date !== undefined) result.matchedTask.due_date = taskPatch.due_date ?? null;
              updated++;
            }
            if (result.matchedAssignees.length > 0) {
              await updateTaskAssignees(result.matchedTask.id, result.matchedAssignees.map((a) => a.id));
            }
            await replaceTaskTags(result.matchedTask, result.row.tags || []);
            if (result.row.description && !result.logExists) {
              await createLog({
                task_id: result.matchedTask.id,
                date: result.row.dueDate || new Date().toISOString().slice(0, 10),
                event: result.row.description,
                category: 'other',
                file_name: result.row.fileLink || undefined,
              });
              logsAdded++;
            }
            continue;
          }
        }
        
        if (result.action === 'update' && result.matchedTask) {
          // Track this task was imported
          importedTaskIds.add(result.matchedTask.id);

          const taskPatch: Parameters<typeof updateTask>[1] = {};
          if (result.parsedStatus && result.parsedStatus !== result.matchedTask.status) {
            taskPatch.status = result.parsedStatus;
          }
          if (result.row.dueDate && result.row.dueDate !== result.matchedTask.due_date) {
            taskPatch.due_date = result.row.dueDate;
          }
          if (result.isDay2 && !result.matchedTask.is_focus) {
            taskPatch.is_focus = true;
          }
          if (Object.keys(taskPatch).length > 0) {
            await updateTask(result.matchedTask.id, taskPatch);
            updated++;
          }

          if (result.matchedAssignees.length > 0) {
            await updateTaskAssignees(result.matchedTask.id, result.matchedAssignees.map((a) => a.id));
          }

          // Add log only if it's new (not existing)
          if (result.row.description && !result.logExists) {
            await createLog({
              task_id: result.matchedTask.id,
              date: result.row.dueDate || new Date().toISOString().slice(0, 10),
              event: result.row.description,
              category: 'other',
              file_name: result.row.fileLink || undefined,
            });
            logsAdded++;
          }
        } else if (result.action === 'create') {
          const taskKey = normalizeTaskCode(result.row.taskId) || result.row.title;
          const existingCreatedTask = createdTasksMap.get(taskKey);
          
          if (existingCreatedTask) {
            // Same task in batch → update status + add log (if new)
            importedTaskIds.add(existingCreatedTask.id);

            const taskPatch: Parameters<typeof updateTask>[1] = {};
            if (result.parsedStatus && result.parsedStatus !== existingCreatedTask.status) {
              taskPatch.status = result.parsedStatus;
            }
            if (result.row.dueDate && result.row.dueDate !== existingCreatedTask.due_date) {
              taskPatch.due_date = result.row.dueDate;
            }
            if (result.isDay2 && !existingCreatedTask.is_focus) {
              taskPatch.is_focus = true;
            }
            if (Object.keys(taskPatch).length > 0) {
              await updateTask(existingCreatedTask.id, taskPatch);
              updated++;
            }

            if (result.matchedAssignees.length > 0) {
              await updateTaskAssignees(existingCreatedTask.id, result.matchedAssignees.map((a) => a.id));
            }

            if (result.row.description && !result.logExists) {
              await createLog({
                task_id: existingCreatedTask.id,
                date: result.row.dueDate || new Date().toISOString().slice(0, 10),
                event: result.row.description,
                category: 'other',
                file_name: result.row.fileLink || undefined,
              });
              logsAdded++;
            }
          } else {
            // Create new task
            const normalizedTaskId = normalizeTaskCode(result.row.taskId);
            const fullTitle = normalizedTaskId 
              ? `${normalizedTaskId} - ${result.row.title}` 
              : result.row.title;
            
            const newTask = await createImportedTask({
              title: fullTitle,
              description: result.row.description,
              status: result.parsedStatus || 'todo',
              due_date: result.row.dueDate || undefined,
              row: result.row,
              assignee_ids: result.matchedAssignees.map(a => a.id),
              tags: [],
              is_focus: result.isDay2 || false,
            });
            
            created++;
            createdTasksMap.set(taskKey, newTask);
            importedTaskIds.add(newTask.id);
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

    try {
      await flushPendingWrites();
    } catch (error) {
      console.error('Failed to flush batched import writes:', error);
      failures.push({
        row: -1,
        title: 'Bulk import writes',
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
    
    // Generic daily-report imports used to clear focus. CRCE imports should not touch it.
    if (!isCrceImport) {
      try {
        const allTasks = await fetchTasks();
        const oldFocusTasks = allTasks.filter(t => t.is_focus && !importedTaskIds.has(t.id));
        for (const task of oldFocusTasks) {
          await updateTask(task.id, { is_focus: false });
        }
        console.log(`Cleared focus on ${oldFocusTasks.length} old focus tasks`);
      } catch (error) {
        console.error('Failed to reset old focus tasks:', error);
      }
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
            <BackButton onClick={() => navigate('/')} style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '10px 16px' }} />
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
        {isCrceImport && (
          <div style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: '12px', background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontSize: '14px', fontWeight: 500 }}>
            {importMeta.restoredFromSnapshotId
              ? `Restoring snapshot${importMeta.sourceLabel ? `: ${importMeta.sourceLabel}` : ''}. This will replace current task data.`
              : `This CRCE import will replace current task data before importing the new spreadsheet${importMeta.sourceLabel ? `: ${importMeta.sourceLabel}` : ''}.`}
          </div>
        )}

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
  const statusConfig = parsedStatus ? getStatusMeta(parsedStatus) : null;
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
          
          {/* Description / Detailed Progress */}
          {row.description && row.description !== row.title && (
            <div style={{ fontSize: '13px', color: '#374151', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
              📝 {row.description}
            </div>
          )}

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
              <span style={{ marginLeft: '8px', color: '#94a3b8' }}>({getStatusMeta(matchedTask.status).label})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Plus, ArrowLeft, ChevronDown, ChevronUp, User, Search } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { fetchTasks, fetchProfiles, updateTask, createTask, createLog } from '../lib/api';
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
  matchType: 'exact' | 'suggested' | 'none' | 'duplicate';
  matchedTask: TaskItem | null;
  suggestedTasks: TaskItem[];
  matchedAssignees: Profile[];
  parsedStatus: TaskStatus | null;
  confirmed: boolean;
  action: 'update' | 'create' | 'skip';
  originalIndex: number; // Track original index in matchResults
}

// Check if imported row is exact duplicate of existing task
function isDuplicate(row: ImportRow, task: TaskItem, parsedStatus: TaskStatus | null): boolean {
  if (!parsedStatus || task.status !== parsedStatus) return false;
  
  // Compare title (including Task ID)
  const importTitle = row.taskId && row.taskId !== '-' ? `${row.taskId} - ${row.title}` : row.title;
  if (importTitle !== task.title) return false;
  
  // Compare due date
  if (row.dueDate !== task.due_date) return false;
  
  return true;
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
};

// Parse status from XLS
function parseStatus(statusStr: string): TaskStatus | null {
  const normalized = statusStr.trim();
  return STATUS_MAP[normalized] || null;
}

// Extract Task ID from title (e.g., "CR-109: Some title" or "CRCE-2523 Task name")
function extractTaskId(title: string): string | null {
  // Match patterns like CR-109, CRCE-2523, PMC-123, etc.
  const match = title.match(/^([A-Z]{2,6}-\d{2,6})/i);
  return match ? match[1].toUpperCase() : null;
}

// Clean title by removing Task ID prefix
function cleanTitle(title: string): string {
  return title.replace(/^([A-Z]{2,6}-\d{2,6})[\s:-]*/i, '').trim();
}

// Fuzzy match score between two strings (0-1)
function similarityScore(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Simple word overlap score
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);
  return intersection.length / union.size;
}

// Find matching assignees by name
function findAssigneesByName(names: string[], profiles: Profile[]): Profile[] {
  const matches: Profile[] = [];
  for (const name of names) {
    const normalizedName = name.trim().toLowerCase();
    const match = profiles.find(p => 
      p.name.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(p.name.toLowerCase().split(' ')[0].toLowerCase())
    );
    if (match && !matches.find(m => m.id === match.id)) {
      matches.push(match);
    }
  }
  return matches;
}

export function ImportReviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    exact: true,
    suggested: true,
    duplicate: true,
    none: true,
  });
  
  // Parse imported data from navigation state
  const importData: ImportRow[] = location.state?.importData || [];
  
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);

  useEffect(() => {
    if (!importData.length) {
      navigate('/');
      return;
    }
    
    const loadData = async () => {
      try {
        const [tasks, profs] = await Promise.all([fetchTasks(), fetchProfiles()]);
        
        // Perform matching
        const results = performMatching(importData, tasks, profs);
        setMatchResults(results);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [importData, navigate]);

  const performMatching = (rows: ImportRow[], tasks: TaskItem[], profs: Profile[]): MatchResult[] => {
    return rows.map((row, rowIndex) => {
      const parsedStatus = parseStatus(row.status);
      const extractedId = extractTaskId(row.title);
      const cleanTitleStr = cleanTitle(row.title);
      
      // Try exact match by Task ID
      let matchedTask: TaskItem | null = null;
      let matchType: 'exact' | 'suggested' | 'none' = 'none';
      
      if (extractedId) {
        matchedTask = tasks.find(t => {
          const taskExtractedId = extractTaskId(t.title);
          return taskExtractedId === extractedId;
        }) || null;
        
        if (matchedTask) {
          matchType = 'exact';
        }
      }
      
      // If no exact match, try fuzzy match
      const suggestedTasks: TaskItem[] = [];
      if (!matchedTask) {
        const scoredTasks = tasks
          .map(t => ({ task: t, score: similarityScore(cleanTitleStr, t.title) }))
          .filter(t => t.score > 0.4)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        
        if (scoredTasks.length > 0) {
          suggestedTasks.push(...scoredTasks.map(t => t.task));
          matchType = 'suggested';
        }
      }
      
      const matchedAssignees = findAssigneesByName(row.assigneeNames, profs);
      
      // Check if exact match is actually a duplicate (same title, status, due date)
      if (matchedTask && isDuplicate(row, matchedTask, parsedStatus)) {
        // Check if description is also the same
        const hasNewDescription = row.description && row.description.trim().length > 0;
        
        return {
          row,
          matchType: 'duplicate',
          matchedTask,
          suggestedTasks,
          matchedAssignees,
          parsedStatus,
          confirmed: !hasNewDescription, // Auto-skip if no new description, otherwise let user decide
          action: hasNewDescription ? 'update' : 'skip', // If has description, allow adding log
          originalIndex: rowIndex,
        };
      }
      
      return {
        row,
        matchType,
        matchedTask,
        suggestedTasks,
        matchedAssignees,
        parsedStatus,
        confirmed: matchType === 'exact',
        action: matchType === 'exact' ? 'update' : matchType === 'none' ? 'create' : 'skip',
        originalIndex: rowIndex, // Track original index
      };
    });
  };

  const groupedResults = useMemo(() => {
    return {
      exact: matchResults.filter(r => r.matchType === 'exact'),
      suggested: matchResults.filter(r => r.matchType === 'suggested'),
      duplicate: matchResults.filter(r => r.matchType === 'duplicate'),
      none: matchResults.filter(r => r.matchType === 'none'),
    };
  }, [matchResults]);

  const totalCount = matchResults.length;

  const handleExecute = async () => {
    setProcessing(true);
    
    // Auto-confirm all non-duplicate items
    const resultsToProcess = matchResults.map(r => {
      if (r.matchType === 'duplicate' && !r.row.description) {
        return { ...r, confirmed: false, action: 'skip' as const };
      }
      return { ...r, confirmed: true };
    });
    
    // Track newly created tasks during this batch by Task ID
    const createdTasksMap = new Map<string, TaskItem>();
    let created = 0, updated = 0, logsAdded = 0, skipped = 0;
    const failures: { row: number; title: string; error: string }[] = [];
    
    for (const result of resultsToProcess) {
      if (!result.confirmed || result.action === 'skip') {
        skipped++;
        continue;
      }
      
      try {
        if (result.action === 'update' && result.matchedTask) {
          if (result.matchType === 'duplicate') {
            // For duplicates with new description, only add log
            if (result.row.description) {
              await createLog({
                task_id: result.matchedTask.id,
                date: result.row.dueDate || new Date().toISOString().slice(0, 10),
                event: result.row.description,
                category: 'other',
              });
              logsAdded++;
            }
          } else {
            // Normal update - update task status
            await updateTask(result.matchedTask.id, {
              status: result.parsedStatus || result.matchedTask.status,
            });
            updated++;
            // Create log entry for the update
            if (result.row.description) {
              await createLog({
                task_id: result.matchedTask.id,
                date: result.row.dueDate || new Date().toISOString().slice(0, 10),
                event: result.row.description,
                category: 'other',
              });
              logsAdded++;
            }
          }
        } else if (result.action === 'create') {
          const taskKey = result.row.taskId || result.row.title;
          
          // Check if this task was already created in this batch
          const existingCreatedTask = createdTasksMap.get(taskKey);
          
          if (existingCreatedTask) {
            // Task already created in this batch, update status if different and add log
            if (result.parsedStatus && result.parsedStatus !== existingCreatedTask.status) {
              await updateTask(existingCreatedTask.id, {
                status: result.parsedStatus,
              });
              existingCreatedTask.status = result.parsedStatus;
              updated++;
            }
            // Add log if description exists
            if (result.row.description) {
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
            
            // Track the newly created task
            createdTasksMap.set(taskKey, newTask as TaskItem);
            
            // Create log entry
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
        console.error(`Failed to process row ${result.row.rowIndex}:`, error);
        failures.push({
          row: result.row.rowIndex,
          title: result.row.title,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    // Build detailed report
    let report = `Import Results:\n\n`;
    report += `✅ Created: ${created} tasks\n`;
    report += `📝 Updated: ${updated} tasks\n`;
    report += `📋 Logs added: ${logsAdded}\n`;
    report += `⏭️ Skipped: ${skipped} duplicates\n`;
    
    if (failures.length > 0) {
      report += `\n❌ Failed: ${failures.length} items\n`;
      failures.slice(0, 5).forEach(f => {
        report += `  Row ${f.row}: ${f.title} - ${f.error}\n`;
      });
      if (failures.length > 5) {
        report += `  ...and ${failures.length - 5} more\n`;
      }
    }
    
    alert(report);
    navigate('/');
    setProcessing(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>Loading tasks...</div>
            <div style={{ fontSize: '14px', color: '#94a3b8' }}>Matching imported data with existing tasks</div>
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
            <button 
              onClick={() => navigate('/')}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '10px 16px', 
                borderRadius: '10px', 
                border: '1px solid #e2e8f0', 
                background: '#fff', 
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: '#475569',
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 }}>Import Review</h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>
              {totalCount} items ready to import
            </span>
            <button 
              onClick={handleExecute}
              disabled={processing}
              style={{ 
                padding: '12px 24px', 
                borderRadius: '10px', 
                border: 'none', 
                background: '#111827', 
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {processing ? 'Importing...' : 'Import All'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <StatCard 
            label="Exact Match" 
            count={groupedResults.exact.length} 
            color="#10b981" 
            icon={<CheckCircle2 size={20} />}
          />
          <StatCard 
            label="Suggested Match" 
            count={groupedResults.suggested.length} 
            color="#f59e0b" 
            icon={<Search size={20} />}
          />
          <StatCard 
            label="Duplicate" 
            count={groupedResults.duplicate.length} 
            color="#6b7280" 
            icon={<AlertCircle size={20} />}
          />
          <StatCard 
            label="Create New" 
            count={groupedResults.none.length} 
            color="#3b82f6" 
            icon={<Plus size={20} />}
          />
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Exact Matches */}
          <MatchSection
            title="Exact Match (Auto)"
            subtitle="Tasks matched by Task ID - will be updated automatically"
            color="#10b981"
            expanded={expandedSections.exact}
            onToggle={() => toggleSection('exact')}
            results={groupedResults.exact}
          />
          
          {/* Suggested Matches */}
          <MatchSection
            title="Suggested Match"
            subtitle="Similar tasks found - will be updated automatically"
            color="#f59e0b"
            expanded={expandedSections.suggested}
            onToggle={() => toggleSection('suggested')}
            results={groupedResults.suggested}
          />
          
          {/* Duplicate */}
          <MatchSection
            title="Duplicate"
            subtitle="Same task found - will be skipped"
            color="#6b7280"
            expanded={expandedSections.duplicate}
            onToggle={() => toggleSection('duplicate')}
            results={groupedResults.duplicate}
          />
          
          {/* No Match - Create New */}
          <MatchSection
            title="Create New"
            subtitle="No matching tasks found - will create new tasks"
            color="#3b82f6"
            expanded={expandedSections.none}
            onToggle={() => toggleSection('none')}
            results={groupedResults.none}
          />
        </div>
      </div>
    </AppShell>
  );
}

interface StatCardProps {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}

function StatCard({ label, count, color, icon }: StatCardProps) {
  return (
    <div style={{ 
      flex: 1,
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <div style={{ 
        width: '40px', 
        height: '40px', 
        borderRadius: '10px', 
        background: `${color}15`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>{count}</div>
        <div style={{ fontSize: '13px', color: '#64748b' }}>{label}</div>
      </div>
    </div>
  );
}

interface MatchSectionProps {
  title: string;
  subtitle: string;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  results: MatchResult[];
}

function MatchSection({ 
  title, subtitle, color, expanded, onToggle, results
}: MatchSectionProps) {
  if (results.length === 0) return null;

  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: '12px', 
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
    }}>
      <div 
        onClick={onToggle}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          padding: '16px 20px', 
          background: '#f8fafc',
          borderBottom: expanded ? '1px solid #e2e8f0' : 'none',
          cursor: 'pointer',
        }}
      >
        {expanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
        <div style={{ 
          width: '10px', 
          height: '10px', 
          borderRadius: '50%', 
          background: color 
        }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>{title}</span>
          <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '12px' }}>{subtitle}</span>
        </div>
        <span style={{ 
          fontSize: '13px', 
          fontWeight: 600, 
          color: color,
          background: `${color}15`,
          padding: '4px 12px',
          borderRadius: '20px',
        }}>
          {results.length}
        </span>
      </div>
      
      {expanded && (
        <div style={{ padding: '8px' }}>
          {results.map((result) => (
            <MatchResultRow
              key={result.row.rowIndex}
              result={result}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MatchResultRowProps {
  result: MatchResult;
}

function MatchResultRow({ result }: MatchResultRowProps) {
  const { row, matchedTask, matchedAssignees, parsedStatus } = result;
  
  const statusConfig = parsedStatus ? STATUS_META[parsedStatus] : null;
  const extractedId = extractTaskId(row.title);

  return (
    <div style={{ 
      padding: '16px 20px',
      borderBottom: '1px solid #f1f5f9',
      background: '#fff',
    }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Auto-action indicator */}
        <div style={{ paddingTop: '4px' }}>
          {result.matchType === 'duplicate' ? (
            <span style={{ fontSize: '11px', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>Skip</span>
          ) : result.matchType === 'exact' ? (
            <span style={{ fontSize: '11px', color: '#047857', background: '#f0fdf4', padding: '2px 8px', borderRadius: '4px' }}>Update</span>
          ) : result.matchType === 'suggested' ? (
            <span style={{ fontSize: '11px', color: '#b45309', background: '#fefce8', padding: '2px 8px', borderRadius: '4px' }}>Update</span>
          ) : (
            <span style={{ fontSize: '11px', color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>Create</span>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            {extractedId && (
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: '#7c3aed',
                background: '#ede9fe',
                padding: '2px 8px',
                borderRadius: '4px',
              }}>
                {extractedId}
              </span>
            )}
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>
              {row.taskId && row.taskId !== '-' ? `${row.taskId} - ${row.title}` : row.title}
            </span>
            {statusConfig && (
              <span style={{ 
                fontSize: '11px', 
                fontWeight: 600,
                color: statusConfig.color,
                background: statusConfig.bg,
                padding: '2px 8px',
                borderRadius: '4px',
              }}>
                {statusConfig.label}
              </span>
            )}
          </div>

          {/* Details row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Row {row.rowIndex}
            </span>
            {matchedAssignees.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={12} color="#94a3b8" />
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {matchedAssignees.map(a => a.name).join(', ')}
                </span>
              </div>
            )}
            {row.dueDate && (
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Due: {row.dueDate}
              </span>
            )}
          </div>

          {/* Matched task display */}
          {matchedTask && (
            <div style={{ 
              padding: '8px 12px', 
              background: '#f8fafc', 
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '12px',
              color: '#64748b',
            }}>
              → {matchedTask.title}
              <span style={{ marginLeft: '8px', color: '#94a3b8' }}>
                ({STATUS_META[matchedTask.status].label})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

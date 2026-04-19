import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Plus, ArrowLeft, ChevronDown, ChevronUp, User, Search } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { fetchTasks, fetchProfiles, updateTask, createTask } from '../lib/api';
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
  matchType: 'exact' | 'suggested' | 'none';
  matchedTask: TaskItem | null;
  suggestedTasks: TaskItem[];
  matchedAssignees: Profile[];
  parsedStatus: TaskStatus | null;
  confirmed: boolean;
  action: 'update' | 'create' | 'skip';
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
  const [, setExistingTasks] = useState<TaskItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    exact: true,
    suggested: true,
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
        setExistingTasks(tasks);
        setProfiles(profs);
        
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
    return rows.map(row => {
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
      
      return {
        row,
        matchType,
        matchedTask,
        suggestedTasks,
        matchedAssignees,
        parsedStatus,
        confirmed: matchType === 'exact',
        action: matchType === 'exact' ? 'update' : matchType === 'none' ? 'create' : 'skip',
      };
    });
  };

  const updateMatchResult = (index: number, updates: Partial<MatchResult>) => {
    setMatchResults(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const groupedResults = useMemo(() => {
    return {
      exact: matchResults.filter(r => r.matchType === 'exact'),
      suggested: matchResults.filter(r => r.matchType === 'suggested'),
      none: matchResults.filter(r => r.matchType === 'none'),
    };
  }, [matchResults]);

  const confirmedCount = matchResults.filter(r => r.confirmed).length;
  const totalCount = matchResults.length;

  const handleExecute = async () => {
    setProcessing(true);
    const confirmedResults = matchResults.filter(r => r.confirmed && r.action !== 'skip');
    
    try {
      for (const result of confirmedResults) {
        if (result.action === 'update' && result.matchedTask) {
          await updateTask(result.matchedTask.id, {
            status: result.parsedStatus || result.matchedTask.status,
          });
        } else if (result.action === 'create') {
          await createTask({
            title: result.row.title,
            description: result.row.description,
            status: result.parsedStatus || 'todo',
            priority: 'medium',
            due_date: result.row.dueDate || undefined,
            assignee_ids: result.matchedAssignees.map(a => a.id),
            tags: [],
          });
        }
      }
      
      navigate('/');
    } catch (error) {
      console.error('Failed to execute imports:', error);
      alert('Some imports failed. Please try again.');
    } finally {
      setProcessing(false);
    }
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
              {confirmedCount} of {totalCount} confirmed
            </span>
            <button 
              onClick={handleExecute}
              disabled={processing || confirmedCount === 0}
              style={{ 
                padding: '12px 24px', 
                borderRadius: '10px', 
                border: 'none', 
                background: confirmedCount > 0 ? '#111827' : '#e2e8f0', 
                color: confirmedCount > 0 ? '#fff' : '#94a3b8',
                cursor: confirmedCount > 0 ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {processing ? 'Processing...' : `Execute ${confirmedCount} Imports`}
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
            onUpdate={updateMatchResult}
            _profiles={profiles}
          />
          
          {/* Suggested Matches */}
          <MatchSection
            title="Suggested Match (Needs Confirmation)"
            subtitle="Similar tasks found - please review and confirm"
            color="#f59e0b"
            expanded={expandedSections.suggested}
            onToggle={() => toggleSection('suggested')}
            results={groupedResults.suggested}
            onUpdate={updateMatchResult}
            _profiles={profiles}
            showSuggestions
          />
          
          {/* No Match - Create New */}
          <MatchSection
            title="Create New"
            subtitle="No matching tasks found - will create new tasks"
            color="#3b82f6"
            expanded={expandedSections.none}
            onToggle={() => toggleSection('none')}
            results={groupedResults.none}
            onUpdate={updateMatchResult}
            _profiles={profiles}
            isCreateNew
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
  onUpdate: (index: number, updates: Partial<MatchResult>) => void;
  _profiles: Profile[];  // Available for future use
  showSuggestions?: boolean;
  isCreateNew?: boolean;
}

function MatchSection({ 
  title, subtitle, color, expanded, onToggle, results, onUpdate, _profiles, showSuggestions, isCreateNew 
}: MatchSectionProps) {
  if (results.length === 0) return null;

  // Offset tracking removed - not currently used
  // const globalIndexOffset = {...};

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
          {results.map((result, idx) => (
            <MatchResultRow
              key={idx}
              result={result}
              onUpdate={(updates) => onUpdate(results.indexOf(result), updates)}
              _profiles={_profiles}
              showSuggestions={showSuggestions}
              isCreateNew={isCreateNew}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MatchResultRowProps {
  result: MatchResult;
  onUpdate: (updates: Partial<MatchResult>) => void;
  _profiles: Profile[];  // Available for future use
  showSuggestions?: boolean;
  isCreateNew?: boolean;
}

function MatchResultRow({ result, onUpdate, _profiles: _unusedProfiles, showSuggestions, isCreateNew }: MatchResultRowProps) {
  const { row, matchedTask, suggestedTasks, matchedAssignees, parsedStatus, confirmed, action } = result;
  
  const statusConfig = parsedStatus ? STATUS_META[parsedStatus] : null;
  const extractedId = extractTaskId(row.title);

  return (
    <div style={{ 
      padding: '16px 20px',
      borderBottom: '1px solid #f1f5f9',
      background: confirmed ? '#f0fdf4' : '#fff',
    }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Checkbox */}
        <div style={{ paddingTop: '4px' }}>
          <button
            onClick={() => onUpdate({ confirmed: !confirmed })}
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '6px',
              border: confirmed ? 'none' : '2px solid #cbd5e1',
              background: confirmed ? '#10b981' : '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {confirmed && <CheckCircle2 size={14} color="#fff" />}
          </button>
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
              {cleanTitle(row.title)}
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

          {/* Action selector */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: showSuggestions && suggestedTasks.length > 0 ? '12px' : 0 }}>
            {!isCreateNew && (
              <button
                onClick={() => onUpdate({ action: 'update', confirmed: true })}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: action === 'update' ? '1px solid #10b981' : '1px solid #e2e8f0',
                  background: action === 'update' ? '#f0fdf4' : '#fff',
                  color: action === 'update' ? '#047857' : '#64748b',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Update Existing
              </button>
            )}
            <button
              onClick={() => onUpdate({ action: 'create', confirmed: true })}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: action === 'create' ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                background: action === 'create' ? '#eff6ff' : '#fff',
                color: action === 'create' ? '#1d4ed8' : '#64748b',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Create New
            </button>
            <button
              onClick={() => onUpdate({ action: 'skip', confirmed: false })}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: action === 'skip' ? '1px solid #ef4444' : '1px solid #e2e8f0',
                background: action === 'skip' ? '#fef2f2' : '#fff',
                color: action === 'skip' ? '#dc2626' : '#64748b',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
          </div>

          {/* Suggested matches */}
          {showSuggestions && suggestedTasks.length > 0 && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#fefce8', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#854d0e', marginBottom: '8px' }}>
                <AlertCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Similar tasks found:
              </div>
              {suggestedTasks.map((task, i) => (
                <div 
                  key={task.id}
                  onClick={() => onUpdate({ matchedTask: task, action: 'update', confirmed: true })}
                  style={{
                    padding: '8px 12px',
                    marginBottom: i < suggestedTasks.length - 1 ? '4px' : 0,
                    background: matchedTask?.id === task.id ? '#f0fdf4' : '#fff',
                    border: matchedTask?.id === task.id ? '1px solid #10b981' : '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: matchedTask?.id === task.id ? '#047857' : '#374151',
                  }}
                >
                  {task.title}
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>
                    Current: {STATUS_META[task.status].label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Matched task display */}
          {matchedTask && action === 'update' && (
            <div style={{ 
              marginTop: '12px', 
              padding: '12px', 
              background: '#f0fdf4', 
              borderRadius: '8px',
              border: '1px solid #10b981',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#047857', marginBottom: '4px' }}>
                Will update:
              </div>
              <div style={{ fontSize: '13px', color: '#374151' }}>
                {matchedTask.title}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Status: {STATUS_META[matchedTask.status].label} → {statusConfig?.label || 'Unchanged'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Download, Filter } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { fetchProfiles, fetchAllLogs } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/date';
import type { LogEntry, Profile } from '../types';
import { panelStyle } from './TaskListPage';
import { useAuth } from '../contexts/AuthContext';

export function AdminLogsPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    
    setLoading(true);
    Promise.all([
      fetchAllLogs(),
      fetchProfiles()
    ])
      .then(([logsData, profilesData]) => {
        setLogs(logsData);
        setProfiles(profilesData);
      })
      .catch((error) => alert(`Load logs failed: ${error.message}`))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const datesWithLogs = useMemo(() => {
    const dates = new Set<string>();
    logs.forEach(log => {
      if (log.date) dates.add(log.date);
    });
    return dates;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesDate = log.date === selectedDate;
      const matchesUser = selectedUser === 'all' || log.created_by === selectedUser;
      return matchesDate && matchesUser;
    });
  }, [logs, selectedDate, selectedUser]);

  const logsByUser = useMemo(() => {
    const grouped: Record<string, LogEntry[]> = {};
    filteredLogs.forEach(log => {
      const userId = log.created_by;
      if (!grouped[userId]) grouped[userId] = [];
      grouped[userId].push(log);
    });
    return grouped;
  }, [filteredLogs]);

  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().slice(0, 10));
  };

  const exportToCSV = () => {
    const headers = ['Date', 'User', 'Task ID', 'Category', 'Event', 'Time Spent', 'Created At'];
    const rows = filteredLogs.map(log => {
      const user = profiles.find(p => p.id === log.created_by);
      return [
        log.date,
        user?.name || 'Unknown',
        log.task_id,
        log.category,
        log.event.replace(/"/g, '""'),
        log.time_spent || '',
        log.created_at
      ];
    });
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `logs-${selectedDate}.csv`;
    link.click();
  };

  const generateCalendarDays = () => {
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days: { date: string; hasLog: boolean; isSelected: boolean; isToday: boolean }[] = [];
    
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: '', hasLog: false, isSelected: false, isToday: false });
    }
    
    const today = new Date().toISOString().slice(0, 10);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        hasLog: datesWithLogs.has(dateStr),
        isSelected: dateStr === selectedDate,
        isToday: dateStr === today,
      });
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const currentMonthYear = new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (!isAdmin) {
    return (
      <AppShell>
        <div style={{ ...panelStyle, textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>Access Denied</div>
          <p style={{ color: '#6b7280', marginTop: '12px' }}>Only admins can access this page.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: '18px' }}>
        <section style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827' }}>Team Logs</div>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
                View and export daily logs from all team members.
              </p>
            </div>
            <button
              onClick={() => setShowExport(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                background: '#111827',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <Download size={16} /> Export Report
            </button>
          </div>
        </section>

        <section style={{ ...panelStyle, display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={goToPreviousDay}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid #e2e8f0',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={18} color="#374151" />
            </button>

            <button
              onClick={() => setShowDatePicker(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '10px',
                border: '2px solid #7c3aed',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 700,
                color: '#111827',
              }}
            >
              <Calendar size={18} color="#7c3aed" />
              {formatDate(selectedDate)}
            </button>

            <button 
              onClick={goToNextDay}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid #e2e8f0',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronRight size={18} color="#374151" />
            </button>

            <button 
              onClick={goToToday}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#7c3aed',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 12px',
              }}
            >
              Today
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <Filter size={16} color="#6b7280" />
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Members</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </section>

        {showDatePicker && (
          <div 
            onClick={() => setShowDatePicker(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 400,
              padding: '24px',
            }}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: '20px',
                padding: '24px',
                width: '100%',
                maxWidth: '340px',
              }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}>
                <button 
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setMonth(d.getMonth() - 1);
                    setSelectedDate(d.toISOString().slice(0, 10));
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <ChevronLeft size={20} />
                </button>
                <span style={{ fontSize: '16px', fontWeight: 700 }}>{currentMonthYear}</span>
                <button 
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setMonth(d.getMonth() + 1);
                    setSelectedDate(d.toISOString().slice(0, 10));
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)', 
                gap: '4px',
                marginBottom: '8px',
              }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} style={{ 
                    textAlign: 'center', 
                    fontSize: '12px', 
                    fontWeight: 600, 
                    color: '#9ca3af',
                    padding: '8px 0',
                  }}>{day}</div>
                ))}
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)', 
                gap: '4px',
              }}>
                {calendarDays.map((day, idx) => (
                  <button
                    key={idx}
                    disabled={!day.date}
                    onClick={() => {
                      if (day.date) {
                        setSelectedDate(day.date);
                        setShowDatePicker(false);
                      }
                    }}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '10px',
                      border: 'none',
                      background: day.isSelected ? '#7c3aed' : day.isToday ? '#ede9fe' : 'transparent',
                      cursor: day.date ? 'pointer' : 'default',
                      position: 'relative',
                      fontSize: '14px',
                      fontWeight: day.isSelected || day.isToday ? 700 : 500,
                      color: day.isSelected ? '#fff' : day.isToday ? '#7c3aed' : day.date ? '#374151' : 'transparent',
                    }}
                  >
                    {day.date ? new Date(day.date).getDate() : ''}
                    {day.hasLog && !day.isSelected && (
                      <div style={{
                        position: 'absolute',
                        bottom: '4px',
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: '#7c3aed',
                      }} />
                    )}
                  </button>
                ))}
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '16px',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e8f0',
                justifyContent: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7c3aed' }} />
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Has logs</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showExport && (
          <div 
            onClick={() => setShowExport(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 400,
              padding: '24px',
            }}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: '20px',
                padding: '28px',
                width: '100%',
                maxWidth: '400px',
              }}
            >
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                Export Report
              </div>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                Export logs for <strong>{formatDate(selectedDate)}</strong> 
                {selectedUser !== 'all' && (
                  <span> - {profiles.find(p => p.id === selectedUser)?.name}</span>
                )}
              </p>
              
              <div style={{ display: 'grid', gap: '10px' }}>
                <button
                  onClick={() => { exportToCSV(); setShowExport(false); }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => setShowExport(false)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#f3f4f6',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <section style={{ display: 'grid', gap: '16px' }}>
          {loading ? (
            <div style={panelStyle}>Loading...</div>
          ) : Object.keys(logsByUser).length === 0 ? (
            <div style={{ ...panelStyle, textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
              <p>No logs found for this date.</p>
            </div>
          ) : (
            Object.entries(logsByUser).map(([userId, userLogs]) => {
              const user = profiles.find(p => p.id === userId);
              return (
                <div key={userId} style={panelStyle}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #f1f5f9',
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: '#7c3aed',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: 700,
                    }}>
                      {user?.name?.[0] || '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                        {user?.name || 'Unknown User'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        {userLogs.length} log{userLogs.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '12px' }}>
                    {userLogs.map((log) => (
                      <div 
                        key={log.id} 
                        style={{ 
                          padding: '12px 16px',
                          background: '#f8fafc',
                          borderRadius: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: '#ede9fe',
                            color: '#6d28d9',
                          }}>
                            {log.category}
                          </span>
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', color: '#111827', lineHeight: 1.6 }}>
                          {log.event}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </AppShell>
  );
}

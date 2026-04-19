import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { fetchMyLogs } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/date';
import type { LogEntry } from '../types';
import { panelStyle } from './TaskListPage';

export function MyLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchMyLogs().then(setLogs).catch((error) => alert(`Load my logs failed: ${error.message}`)).finally(() => setLoading(false));
  }, []);

  // Get all dates that have logs (for highlighting in calendar)
  const datesWithLogs = useMemo(() => {
    const dates = new Set<string>();
    logs.forEach(log => {
      if (log.date) dates.add(log.date);
    });
    return dates;
  }, [logs]);

  // Filter logs for selected date
  const filteredLogs = useMemo(() => {
    return logs.filter(log => log.date === selectedDate);
  }, [logs, selectedDate]);

  // Navigation functions
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

  // Generate calendar days for date picker
  const generateCalendarDays = () => {
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days: { date: string; hasLog: boolean; isSelected: boolean; isToday: boolean }[] = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: '', hasLog: false, isSelected: false, isToday: false });
    }
    
    // Days of the month
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

  return (
    <AppShell>
      <div style={{ display: 'grid', gap: '18px' }}>
        {/* Header with Date Navigation */}
        <section style={panelStyle}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>My logs</div>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: '0 0 16px 0' }}>
            A clean list of updates you have posted across the workspace.
          </p>
          
          {/* Date Navigation Bar */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: '12px',
          }}>
            {/* Previous Day */}
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

            {/* Date Display - Clickable */}
            <button
              onClick={() => setShowDatePicker(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '10px',
                border: '2px solid #7c3aed',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 700,
                color: '#111827',
              }}
            >
              <Calendar size={18} color="#7c3aed" />
              {formatDate(selectedDate)}
            </button>

            {/* Next Day */}
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
          </div>

          {/* Today button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
            <button 
              onClick={goToToday}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#7c3aed',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 12px',
              }}
            >
              Go to Today
            </button>
          </div>
        </section>

        {/* Date Picker Modal */}
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
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            >
              {/* Calendar Header */}
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
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  <ChevronLeft size={20} color="#374151" />
                </button>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                  {currentMonthYear}
                </span>
                <button 
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setMonth(d.getMonth() + 1);
                    setSelectedDate(d.toISOString().slice(0, 10));
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  <ChevronRight size={20} color="#374151" />
                </button>
              </div>

              {/* Weekday Headers */}
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
                  }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
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
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: day.isSelected || day.isToday ? 700 : 500,
                      color: day.isSelected ? '#fff' : day.isToday ? '#7c3aed' : day.date ? '#374151' : 'transparent',
                    }}
                  >
                    {day.date ? new Date(day.date).getDate() : ''}
                    {/* Log indicator dot */}
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

              {/* Legend */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: '#ede9fe' }} />
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Today</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs for Selected Date */}
        <section style={{ display: 'grid', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: 0 }}>
              {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} for {formatDate(selectedDate)}
            </h2>
          </div>

          {loading ? (
            <div style={panelStyle}>Loading...</div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ ...panelStyle, textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
              <p>No log entries for this date.</p>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>Try selecting a different date or check other days with purple dots.</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <article key={log.id} style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }} className="task-card-head">
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#7c3aed' }}>{log.category} • {formatDate(log.date)}</div>
                    <div style={{ fontSize: '15px', color: '#111827', marginTop: '10px', lineHeight: 1.7 }}>{log.event}</div>
                  </div>
                  <div style={{ textAlign: 'right', color: '#6b7280', fontSize: '13px' }}>{formatDateTime(log.created_at)}</div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}

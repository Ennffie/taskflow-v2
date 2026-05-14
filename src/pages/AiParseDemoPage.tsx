import { useState } from 'react';
import { Sparkles, Wand2, Check } from 'lucide-react';
import { parseTaskWithGemma, type ParsedTaskDraft } from '../lib/localTaskParser';
import { VersionBadge } from '../components/VersionBadge';

const shell: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #fbf8ff 0%, #f4f9ff 100%)',
  padding: '32px 20px 48px',
};

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  borderRadius: '28px',
  border: '1px solid #e9e5ff',
  boxShadow: '0 16px 44px rgba(139, 92, 246, 0.08)',
};

const sampleEn = 'Hi Pamela, please follow up the onboarding page revision and send me an updated version by next Friday 3:30pm. If possible remind me one day before.';
const sampleZh = 'Alice 麻煩你跟進 onboarding page 個內容更新，下星期三朝早十一點前俾我 first draft，記得早一日提我。';

export function AiParseDemoPage() {
  const [input, setInput] = useState(sampleEn);
  const [result, setResult] = useState<ParsedTaskDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseTaskWithGemma(input);
      setResult(parsed);
    } catch (err: any) {
      setError(err?.message || 'Parse failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={shell}>
      <VersionBadge />
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: '#f3e8ff', color: '#6d28d9', fontWeight: 700, marginBottom: 16 }}>
          <Sparkles size={16} /> Local Gemma 4 parser demo
        </div>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.1, color: '#0f172a' }}>貼內容入嚟 → 本地 AI 出 task draft</h1>
        <p style={{ margin: '10px 0 24px', color: '#64748b', fontSize: 17 }}>呢版係最快可試 Version 1。貼內容，直接 call 你部 Mac mini 上面嘅 Gemma 4，再出 draft preview。</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 20 }}>
          <div style={{ ...card, padding: 24 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={() => setInput(sampleEn)} style={sampleBtn}>English sample</button>
              <button onClick={() => setInput(sampleZh)} style={sampleBtn}>中文 sample</button>
            </div>

            <div style={{ fontSize: 14, fontWeight: 800, color: '#334155', marginBottom: 10 }}>貼內容入嚟</div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ width: '100%', minHeight: 280, resize: 'vertical', borderRadius: 20, border: '1px solid #d8d4ff', padding: '16px 18px', fontSize: 16, lineHeight: 1.5, color: '#0f172a', background: '#fcfcff' }}
              placeholder="Paste email / message / note here..."
            />
            <button onClick={handleParse} disabled={loading || !input.trim()} style={{ marginTop: 16, width: '100%', padding: '15px 18px', borderRadius: 18, border: 'none', background: '#111827', color: '#fff', fontSize: 16, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.8 : 1 }}>
              <Wand2 size={18} /> {loading ? 'Gemma 4 解析中…' : '用本地 AI 幫我整理'}
            </button>
            {error ? <div style={{ marginTop: 12, color: '#b91c1c', fontSize: 14, fontWeight: 700 }}>{error}</div> : null}
          </div>

          <div style={{ ...card, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#334155' }}>Task draft preview</div>
              <div style={{ padding: '6px 10px', borderRadius: 999, background: '#dcfce7', color: '#166534', fontSize: 11, fontWeight: 900, letterSpacing: '.02em' }}>READY DEBUG ON</div>
            </div>
            {result ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <DraftRow label="Task" value={result.title} />
                <DraftRow label="Assignee" value={result.assignee ?? '—'} />
                <DraftRow label="Deadline date" value={result.deadline_date ?? '—'} />
                <DraftRow label="Deadline time" value={result.deadline_time ?? '—'} />
                <DraftRow label="Reminder" value={result.reminder_hint ?? '—'} />
                <DraftRow label="Next action" value={result.next_action} />
                <DraftRow label="Confidence" value={result.confidence} />
                <div style={{ marginTop: 8, padding: '14px 16px', borderRadius: 18, background: '#f8fafc', color: '#64748b', fontSize: 14 }}>下一步可以接：`改一改` / `建立 task`。</div>
              </div>
            ) : (
              <div style={{ padding: '22px 18px', borderRadius: 20, background: '#faf7ff', color: '#7c3aed', fontSize: 15, lineHeight: 1.6 }}>
                未 parse 前，呢邊會 show draft。你可以先撳上面 sample 試下。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftRow({ label, value }: { label: string; value: string }) {
  const hasValue = Boolean(value && value.trim() && value.trim() !== '—');

  return (
    <div style={{ padding: '14px 16px', borderRadius: 18, border: hasValue ? '1px solid #86efac' : '1px solid #ede9fe', background: hasValue ? '#f0fdf4' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: hasValue ? '#166534' : '#94a3b8' }}>{label}</div>
        {hasValue && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
            <div style={{ minWidth: 18, width: 18, height: 18, borderRadius: 999, background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(16,185,129,0.22)' }}>
              <Check size={12} strokeWidth={3.2} />
            </div>
            <span>√ Ready</span>
          </div>
        )}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.45, color: '#0f172a', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const sampleBtn: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid #e9e5ff',
  background: '#fff',
  color: '#6d28d9',
  fontWeight: 700,
  cursor: 'pointer',
};

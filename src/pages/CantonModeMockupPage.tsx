import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { CalendarDays, Clock3, Plus, Sparkles, Waves } from 'lucide-react';

type Screen = 'home' | 'add' | 'detail';

const pageBg = 'linear-gradient(180deg, #f7f2ff 0%, #eef6ff 100%)';
const phoneShell: CSSProperties = {
  width: 390,
  minHeight: 844,
  borderRadius: 36,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(255,255,255,0.9)',
  boxShadow: '0 28px 80px rgba(76, 29, 149, 0.16)',
  backdropFilter: 'blur(24px)',
  overflow: 'hidden',
};
const sectionCard: CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 24,
  border: '1px solid rgba(226,232,240,0.9)',
  boxShadow: '0 10px 30px rgba(148, 163, 184, 0.12)',
};

const mockupMap: Record<Exclude<Screen, 'home'>, { label: string; src: string; note: string }> = {
  add: {
    label: 'Add task',
    src: '/taskflow-v2/mockups/addtask-asteroid-mobile.png',
    note: '一步步加 task 畫面，保持同一套小行星視覺語言。',
  },
  detail: {
    label: 'Task detail',
    src: '/taskflow-v2/mockups/taskdetail-asteroid-mobile.png',
    note: 'detail 仍然係真正管理層，hero 只做 overview。',
  },
};

export function CantonModeMockupPage() {
  const [screen, setScreen] = useState<Screen>('home');
  const current = screen === 'home' ? null : mockupMap[screen];

  return (
    <div style={{ minHeight: '100vh', background: pageBg, padding: '28px 20px 60px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(226,232,240,0.9)',
              borderRadius: 999,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 700,
              color: '#6d28d9',
              marginBottom: 14,
            }}
          >
            <Sparkles size={14} /> Canton mode clickable prototype
          </div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.1, color: '#0f172a' }}>Task follow-through app — asteroid direction</h1>
          <p style={{ margin: '10px 0 0', fontSize: 15, color: '#475569', maxWidth: 760 }}>
            呢版先將你已確認嘅小行星方向整合入 prototype，方便一路 review 再逐步 component 化。
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '390px 1fr', gap: 28, alignItems: 'start' }}>
          <div>
            <div style={phoneShell}>
              <div style={{ padding: '18px 18px 26px' }}>
                <div style={{ width: 88, height: 6, borderRadius: 999, background: '#e2e8f0', margin: '0 auto 18px' }} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <TopTab active={screen === 'home'} onClick={() => setScreen('home')}>Home</TopTab>
                  <TopTab active={screen === 'add'} onClick={() => setScreen('add')}>Add task</TopTab>
                  <TopTab active={screen === 'detail'} onClick={() => setScreen('detail')}>Detail</TopTab>
                </div>
                {screen === 'home' ? (
                  <ActualAsteroidHome onOpenAdd={() => setScreen('add')} onOpenDetail={() => setScreen('detail')} />
                ) : (
                  <div style={{ borderRadius: 26, overflow: 'hidden', border: '1px solid #ece7ff', background: '#fff' }}>
                    <img src={current!.src} alt={current!.label} style={{ display: 'block', width: '100%', height: 'auto' }} />
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 12, color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
              {screen === 'home'
                ? '首頁而家已經係真 frontend component，唔再係一張純圖片。'
                : current!.note}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <InfoPanel title="而家已經整合咗嘅方向">
              <Bullet>小行星視覺已經鎖定：主星 = main task，衛星 = subtasks。</Bullet>
              <Bullet>先用圖片 mockup 入 prototype，方便你快啲 review 大方向。</Bullet>
              <Bullet>下一步先再將 Home / Add / Detail 逐個畫面 component 化。</Bullet>
            </InfoPanel>

            <InfoPanel title="點解我而家咁做">
              <Bullet>你已經確認咗方向，所以我先唔再亂發散 concept。</Bullet>
              <Bullet>先整合成一個可切換 prototype，之後改會快好多。</Bullet>
              <Bullet>等你對方向再點頭，我就會真係拆成可互動 UI component。</Bullet>
            </InfoPanel>

            <InfoPanel title="下一步最實際做法">
              <Bullet>將首頁 hero 真 component 化。</Bullet>
              <Bullet>將 Add task flow 接返表單 state。</Bullet>
              <Bullet>再慢慢接本地 AI parse、task data、唔好漏咗 logic。</Bullet>
            </InfoPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopTab({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 12px',
        borderRadius: 999,
        border: active ? 'none' : '1px solid #e2e8f0',
        background: active ? '#111827' : 'rgba(255,255,255,0.84)',
        color: active ? '#fff' : '#475569',
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {children}
    </button>
  );
}

function ActualAsteroidHome({ onOpenAdd, onOpenDetail }: { onOpenAdd: () => void; onOpenDetail: () => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ padding: '10px 8px 2px' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>今日想先搞邊樣？</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>先睇最浮面嘅 main task，再慢慢跟落去</div>
      </div>

      <div style={{ ...sectionCard, padding: 16, background: 'linear-gradient(180deg, #ffffff 0%, #fbf7ff 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6d28d9', fontSize: 13, fontWeight: 800 }}>
            <Waves size={16} /> 而家浮面嘅 task
          </div>
          <button onClick={onOpenAdd} style={{ width: 40, height: 40, borderRadius: 14, border: 'none', background: '#111827', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Plus size={20} />
          </button>
        </div>
        <div style={{ position: 'relative', height: 356, borderRadius: 28, background: 'linear-gradient(180deg, #f7f2ff 0%, #edf6ff 100%)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: '54px 34px 64px', border: '2px dashed #e8ddff', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', inset: '28px 86px 28px', border: '2px dashed #efe7ff', borderRadius: '50%' }} />

          <div style={{ position: 'absolute', left: 100, top: 82, width: 174, height: 174, borderRadius: '50%', background: 'radial-gradient(circle at 35% 28%, #f1e5ff 0%, #ddd0fe 52%, #c8b0fa 100%)', boxShadow: '0 18px 40px rgba(139, 92, 246, 0.18)' }}>
            <div style={{ position: 'absolute', left: 34, top: 26, width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.16)' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 18 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#5b21b6', lineHeight: 1.05 }}>UX Review</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#6d28d9', marginTop: 8 }}>main task</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>5 subtasks orbiting around</div>
            </div>
          </div>

          {[
            { left: 169, top: 34, size: 28, fill: '#8B5CF6', inner: '#D8C1FF' },
            { left: 309, top: 156, size: 22, fill: '#A78BFA', inner: '#C9A9FF' },
            { left: 170, top: 294, size: 18, fill: '#DDD6FE', inner: '#7D3AED' },
            { left: 24, top: 158, size: 24, fill: '#E6D6FF', inner: '#7D3AED' },
            { left: 270, top: 284, size: 16, fill: '#F0ABFC', inner: '#7D3AED' },
          ].map((sat, idx) => (
            <div key={idx} style={{ position: 'absolute', left: sat.left, top: sat.top, width: sat.size * 2, height: sat.size * 2, borderRadius: '50%', background: sat.fill, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(139, 92, 246, 0.12)' }}>
              <div style={{ width: sat.size, height: sat.size, borderRadius: '50%', background: sat.inner, opacity: idx === 3 ? 0.16 : idx === 2 ? 0.55 : idx === 1 ? 0.34 : 0.92 }} />
            </div>
          ))}

          <button onClick={onOpenDetail} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} aria-label="Open task detail" />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <ChipButton active onClick={onOpenAdd}>一步步加</ChipButton>
          <ChipButton>直接打</ChipButton>
          <ChipButton>貼內容入嚟</ChipButton>
          <ChipButton>語音記低</ChipButton>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ ...sectionCard, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#0f172a', fontSize: 14, fontWeight: 800 }}>
            <Clock3 size={15} color="#7c3aed" /> 今日要搞
          </div>
          <TaskRow title="跟進 onboarding page" meta="交俾：Alice · 今日 5:30 PM" />
          <TaskRow title="Benne UX review deck" meta="交俾：我自己 · 今日 3:30 PM" tone="warn" />
        </div>
        <div style={{ ...sectionCard, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#0f172a', fontSize: 14, fontWeight: 800 }}>
            <CalendarDays size={15} color="#7c3aed" /> 唔好漏咗
          </div>
          <RiskRow text="未設定 deadline" />
          <RiskRow text="等緊人覆" />
          <RiskRow text="未確認 assignee" />
        </div>
      </div>
    </div>
  );
}

function ChipButton({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderRadius: 999,
        border: '1px solid #ece7ff',
        background: active ? '#111827' : '#fff',
        color: active ? '#fff' : '#4b5563',
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {children}
    </button>
  );
}

function TaskRow({ title, meta, tone = 'normal' }: { title: string; meta: string; tone?: 'normal' | 'warn' }) {
  return (
    <div style={{ padding: '12px 12px 11px', borderRadius: 18, border: `1px solid ${tone === 'warn' ? '#FDE2B8' : '#E5E7EB'}`, background: tone === 'warn' ? '#FFF8ED' : '#fff', marginBottom: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{meta}</div>
    </div>
  );
}

function RiskRow({ text }: { text: string }) {
  return <div style={{ padding: '14px 12px', borderRadius: 18, border: '1px solid #E5E7EB', background: '#fff', color: '#0f172a', fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{text}</div>;
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ ...sectionCard, padding: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'start', color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
      <div style={{ width: 8, height: 8, borderRadius: 999, background: '#8b5cf6', marginTop: 7, flexShrink: 0 }} />
      <div>{children}</div>
    </div>
  );
}

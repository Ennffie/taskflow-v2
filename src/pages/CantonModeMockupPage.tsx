import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

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

const mockupMap: Record<Screen, { label: string; src: string; note: string }> = {
  home: {
    label: 'Home',
    src: '/taskflow-v2/mockups/homepage-asteroid-mobile-refined-v2.png',
    note: '首頁 hero 已鎖定做小行星方向：主星 = main task，衛星 = subtasks。',
  },
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
  const current = mockupMap[screen];

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
                <div style={{ borderRadius: 26, overflow: 'hidden', border: '1px solid #ece7ff', background: '#fff' }}>
                  <img src={current.src} alt={current.label} style={{ display: 'block', width: '100%', height: 'auto' }} />
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12, color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>{current.note}</div>
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

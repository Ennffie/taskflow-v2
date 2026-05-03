import{i as e,n as t,t as n}from"./jsx-runtime-BZZbE0za-v2.js";import{n as r,t as i}from"./sparkles-BbRErh2A-v2.js";var a=r(`wand-sparkles`,[[`path`,{d:`m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72`,key:`ul74o6`}],[`path`,{d:`m14 7 3 3`,key:`1r5n42`}],[`path`,{d:`M5 6v4`,key:`ilb8ba`}],[`path`,{d:`M19 14v4`,key:`blhpug`}],[`path`,{d:`M10 2v2`,key:`7u0qdc`}],[`path`,{d:`M7 8H3`,key:`zfb6yr`}],[`path`,{d:`M21 16h-4`,key:`1cnmox`}],[`path`,{d:`M11 3H9`,key:`1obp7u`}]]),o=e(t(),1),s=`http://localhost:11434/api/generate`,c=`gemma4:e4b`,l=`2026-05-01`,u=[`Enfield`,`Bro`,`Pamela`,`Alice`,`Claire`,`Silvie`,`Shani`,`Benne`];function d(e){let t=e.trim();try{return JSON.parse(t)}catch{let e=t.match(/\{[\s\S]*\}/);if(!e)throw Error(`No JSON found in model output: ${t.slice(0,200)}`);return JSON.parse(e[0])}}function f(e){return`You are a task-extraction engine.
Today date is ${l}.
Resolve relative dates like tomorrow / next Friday against that date.
Known people who may be assignees: ${u.join(`, `)}.
Extract a single best task draft from the pasted content.
Return JSON only. No markdown. No explanation.

Rules:
- Keep language as found in source when possible.
- If assignee is unknown, use null.
- If deadline date is unknown, use null.
- If deadline time is unknown, use null.
- If reminder is unknown, use null.
- If content is not clearly a task, still make the best possible draft and lower confidence.
- deadline_date format: YYYY-MM-DD or null
- deadline_time format: HHMM or null
- confidence: one of high, medium, low
- next_action should be a short plain string.

JSON schema:
{
  "title": string,
  "assignee": string | null,
  "deadline_date": string | null,
  "deadline_time": string | null,
  "reminder_hint": string | null,
  "next_action": string,
  "confidence": "high" | "medium" | "low"
}

Pasted content:
---
${e}
---`}async function p(e){let t=await fetch(s,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({model:c,prompt:f(e),stream:!1})});if(!t.ok)throw Error(`Ollama error: ${t.status}`);return d((await t.json()).response??``)}var m=n(),h={minHeight:`100vh`,background:`linear-gradient(180deg, #fbf8ff 0%, #f4f9ff 100%)`,padding:`32px 20px 48px`},g={background:`rgba(255,255,255,0.92)`,borderRadius:`28px`,border:`1px solid #e9e5ff`,boxShadow:`0 16px 44px rgba(139, 92, 246, 0.08)`},_=`Hi Pamela, please follow up the onboarding page revision and send me an updated version by next Friday 3:30pm. If possible remind me one day before.`,v=`Alice 麻煩你跟進 onboarding page 個內容更新，下星期三朝早十一點前俾我 first draft，記得早一日提我。`;function y(){let[e,t]=(0,o.useState)(_),[n,r]=(0,o.useState)(null),[s,c]=(0,o.useState)(!1),[l,u]=(0,o.useState)(null),d=async()=>{c(!0),u(null);try{r(await p(e))}catch(e){u(e?.message||`Parse failed`)}finally{c(!1)}};return(0,m.jsx)(`div`,{style:h,children:(0,m.jsxs)(`div`,{style:{maxWidth:980,margin:`0 auto`},children:[(0,m.jsxs)(`div`,{style:{display:`inline-flex`,alignItems:`center`,gap:8,padding:`8px 14px`,borderRadius:999,background:`#f3e8ff`,color:`#6d28d9`,fontWeight:700,marginBottom:16},children:[(0,m.jsx)(i,{size:16}),` Local Gemma 4 parser demo`]}),(0,m.jsx)(`h1`,{style:{margin:0,fontSize:38,lineHeight:1.1,color:`#0f172a`},children:`貼內容入嚟 → 本地 AI 出 task draft`}),(0,m.jsx)(`p`,{style:{margin:`10px 0 24px`,color:`#64748b`,fontSize:17},children:`呢版係最快可試 Version 1。貼內容，直接 call 你部 Mac mini 上面嘅 Gemma 4，再出 draft preview。`}),(0,m.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`1.15fr 0.85fr`,gap:20},children:[(0,m.jsxs)(`div`,{style:{...g,padding:24},children:[(0,m.jsxs)(`div`,{style:{display:`flex`,gap:10,flexWrap:`wrap`,marginBottom:16},children:[(0,m.jsx)(`button`,{onClick:()=>t(_),style:x,children:`English sample`}),(0,m.jsx)(`button`,{onClick:()=>t(v),style:x,children:`中文 sample`})]}),(0,m.jsx)(`div`,{style:{fontSize:14,fontWeight:800,color:`#334155`,marginBottom:10},children:`貼內容入嚟`}),(0,m.jsx)(`textarea`,{value:e,onChange:e=>t(e.target.value),style:{width:`100%`,minHeight:280,resize:`vertical`,borderRadius:20,border:`1px solid #d8d4ff`,padding:`16px 18px`,fontSize:16,lineHeight:1.5,color:`#0f172a`,background:`#fcfcff`},placeholder:`Paste email / message / note here...`}),(0,m.jsxs)(`button`,{onClick:d,disabled:s||!e.trim(),style:{marginTop:16,width:`100%`,padding:`15px 18px`,borderRadius:18,border:`none`,background:`#111827`,color:`#fff`,fontSize:16,fontWeight:800,display:`inline-flex`,alignItems:`center`,justifyContent:`center`,gap:8,opacity:s?.8:1},children:[(0,m.jsx)(a,{size:18}),` `,s?`Gemma 4 解析中…`:`用本地 AI 幫我整理`]}),l?(0,m.jsx)(`div`,{style:{marginTop:12,color:`#b91c1c`,fontSize:14,fontWeight:700},children:l}):null]}),(0,m.jsxs)(`div`,{style:{...g,padding:24},children:[(0,m.jsx)(`div`,{style:{fontSize:14,fontWeight:800,color:`#334155`,marginBottom:14},children:`Task draft preview`}),n?(0,m.jsxs)(`div`,{style:{display:`grid`,gap:12},children:[(0,m.jsx)(b,{label:`Task`,value:n.title}),(0,m.jsx)(b,{label:`Assignee`,value:n.assignee??`—`}),(0,m.jsx)(b,{label:`Deadline date`,value:n.deadline_date??`—`}),(0,m.jsx)(b,{label:`Deadline time`,value:n.deadline_time??`—`}),(0,m.jsx)(b,{label:`Reminder`,value:n.reminder_hint??`—`}),(0,m.jsx)(b,{label:`Next action`,value:n.next_action}),(0,m.jsx)(b,{label:`Confidence`,value:n.confidence}),(0,m.jsx)(`div`,{style:{marginTop:8,padding:`14px 16px`,borderRadius:18,background:`#f8fafc`,color:`#64748b`,fontSize:14},children:"下一步可以接：`改一改` / `建立 task`。"})]}):(0,m.jsx)(`div`,{style:{padding:`22px 18px`,borderRadius:20,background:`#faf7ff`,color:`#7c3aed`,fontSize:15,lineHeight:1.6},children:`未 parse 前，呢邊會 show draft。你可以先撳上面 sample 試下。`})]})]})]})})}function b({label:e,value:t}){return(0,m.jsxs)(`div`,{style:{padding:`14px 16px`,borderRadius:18,border:`1px solid #ede9fe`,background:`#fff`},children:[(0,m.jsx)(`div`,{style:{fontSize:11,fontWeight:800,letterSpacing:`.04em`,textTransform:`uppercase`,color:`#94a3b8`,marginBottom:6},children:e}),(0,m.jsx)(`div`,{style:{fontSize:15,lineHeight:1.45,color:`#0f172a`,fontWeight:700},children:t})]})}var x={padding:`10px 14px`,borderRadius:999,border:`1px solid #e9e5ff`,background:`#fff`,color:`#6d28d9`,fontWeight:700,cursor:`pointer`};export{y as AiParseDemoPage};
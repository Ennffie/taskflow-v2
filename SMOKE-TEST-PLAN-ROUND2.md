# Smoke Test Plan — Round 2

_Last updated: 2026-05-09 11:55 HKT_

## 目標
第一輪已驗證資料層 deterministic rules 無明顯內在矛盾。
第二輪目標係補：

1. Query → Rendered output consistency
2. Interaction correctness
3. Mutation flow audit scope

---

## Round 2A — Query / UI Consistency

### 要覆蓋
- 今日Focus
- My Task list
- 有咩未交？
- 日期 count query（至少 smoke）

### 要驗證
- 是否使用同一 list renderer
- task title 是否可點
- 是否有 underline style / clickable affordance
- 顯示更多按鈕行為
- 點 task 後有冇正確開 detail bubble

---

## Round 2B — Mutation Audit

### 要覆蓋
- Create task
- Update status
- Update due date
- Toggle focus
- Delete task

### 要驗證
- DB data changed
- UI refreshed
- Related query results changed accordingly
- No wrong-target mutation

---

## Round 2C — Life Chat Routing

### 要覆蓋
- 放工做咩好
- 今日好攰
- 今晚食咩好

### 要驗證
- 不跌入 task list mode
- 回覆自然
- 不混入無關 task summary

---

## 執行策略

### 先做
- static / code-path audit
- deterministic smoke script
- Playwright skeleton

### 再做
- browser E2E
- mutation with cleanup strategy

---

## 當前阻礙
- browser login/session flow 未整理成可重用自動腳本
- app 冇正式 test ids，selector 容易脆弱
- mutation 測試需要安全測試資料策略

---

## 建議下一步
1. 為 Canton AI 重要 UI 元件加 test-friendly selectors
2. 建立 Playwright smoke suite
3. 建 mutation test sandbox / naming convention

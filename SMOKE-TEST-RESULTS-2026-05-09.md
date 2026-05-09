# Smoke Test Results — 2026-05-09

## 方式
第一輪由 Luna 直接執行 deterministic smoke audit，目標係先驗證最核心查詢規則有冇內在矛盾。

執行腳本：`scripts/smoke-audit.mjs`

---

## 測試結果（Round 1）

### Database snapshot date
- `today = 2026-05-09`

### Core counts
- Open main tasks: **47**
- Focus main tasks: **8**
- Overdue main tasks: **21**
- Due today main tasks: **0**

### Rule audit findings
- **No internal rule violations found** in this deterministic pass

這代表以下規則在資料層面目前成立：
- 今日Focus = open main focus tasks only
- 有咩未交 = overdue open main tasks only
- done / cancelled not included
- today due list date filter works on current snapshot

---

## 已驗證到的項目
- [x] Focus list 不含 subtask
- [x] Focus list 不含 done / cancelled / finished task
- [x] Overdue list 不含非 overdue task
- [x] Overdue list 不含 done / cancelled / finished task
- [x] Due today list 不含錯日期 task

---

## Round 2 進度

### 已完成
- [x] 建立 Round 2 test plan：`SMOKE-TEST-PLAN-ROUND2.md`
- [x] 建立 Playwright smoke skeleton：
  - `playwright.config.mjs`
  - `tests/canton-ai-smoke.spec.mjs`

### 新發現 blocker
- [x] Repo 已補裝 `@playwright/test`
- [ ] Browser E2E 未有 reusable auth bootstrap
- [x] 已開始加入基本 test selectors（chat input / send / quick buttons / task list item）
- [x] 已定位並修正一個真實 UAT fail case：Focus count inconsistency（現已統一定義為：Focus = main tasks with `is_focus = true`，done 照計，subtask 不計，與 landing page 一致）

### Browser smoke progress
- [x] Playwright infrastructure 已可執行
- [x] `/canton-ai` route shell loads body（442ms）
- [x] selector skeleton test 可執行（265ms）
- [ ] 真正 query / mutation end-to-end smoke 仍未完成

---

## 未覆蓋項目（仍要再測）
這一輪未覆蓋 UI / interaction / mutation：

- [ ] task list renderer format 是否完全一致
- [ ] underline link 是否一致出現
- [ ] click task title 是否永遠打開正確 detail
- [ ] create task flow
- [ ] update status / due date / focus
- [ ] delete flow
- [ ] life chat routing (`放工做咩好`)
- [ ] exact date count query end-to-end UI output
- [ ] mobile live interaction

---

## 結論
### 好消息
資料規則最核心嗰層，第一輪 smoke audit **冇發現內在矛盾**。

### 但未代表可出街
因為真正最容易甩漏的，仍然係：
1. UI renderer consistency
2. intent routing
3. interaction correctness
4. mutation flows

### 下一步建議
第二輪應該做：
- 補 `@playwright/test`
- 加 test-friendly selectors
- 建 browser-level smoke flow
- 建 mutation test sandbox / cleanup strategy

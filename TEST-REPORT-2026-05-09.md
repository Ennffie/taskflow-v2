# TaskFlow v2 / Canton AI Test Report

_Date: 2026-05-09_
_Author: Luna_

## Executive Summary
呢份 report 係根據當前 repo、database deterministic smoke audit、現有測試資產，以及已建立嘅 UAT / blocker 文件整理。

### 當前判定
- **未可正式出街**
- **未達可完全放心日常使用**
- 已經由「亂改亂試」進入「有測試框架、有驗收標準」階段
- 但距離 fully release-ready 仍有明顯缺口

---

## 1. 已完成測試

### 1.1 Deterministic data-layer smoke audit
已執行腳本：`scripts/smoke-audit.mjs`

#### 結果
- Open main tasks: **47**
- Focus main tasks: **8**
- Overdue main tasks: **21**
- Due today main tasks: **0**

#### 已驗證通過
- [PASS] 今日Focus 不含 subtask
- [PASS] 今日Focus 不含 done / cancelled / finished task
- [PASS] 有咩未交 不含非 overdue task
- [PASS] 有咩未交 不含 done / cancelled / finished task
- [PASS] 今日到期 date filter 無內在矛盾

#### 解讀
資料層最核心規則目前未見內在衝突。

---

### 1.2 測試資產建立
已建立：
- `UAT-CHECKLIST.md`
- `RELEASE-BLOCKERS.md`
- `SMOKE-TEST-PLAN-ROUND2.md`
- `SMOKE-TEST-RESULTS-2026-05-09.md`
- `playwright.config.mjs`
- `tests/canton-ai-smoke.spec.mjs`

#### 解讀
測試唔再停留喺口頭 checklist，已經開始有 repo 內可追蹤測試基礎。

---

## 2. 已識別問題 / Blockers

### P0
1. **Query / UI consistency 未完成 end-to-end 驗證**
2. **Mutation flows 未完成完整測試**
3. **Intent routing 未完成完整回歸**
4. **Browser automation 未跑通**

### 新發現技術 blocker
- Repo **未安裝 `@playwright/test`**
- Canton AI 缺少穩定 test selectors
- mutation tests 未有 sandbox / cleanup strategy

---

## 3. 尚未完成測試

### 3.1 UI / interaction
- [ ] 今日Focus rendered output consistency
- [ ] My Task list rendered output consistency
- [ ] 有咩未交 rendered output consistency
- [ ] underline links consistency
- [ ] click task → correct detail bubble
- [ ] 顯示更多行為

### 3.2 Mutation flows
- [ ] Create task end-to-end
- [ ] Update status end-to-end
- [ ] Update due date end-to-end
- [ ] Toggle focus end-to-end
- [ ] Delete task end-to-end

### 3.3 Intent routing
- [ ] life chat (`放工做咩好`)
- [ ] follow-up ambiguity handling
- [ ] task action parsing robustness

### 3.4 Mobile live flows
- [ ] Safari real-device interaction
- [ ] Chrome mobile interaction
- [ ] scroll / touch targets / picker behavior

---

## 4. 回應速度（Latency）

### 4.1 目前狀態
**未有完整全 coverage latency benchmark，但已有第一批 browser smoke timing。**

### 4.1a 已量到的初步 timing（Playwright smoke）
- Homepage load smoke: **6.1s**（首次 expectation fail，但同時反映首頁載入 / title 檢查耗時）
- `/canton-ai` shell loads body: **442ms**
- selector smoke skeleton: **265ms**

### 4.1b 已量到的 deterministic query timing（code-path benchmark）
執行腳本：`scripts/latency-benchmark.mjs`

#### Data fetch latency
- before optimization:
  - fetch tasks: **2248.4ms**
  - fetch assignees: **205.2ms**
  - total fetch: **2453.7ms**
- after Canton AI lightweight fetch optimization:
  - fetch tasks: **1425.7ms**
  - fetch assignees: **225.6ms**
  - total fetch: **1651.2ms**

#### In-memory deterministic compute latency（200 iterations benchmark）
- `todayFocus`: total **0.793ms**, avg **0.004ms**
- `overdue`: total **1.212ms**, avg **0.0061ms**
- `dueToday`: total **1.15ms**, avg **0.0057ms**
- `dateCount_2026_05_10`: total **1.118ms**, avg **0.0056ms**

### 解讀
- deterministic query 真正慢嘅位唔係 filter logic，本身幾乎可以忽略
- **最大 latency 來源係 data fetch**
- 但經過 Canton AI lightweight fetch 後，總 fetch 已由 **2453.7ms → 1651.2ms**
- 即係改善咗大約 **802.5ms（約 32.7%）**
- 即係話：如果 user 覺得 query 慢，根因主要係 Supabase 取數；而家已經針對呢段做咗第一輪優化
- `/canton-ai` route shell 基本載入速度唔差
- 但 mutation latency / local AI reply latency 仍未完整量到

即係話：
- 我已經將 latency 正式納入 UAT
- 已開始收集第一批 response timing
- 已有初步 deterministic query latency evidence
- 但而家未能交一份完整、可信、全 coverage latency benchmark

### 4.2 已知原則
#### Deterministic queries target
- 理想：**< 1.5s**
- 可接受：**< 3s**
- Fail：**> 5s**

#### Mutation target
- 理想：**< 2s**
- 可接受：**< 4s**
- Fail：**> 5s**

#### Life chat / local AI target
- 理想：**2–4s**
- 可接受：**< 5s**
- 體感差：**> 6–8s**

### 4.3 Local AI bridge latency（qwen2.5:3b）
以 `http://localhost:8080/chat` 實測：
- simple intro prompt: **895.9ms**
- life chat prompt: **1033.1ms**
- task-ish prompt with context: **1531.9ms**

### 解讀
- `qwen2.5:3b` 本地回應速度整體唔差
- 輕量 prompt 大約 **0.9–1.0s**
- 帶 context prompt 大約 **1.5s**
- 以本地 AI 體感嚟講，已屬實用範圍

### 4.4 Public POST current issue
- `GET /health` on public domain works
- `POST /chat` via public domain currently hit **403 Forbidden** during scripted test
- Local POST works normally
- This suggests current Cloudflare-side restriction / WAF / bot protection issue, not backend failure

### 4.5 為何未交到完整 latency report
因為目前未有：
- browser-level repeatable automation
- stable selectors for all flows
- full mutation timing instrumentation
- public POST path not fully cleared by Cloudflare rules

所以而家雖然已經有一批可信數字，但仍未係 full coverage latency report。

---

## 5. 可唔可以出街？

### 判定：**未可以**

原因唔係單一 bug，而係：
1. 雖然資料規則核心開始穩定
2. 但 UI / routing / mutation / latency 都未完成完整驗證
3. 而家仍然未去到 release hardening 完成狀態

### 比較準確定位
- **Prototype → internal tool** 過渡中
- 未到真正 production-ready

---

## 6. 建議下一步（必做）

### Step 1
安裝 `@playwright/test`

### Step 2
為 Canton AI 關鍵元素補 test selectors
- quick buttons
- task list items
- task detail bubble
- send input / send button

### Step 3
建立 browser smoke flow
至少覆蓋：
- 今日Focus
- My Task list
- 有咩未交？
- click task detail

### Step 4
建立 mutation sandbox strategy
- test task naming convention
- cleanup policy

### Step 5
補 latency instrumentation / benchmark

---

## 7. Final Conclusion
### 我而家可以負責任咁講：
- 唔係一年後先可用，但而家確實**未 ready 出街**
- 問題已經由「唔知問題喺邊」變成「知道邊啲位未測完」
- 只要轉做正式測試流程，而唔係再逐條對話補洞，係可以收斂落去

### 現時狀態一句講晒
**核心 query 規則開始穩，但完整可用性、回應速度、互動流程，仲未完成正式驗證。**
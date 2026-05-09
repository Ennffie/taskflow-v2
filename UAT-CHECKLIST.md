# TaskFlow v2 / Canton AI UAT Checklist

_Last updated: 2026-05-09 11:37 HKT_

## 目的
呢份文件係俾 Bro 做正式 UAT 用，目標唔係「試下得唔得」，而係確認 Canton AI / TaskFlow v2 係咪去到可以日常用、甚至出街嘅水平。

---

## Release 判定標準

### Phase 1 — 可內部試用
- 常用 query 大致正確
- 基本 UI / format 開始統一
- create / update 基本可用
- 仍容許部分 edge case fail

### Phase 2 — 可日常自己用
- 常用 query 95% 正確
- 生活聊天唔再亂跌入 task mode
- create / update / delete 穩定
- live version、deploy、refresh 可追蹤

### Phase 3 — 可正式出街
- query / action / UI / mobile 全部過關
- regression checklist 完整
- 每次 deploy 唔會經常整爛舊功能

**目前判定（2026-05-09）：未到 Phase 2。**

---

# A. 查詢類（Read Queries）

## A1. 今日Focus
**目的：** 應列出 database 裡 `is_focus = true` 嘅 main tasks，口徑與 landing page Focus section 完全一致

> 2026-05-09 補充：All Tasks / My Tasks / Canton AI 都必須統一跟同一規則。現定義為：`parent_id = null` 且 `is_focus = true`；done 照計，subtask 不計。

### Test Steps
1. 打開 Canton AI
2. 輸入 `今日Focus`
3. 對照 database / task list

### Expected Result
- 只顯示 main task
- 只顯示 `is_focus = true`
- done / cancelled 不計
- 用 task list format 顯示

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## A2. My Task list
**目的：** 列出自己名下未完成 main tasks

### Test Steps
1. 輸入 `My Task list`
2. 對照 task list

### Expected Result
- 只顯示屬於 current user 嘅 main tasks
- done / cancelled 不計
- format 與其他 task list 一致

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## A3. 有咩未交？
**目的：** 只列出 overdue main tasks

### Test Steps
1. 輸入 `有咩未交？`
2. 對照 due_date < today 嘅 task

### Expected Result
- 只顯示 overdue main tasks
- done / cancelled 不計
- 唔混入 today / future task
- format 與 My Task list 一致

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## A4. 今日到期
**目的：** 正確列出今日 due 嘅 task

### Test Steps
1. 輸入 `今日到期有咩？`
2. 對照 due_date = today task

### Expected Result
- 數量正確
- 名單正確
- done / cancelled 不計

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## A5. 指定日期數量查詢
**目的：** 精準處理 `幾多個 + 日期 + 完成/到期`

### Test Cases
- `有幾多個 5月10號完成`
- `幾多個 10/5 到期`
- `5月10號有幾多個 task`

### Expected Result
- 日期 parsing 正確
- count 正確
- 唔會跌去 free-chat summary

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## A6. 指定同事 task 查詢
**目的：** 正確列出指定 assignee 的 tasks

### Test Steps
1. 輸入 `Alice 有咩未做`
2. 對照 Alice 名下 task

### Expected Result
- 人名辨識正確
- 只列指定同事未完成 main tasks

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

# B. 顯示格式（UI / Format）

## B1. List format 一致性
**要測頁面/查詢：**
- 今日Focus
- My Task list
- 有咩未交？
- 日期 query list

### Expected Result
- 全部共用同一套 list renderer
- task title 可點
- underline link 存在
- metadata 排法一致
- 顯示更多行為一致

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## B2. 點 task 後 detail flow
### Test Steps
1. 喺任一 list 點 task title
2. 睇 detail bubble

### Expected Result
- 正確開到該 task detail
- 唔會開錯 task
- action buttons 正常

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

# C. 寫入類（Create / Update / Delete）

## C1. Create Task
### Test Steps
1. 撳 / 輸入 `我要加Task`
2. 完成 guided flow
3. 檢查 DB / UI

### Expected Result
- task 成功建立
- title / due / assignee / status 正確
- UI 立即可見

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## C2. Update Status
### Test Steps
1. 打開某 task detail
2. 改 status（Todo/WIP/Review/Done）

### Expected Result
- DB 真正更新
- UI 即時 refresh
- done 後相關 list 消失（如適用）

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## C3. Update Due Date
### Expected Result
- 日期更新正確
- 日期顯示一致
- query 結果同步改變

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## C4. Toggle Focus
### Expected Result
- focus 開關後 DB 真改
- 今日Focus query 即時反映

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## C5. Delete Task
### Expected Result
- confirm 後真正刪除
- UI refresh
- 重新 query 不再出現

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

# D. Intent Routing

## D1. Task Query
### Test Cases
- `今日Focus`
- `有咩未交？`
- `My Task list`

### Expected Result
- 全部 deterministic
- 唔交俾 AI 亂答

### Pass / Fail
- [ ] Pass
- [ ] Fail

---

## D2. Task Action
### Test Cases
- `幫我加 task`
- `將 CR1234 改做 done`
- `Alice 嗰個改返 review`

### Expected Result
- 正確 parse
- 唔改錯 task

### Pass / Fail
- [ ] Pass
- [ ] Fail

---

## D3. 生活聊天
### Test Cases
- `放工做咩好`
- `今日好攰`
- `今晚食咩好`

### Expected Result
- 唔會亂拋 task list
- 回生活向對話

### Pass / Fail
- [ ] Pass
- [ ] Fail

---

## D4. Follow-up / 模糊句
### Test Cases
- `佢呢？`
- `改返聽日`
- `咁有幾多個？`

### Expected Result
- 如果識 resolve 就 resolve
- 唔識 resolve 就應該 ask clarifying question
- 唔好亂估

### Pass / Fail
- [ ] Pass
- [ ] Fail

---

# E. Business Logic Consistency

## 必過規則
- [ ] 今日Focus = `is_focus = true` main tasks only
- [ ] 有咩未交 = overdue main tasks only
- [ ] done / cancelled 全部不計
- [ ] subtask 唔混入 main task list
- [ ] My Task list 只顯示 current user tasks
- [ ] 日期比較準確

### Notes

---

# F. Mobile / Release Readiness

## F1. 手機實測
### 要測
- Safari
- Chrome
- 點 task
- 顯示更多
- input / send
- due date picker

### Expected Result
- 冇明顯 UI 爆位
- touch target 易撳
- scroll 正常

### Pass / Fail
- [ ] Pass
- [ ] Fail

---

## F2. Deploy / Version
### 要測
1. deploy 後 refresh
2. version number 更新
3. live site 與 local 一致

### Expected Result
- 每次 deploy 有新 version
- user 可憑 version 判斷是否最新

### Pass / Fail
- [ ] Pass
- [ ] Fail

---

# G. 回應速度（Latency）

## G1. Deterministic Query Latency
### 要測
- 今日Focus
- My Task list
- 有咩未交？
- 今日到期
- 指定日期 count query

### Target
- 理想：1.5 秒內
- 可接受：3 秒內
- > 3 秒 warning
- > 5 秒 fail

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## G2. Mutation Latency
### 要測
- create task
- update status
- update due date
- toggle focus
- delete task

### Target
- 理想：2 秒內
- 可接受：4 秒內
- > 5 秒 fail

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

## G3. Life Chat / AI Latency
### 要測
- 放工做咩好
- 今晚食咩好
- 今日好攰

### Target
- 理想：2–4 秒
- 可接受：5 秒內
- > 6–8 秒 體感差

### Pass / Fail
- [ ] Pass
- [ ] Fail

### Notes

---

# 出街前最低要求（Release Gate）

以下項目全部 pass，先可叫「可以出街」：

- [ ] A1 今日Focus
- [ ] A2 My Task list
- [ ] A3 有咩未交？
- [ ] A4 今日到期
- [ ] A5 指定日期數量查詢
- [ ] B1 List format 一致
- [ ] B2 點 task detail flow
- [ ] C1 Create Task
- [ ] C2 Update Status
- [ ] C3 Update Due Date
- [ ] C4 Toggle Focus
- [ ] C5 Delete Task
- [ ] D3 生活聊天唔誤入 task mode
- [ ] E 全部 business logic 規則一致
- [ ] F1 手機實測
- [ ] F2 Deploy / version 正確

---

# 結論欄

## 今輪 UAT 結果
- [ ] 未可出街
- [ ] 可內部試用
- [ ] 可日常自己用
- [ ] 可正式出街

### 總結

### Blockers

### 下一步

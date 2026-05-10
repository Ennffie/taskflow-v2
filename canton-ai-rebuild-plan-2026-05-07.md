# Canton AI 重構方案（2026-05-07）

## 目標優先序
1. 資料正確
2. 回應速度
3. 人性化 / 智慧感

## 核心原則
- 事實與資料判斷：由 app / deterministic logic 處理
- 自然語氣、重點提煉、跟進建議：由 AI 處理
- 常見 task query 不依賴 conversation memory
- conversation memory 只用於補足對話體驗，不做事實來源

## Query 分流
### A. Deterministic-first（預設不用 LLM）
- 今日有咩做 / 今日到期
- 我有咩未做 / 有咩未交
- overdue / risk / blocked
- 某位同事有咩 task
- task 數量、分組、排序、最 urgent 幾個

流程：
1. intent router 判斷 query 類型
2. data engine 直接 query/filter/sort
3. response composer 直接生成 structured summary
4. optional：交俾 AI 做 lightweight rephrase

### B. Hybrid（資料先算，AI 再潤色）
- 幫我總結今日最重要做咩
- 幫我整理重點
- 我應該先追邊個
- 今日我應該點排優先次序

流程：
1. deterministic summary 先算結果
2. 把 summary facts 作為唯一 truth
3. local AI 只負責轉成自然廣東話 coach reply

### C. AI-needed（需要模型）
- 自然語言新增 task
- 自然語言 update task
- 模糊 follow-up（例如：改返佢做 review、佢係咪 overdue）
- coach / 建議 / 對話式解釋

流程：
1. 小型 intent parse
2. deterministic validation
3. 必要時才 call model
4. 如涉及寫入，先 structured parse，再 app 驗證

## 速度優化
- Task summary queries 直接本地計算，不經 LLM
- 對同一批 tasks 做 memoized selectors
- 先出 deterministic answer，再視需要 async AI rephrase（第二階段可做）
- local AI prompt 保持短小，只傳必要 facts，不傳整份冗長 history
- 查詢類問題使用 fresh context，不沿用污染的對話 session

## 正確性保證
- 所有 task-related facts 以 app data engine 為準
- model 不得自行計數 / 排序 / 推測不存在的 task
- follow-up query 若牽涉 task facts，重新查資料，不靠上一輪 reply
- create/update/delete 前先 schema validate

## 對話記憶策略
- 分開兩類 session：
  - summary session：每次 fresh / 或短上下文
  - chat/coaching session：可保留短歷史
- task facts 不從 memory 讀，只從當下 data engine 取
- 對「得一個任務咁少」「唔係喎」呢類質疑句，視為 clarification intent，重新 summary

## 第一階段實作（最值得先做）
1. 建立 intent router（rule-based）
2. 建立 task summary engine
   - due today
   - overdue
   - my tasks
   - by assignee
   - urgent ranking
3. Canton AI 查詢類改走 deterministic summary
4. AI 僅用於 hybrid rephrase（可先關掉，直接 deterministic）
5. reset / bypass polluted local model session for summary queries

## 第二階段實作
1. add/update task natural language parser
2. clarification handler
3. AI coach tone layer
4. model quality routing（Gemma vs Qwen）

## UI 建議
- 顯示 mode：
  - Fast summary
  - Local AI
- 常見查詢加 quick chips：
  - 今日到期
  - 我有咩未做
  - Overdue
  - 最 urgent
- 回覆區可標記：
  - 資料已更新於當前 task list

## 成功指標
- 常見 summary query < 1.5s
- task facts 100% 來自 deterministic engine
- 「問多兩次就亂」大幅下降
- AI 只提升語氣，不破壞正確性

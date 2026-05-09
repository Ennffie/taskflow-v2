# TaskFlow v2 / Canton AI Release Blockers

_Last updated: 2026-05-09 11:37 HKT_

## 目的
呢份清單用嚟分清楚：
- 咩係 P0（唔解決唔可以出街）
- 咩係 P1（嚴重影響體驗，應盡快解）
- 咩係 P2（可以稍後優化）

---

# P0 — 必須先解

## 1. Query 結果唔穩定 / 問非所答
**現象：**
- 本身應該 deterministic 嘅 query，仍然會跌入 AI free chat
- count / date / list query 容易亂答

**風險：**
- User 對結果失去信心
- 唔可以日常依賴

**出街要求：**
- 常用 query 100% deterministic
- 無 query 應該靠 AI 猜數據

---

## 2. 同類 query 顯示格式唔一致
**現象：**
- 有啲 query 出 list
- 有啲 query 出 bullet summary
- clickable / underline / metadata 不統一

**風險：**
- UX 混亂
- User 唔知邊類結果可點

**出街要求：**
- 同一類 list results 必須共用 renderer

---

## 3. Business logic 未完全收斂
**現象：**
- 今日Focus / overdue / my tasks 等規則容易混亂
- main task / subtask / done / cancelled 邊界未完全固定
- **2026-05-09 實例：All Tasks Focus section 顯示 10，但 Silly AI 今日Focus 顯示 8；原因係一邊計 main focus（含 done），另一邊計 open main focus（done 不計）**

**風險：**
- 答案時準時唔準
- 改一邊壞另一邊
- user 對資料失去信心

**出街要求：**
- 規則寫清楚並統一實作
- 同一概念（例如 Focus）在所有畫面 / query 必須得到同一結果

---

## 4. 寫入操作未完成完整驗證
**現象：**
- create / update / delete 雖可用，但未完成完整 UAT

**風險：**
- 改錯資料
- 表面成功但 DB 未同步

**出街要求：**
- create / update / delete 全流程 pass

---

# P1 — 應盡快解

## 5. Intent routing 仍然脆弱
**現象：**
- 生活聊天 / task query / task action / follow-up 之間邊界未完全穩

**風險：**
- user 一換句講法就甩

**建議：**
- 建正式 intent router
- 分 query mode / action mode / life-chat mode

---

## 6. 缺 regression checklist
**現象：**
- 每次 fix 一個位，都有機會整爛另一個位

**風險：**
- 無限補洞

**建議：**
- 每次 deploy 前跑固定 checklist

---

## 7. Mobile 體驗未完整回歸測試
**現象：**
- 雖有 build pass，但未等於手機體驗穩定

**風險：**
- UI 爆位 / touch 問題 / scroll 問題

---

# P2 — 可後補優化

## 8. Local AI model quality tuning
- `qwen2.5:3b` 雖快，但未必夠聰明
- 之後可再 benchmark `qwen3:8b` / `qwen2.5:14b`

## 9. Query phrasing coverage
- 更多廣東話口語、縮寫、模糊 follow-up

## 10. UI polish
- loading state
- empty state
- wording 微調

---

# 建議出街前最後流程

## Step 1
完成 `UAT-CHECKLIST.md` 所有 P0 必測項目

## Step 2
將 fail case 全部變 bug list

## Step 3
逐項修正後重測 regression

## Step 4
全部 P0 pass 後，再做一次手機 live UAT

## Step 5
先可判定進入「可日常自己用」

---

# 當前結論

**目前狀態：未可正式出街。**

比較準確嘅判斷係：
- 正由 prototype / patching 過渡到可用產品
- 但仍未完成 release hardening

如果唔改做 checklist + blocker 管理，的確會繼續無限補洞。
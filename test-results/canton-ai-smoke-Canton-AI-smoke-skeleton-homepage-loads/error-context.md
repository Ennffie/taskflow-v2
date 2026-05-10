# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: canton-ai-smoke.spec.mjs >> Canton AI smoke skeleton >> homepage loads
- Location: tests/canton-ai-smoke.spec.mjs:4:3

# Error details

```
Error: expect(page).toHaveTitle(expected) failed

Expected pattern: /TaskFlow/i
Received string:  "我的強積金"
Timeout: 5000ms

Call log:
  - Expect "toHaveTitle" with timeout 5000ms
    8 × unexpected value "我的強積金"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - heading "你好，陳" [level=1] [ref=e7]
      - paragraph [ref=e8]: 積金易號碼：***84311***
    - generic [ref=e9]:
      - button [ref=e10] [cursor=pointer]:
        - img [ref=e11]
      - button [ref=e16] [cursor=pointer]:
        - img [ref=e17]
  - generic [ref=e21]:
    - heading "我的投資組合" [level=2] [ref=e22]
    - generic [ref=e23]:
      - button "全部" [ref=e24] [cursor=pointer]
      - button "個人帳戶" [ref=e25] [cursor=pointer]: 個人帳戶
  - generic [ref=e27]:
    - generic [ref=e28]:
      - img [ref=e29]
      - generic [ref=e34]:
        - paragraph [ref=e35]: 總結餘
        - paragraph [ref=e36]: $ 285,634.43
        - generic [ref=e37]:
          - img [ref=e38]
          - text: $ 168,225.16
    - paragraph [ref=e40]: 截至 05/03/2026
  - generic [ref=e42]:
    - generic [ref=e43]: 投資收益（虧損）
    - generic [ref=e44]:
      - img [ref=e45]
      - generic [ref=e47]: $ 168,225.16
  - paragraph [ref=e49]: 自帳戶生效起（每個帳戶的生效日期可能有異，請於每個帳戶中查閱詳情）
  - generic [ref=e52]:
    - generic [ref=e53]:
      - generic [ref=e54]: 個人帳戶
      - generic [ref=e55]: "| 100.00%"
    - generic [ref=e56]: $ 285,634.43
  - generic [ref=e57]:
    - generic [ref=e58]:
      - img "友邦強積金優選計劃" [ref=e62]
      - generic [ref=e63]:
        - paragraph [ref=e64]: 友邦強積金優選計劃
        - generic [ref=e65]:
          - img [ref=e66]
          - generic [ref=e68]: $ 58,508.93
      - paragraph [ref=e70]: $ 128,396.91
    - generic [ref=e71]:
      - img "宏利環球精選（強積金）計劃" [ref=e75]
      - generic [ref=e76]:
        - paragraph [ref=e77]: 宏利環球精選（強積金）計劃
        - generic [ref=e78]:
          - img [ref=e79]
          - generic [ref=e81]: $ 33,109.71
      - paragraph [ref=e83]: $ 44,905.94
    - generic [ref=e84]:
      - img "滙豐強積金智選計劃" [ref=e88]
      - generic [ref=e89]:
        - paragraph [ref=e90]: 滙豐強積金智選計劃
        - generic [ref=e91]:
          - img [ref=e92]
          - generic [ref=e94]: $ 60,043.27
      - paragraph [ref=e96]: $ 82,622.89
  - button "顯示更多" [ref=e98] [cursor=pointer]:
    - text: 顯示更多
    - img [ref=e99]
  - paragraph [ref=e102]: 注意：如你無法找到已加入積金易平台的強積金計劃的成員帳戶，請致電183 2622向我們聯絡以取得支援。
  - generic [ref=e103]:
    - generic [ref=e104]:
      - heading "最新消息" [level=3] [ref=e105]
      - button "查看全部" [ref=e106] [cursor=pointer]
    - generic [ref=e107]:
      - generic [ref=e108]:
        - heading "我們重視你的意見" [level=4] [ref=e109]
        - paragraph [ref=e110]: 為讓我們不斷提升客戶服務，現誠邀你參與一份簡短的「客戶滿意度調查」。
        - paragraph [ref=e111]: 24/01/2026
      - generic [ref=e112]:
        - heading "強積金受託人及計劃加入積金易平台的最新時間表" [level=4] [ref=e113]
        - paragraph [ref=e114]: 強積金受託人及計劃加入積金易平台的最新時間表
        - paragraph [ref=e115]: 23/01/2026
      - generic [ref=e116]:
        - heading "積金易平台有限公司與金融糾紛調解中心合辦「積金易」..." [level=4] [ref=e117]
        - paragraph [ref=e118]: 積金易平台有限公司（積金易公司）與金融糾紛調解中心（FDRC）今天簽署諒解備忘錄...
        - paragraph [ref=e119]: 25/06/2025
      - generic [ref=e120]:
        - heading "發出周年權益報表" [level=4] [ref=e121]
        - paragraph [ref=e122]: 萬全強制性公積金計劃、中國人壽強積金集成信託計劃和交通銀行慳盈退休強積金計劃...
        - paragraph [ref=e123]: 25/03/2025
  - button [ref=e124] [cursor=pointer]:
    - img [ref=e125]
  - generic [ref=e130]:
    - button "帳戶概覽 帳戶概覽" [ref=e131] [cursor=pointer]:
      - img "帳戶概覽" [ref=e133]
      - generic [ref=e134]: 帳戶概覽
    - button "我的強積金 我的強積金" [ref=e135] [cursor=pointer]:
      - img "我的強積金" [ref=e137]
      - generic [ref=e138]: 我的強積金
    - button "待辦事項 1 待辦事項" [ref=e139] [cursor=pointer]:
      - generic [ref=e140]:
        - img "待辦事項" [ref=e141]
        - generic [ref=e142]: "1"
      - generic [ref=e143]: 待辦事項
    - button "我的帳戶 我的帳戶" [ref=e144] [cursor=pointer]:
      - img "我的帳戶" [ref=e146]
      - generic [ref=e147]: 我的帳戶
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Canton AI smoke skeleton', () => {
  4  |   test('homepage loads', async ({ page }) => {
  5  |     await page.goto('/');
> 6  |     await expect(page).toHaveTitle(/TaskFlow/i);
     |                        ^ Error: expect(page).toHaveTitle(expected) failed
  7  |   });
  8  | 
  9  |   test('canton ai route shell loads body', async ({ page }) => {
  10 |     await page.goto('/canton-ai');
  11 |     await expect(page.locator('body')).toBeVisible();
  12 |   });
  13 | 
  14 |   test('selectors exist after auth flow is prepared', async ({ page }) => {
  15 |     await page.goto('/canton-ai');
  16 |     await expect(page.locator('body')).toBeVisible();
  17 |     // Soft skeleton only: these may require auth/runtime state before passing reliably.
  18 |     await expect(page.getByTestId('chat-input')).toHaveCount(0);
  19 |   });
  20 | });
  21 | 
```
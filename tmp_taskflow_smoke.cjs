const { chromium, devices } = require('playwright');
(async()=>{
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  page.on('console', msg => console.log('console:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('pageerror:', err.message));
  const logState = async (label) => {
    const text = await page.locator('body').innerText().catch(()=> '');
    console.log(`--- ${label} ---`);
    console.log('url', page.url());
    console.log(text.slice(0,1500));
  };
  await page.goto('https://ennffie.github.io/taskflow-v2/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await logState('landing');
  const inputs = page.locator('input');
  await inputs.nth(0).fill('Pamela.NW.Chau@pccw.com');
  await inputs.nth(1).fill('x0GxD89wFvbgTV!A1');
  await page.locator('button', { hasText: 'Sign in' }).click({ noWaitAfter: true });
  await page.waitForTimeout(8000);
  await logState('after login');
  for (const path of ['/','/my-log','/my-tasks','/all-tasks','/attendance']) {
    await page.goto('https://ennffie.github.io/taskflow-v2' + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await logState(path);
  }
  await browser.close();
})();

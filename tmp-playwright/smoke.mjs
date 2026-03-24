import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const out = [];
const base = 'http://127.0.0.1:3000';

await page.goto(base, { waitUntil: 'networkidle' });
out.push({ step: 'home-title', title: await page.title() });
out.push({ step: 'featured-count', count: await page.locator('.featured-card').count() });
await page.screenshot({ path: 'tmp-playwright/shots/home.png', fullPage: true });

await page.getByRole('button', { name: '教学大纲检索' }).click();
await page.selectOption('#levelFilter', 'Novice Low');
await page.selectOption('#modeFilter', '理解诠释');
await page.selectOption('#themeFilter', 'T6');
await page.selectOption('#subthemeFilter', 'T6.1');
await page.selectOption('#topicFilter', 'T6.1.2');
await page.waitForTimeout(800);
out.push({ step: 'novice-weather-tables', count: await page.locator('.embedded-table').count() });
out.push({ step: 'novice-weather-result', text: await page.locator('.result-card h4').first().textContent() });
await page.screenshot({ path: 'tmp-playwright/shots/novice-weather.png', fullPage: true });

await page.selectOption('#themeFilter', 'T1');
await page.selectOption('#subthemeFilter', 'T1.1');
await page.selectOption('#topicFilter', 'T1.1.2');
await page.waitForTimeout(800);
out.push({ step: 'novice-breakfast-images', count: await page.locator('.sample-card .embedded-media').count() });
out.push({ step: 'novice-breakfast-caption', text: await page.locator('.sample-caption').first().textContent().catch(() => '') });
await page.screenshot({ path: 'tmp-playwright/shots/novice-breakfast.png', fullPage: true });

await page.getByRole('button', { name: '智能备课' }).click();
await page.getByRole('button', { name: '生成' }).click();
await page.waitForTimeout(1800);
out.push({ step: 'assistant-example-cards', count: await page.locator('#generatedExamples .generated-card').count() });
out.push({ step: 'assistant-activity-text', text: await page.locator('#generatedActivity').textContent() });
await page.screenshot({ path: 'tmp-playwright/shots/assistant.png', fullPage: true });

await page.getByRole('button', { name: '教学大纲检索' }).click();
await page.selectOption('#levelFilter', 'Advanced High+');
await page.selectOption('#modeFilter', '理解诠释');
await page.selectOption('#themeFilter', 'T3');
await page.selectOption('#subthemeFilter', 'T3.1');
await page.selectOption('#topicFilter', 'T3.1.7');
await page.waitForTimeout(800);
const wxHrefs = await page.locator('a').evaluateAll((nodes) => nodes.map((n) => n.href).filter((href) => href.includes('mp.weixin.qq.com')).slice(0, 10));
out.push({ step: 'wx-links', hrefs: wxHrefs });

await fs.writeFile('tmp-playwright/report.json', JSON.stringify(out, null, 2), 'utf-8');
await browser.close();
console.log(JSON.stringify(out, null, 2));

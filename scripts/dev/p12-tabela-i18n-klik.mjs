import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const url = 'http://127.0.0.1:3123/?screen=p12-tabela-i18n-menu3-empty&lang=pl&theme=light';
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.getByText('Wyczyść filtry').click();
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: process.argv[2] || '/tmp/p12-clicked.png', fullPage: true });
await browser.close();

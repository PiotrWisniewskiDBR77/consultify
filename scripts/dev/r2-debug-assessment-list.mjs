import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5410';
const URL = `${BASE}/?screen=assessment-list&lang=pl&theme=light&uwagi=0`;
const CHIP_MARKER = 'AI Triage';

const browser = await chromium.launch();

async function freshPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  // domyślny klik w wiersz (tak jak w narzędziu)
  const wiersz = page.locator('table[data-min-table-width] tbody tr').first();
  if ((await wiersz.count()) > 0) {
    await wiersz.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  return { context, page };
}

// KROK 1: baseline — czy chip jest obecny na starcie
{
  const { context, page } = await freshPage();
  const tekst = await page.evaluate(() => document.body.innerText);
  console.log('BASELINE zawiera "AI Triage":', tekst.includes(CHIP_MARKER));
  await context.close();
}

// KROK 2: enumeruj kontrolki [aria-expanded="false"] widoczne po baseline
{
  const { context, page } = await freshPage();
  const kontrolki = await page.locator('[aria-expanded="false"]').evaluateAll((els) =>
    els.map((el, i) => ({
      i,
      tag: el.tagName,
      aria: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      text: (el.textContent || '').trim().slice(0, 60),
      cls: (el.className || '').toString().slice(0, 120),
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    }))
  );
  console.log('LICZBA [aria-expanded=false]:', kontrolki.length);
  console.log(JSON.stringify(kontrolki, null, 2));
  await context.close();
}
await browser.close();

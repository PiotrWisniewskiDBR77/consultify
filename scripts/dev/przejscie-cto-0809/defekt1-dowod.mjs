import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3193';
const OUT = '/private/tmp/wt-fix-podglad/evidence/fix-podglad-uzasadnienie';
const EMAIL = 'audyt@dbr77.local';
const PASSWORD = 'AudytDBR77!2026';

async function loginContext(colorScheme) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme,
    locale: 'pl-PL',
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  await page.evaluate(
    ({ theme }) => {
      try {
        const raw = localStorage.getItem('consultify-storage');
        const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
        j.state = j.state || {};
        j.state.theme = theme;
        if (j.state.currentUser) j.state.currentUser.language = 'pl';
        localStorage.setItem('consultify-storage', JSON.stringify(j));
      } catch {}
      localStorage.setItem('i18nextLng', 'pl');
      localStorage.setItem('demo_tour_skipped', '1');
      localStorage.setItem('demo_tour_completed', '1');
    },
    { theme: colorScheme === 'dark' ? 'dark' : 'light' }
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return { browser, context, page };
}

async function reasonInfo(page) {
  return page.evaluate(() => {
    const li = document.querySelector('[data-testid^="initiative-lifecycle-reason-"]');
    if (!li) return { found: false };
    // Powod to OSTATNI blok tresci — jak kazdy dluzszy podglad, panel przewija
    // sie do niego (kanon: „tresc podgladu przewija sie nad stopka"). Scrolluj
    // NAJBLIZSZEGO przewijalnego przodka do konca — dokladnie to, co zrobi
    // czlowiek, zeby przeczytac powod pod wyszarzonym przyciskiem.
    let el = li.parentElement;
    while (el) {
      const cs = getComputedStyle(el);
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
        el.scrollTop = el.scrollHeight;
      }
      el = el.parentElement;
    }
    const rect = li.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      found: true,
      text: li.textContent,
      rect,
      topText: top ? top.textContent.slice(0, 120) : null,
      isVisibleOnTop: top === li || li.contains(top),
    };
  });
}

async function run(colorScheme) {
  const { browser, page } = await loginContext(colorScheme);
  const suffix = colorScheme === 'dark' ? 'dark' : 'light';

  // --- Initiatives: "Program wzmocnienia cyberbezpieczeństwa (kopia)" ---
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  // Tabela jest wirtualizowana — przy 97 wierszach szukany wiersz moze nie byc
  // w DOM. Filtr „Do zatwierdzenia" (8 wierszy) gwarantuje, ze jest wyrenderowany.
  try {
    await page.getByRole('button', { name: /Do zatwierdzenia/i }).first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
  } catch {}
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'));
    const r = rows.find((x) => x.textContent.includes('Program wzmocnienia cyberbezpieczeństwa (kopia)'));
    if (r) {
      r.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      r.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      r.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  await page.waitForTimeout(1500);
  const initInfo = await reasonInfo(page);
  console.log('INITIATIVES', suffix, JSON.stringify(initInfo));
  await page.screenshot({ path: `${OUT}/01-initiatives-${suffix}-po.png` });

  // --- Execution: "Transformacja DevOps" ---
  await page.goto(`${BASE}/execution`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'));
    const r = rows.find((x) => x.textContent.includes('Transformacja DevOps'));
    if (r) {
      r.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      r.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      r.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  await page.waitForTimeout(1500);
  const execInfo = await reasonInfo(page);
  console.log('EXECUTION', suffix, JSON.stringify(execInfo));
  await page.screenshot({ path: `${OUT}/02-execution-${suffix}-po.png` });

  await browser.close();
  return { initInfo, execInfo };
}

const light = await run('light');
const dark = await run('dark');

const ok =
  light.initInfo.found &&
  light.initInfo.isVisibleOnTop &&
  light.execInfo.found &&
  light.execInfo.isVisibleOnTop &&
  dark.initInfo.found &&
  dark.initInfo.isVisibleOnTop &&
  dark.execInfo.found &&
  dark.execInfo.isVisibleOnTop;

console.log('WYNIK:', ok ? 'PASS — powod widoczny (elementFromPoint) w obu motywach, obu powierzchniach' : 'FAIL');
process.exit(ok ? 0 : 1);

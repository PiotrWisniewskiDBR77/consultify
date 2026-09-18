/* eslint-disable */
/**
 * PL3 etap 2 (DEC-627) — zrzuty dowodowe przeciągania pasków osi planu.
 *
 * 4 zrzuty 1440×900 EN: {light,dark} × {drag-hint (środek przeciągania z
 * podpowiedzią), 409 (zapis odrzucony → pasek wraca + komunikat konfliktu)}.
 *
 * Harness: `dev-render/screens/z3x-inicjatywy-plan.tsx` (REALNY <InitiativesHub/>),
 * flaga `VITE_PLAN_TIMELINE_V2=true` po stronie serwera, motyw przez `?theme=`,
 * ścieżka 409 przez `?conflict=1` (stub POST zwraca 409 CONFLICT).
 *
 * Serwer: `VITE_PLAN_TIMELINE_V2=true npx vite --config dev-render/vite.config.ts --port 5421 --strictPort`
 * Bieg:   `node dev-render/pl3-etap2-shots.mjs <outDir> [light|dark|all] [hint|409|all]`
 *
 * Przeciąganie = PRAWDZIWA mysz Playwright (trusted pointer events), więc
 * `setPointerCapture` i natywne nasłuchy komponentu działają jak w produkcie.
 * `dx = pół szerokości paska` → okno Energy (28 dni) przesuwa się o +14 dni
 * (snap dzienny). Środek przeciągania: przycisk WCIŚNIĘTY w chwili migawki.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const PORT = 5421;
const outDir = process.argv[2] || 'evidence/qoder-gantt-pl3-etap2-20260918';
const themes = process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : ['light', 'dark'];
const cases = process.argv[4] && process.argv[4] !== 'all' ? [process.argv[4]] : ['hint', '409'];
fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openGantt(page, theme, conflict) {
  const url =
    `http://localhost:${PORT}/?screen=z3x-inicjatywy-plan&lang=en&theme=${theme}` +
    `&plan=draft&uwagi=0${conflict ? '&conflict=1' : ''}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await sleep(3500);
  await page.locator('button', { hasText: /^Plan$/ }).first().click();
  await sleep(2000);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => /^Open$/i.test((x.textContent || '').trim()));
    if (b) b.click();
  });
  await sleep(3000);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => /Dependencies and conflicts/i.test((x.textContent || '').trim()));
    if (b) b.click();
  });
  await sleep(2000);
  // Czysty kadr: chowaj kontrolki przyrządu (jak `--bez-chrome` w shot.mjs).
  await page.evaluate(() => {
    document.querySelectorAll('[data-dev-render-chrome]').forEach((e) => (e.style.display = 'none'));
  });
}

function barRect() {
  const bar = Array.from(document.querySelectorAll('[title^="Energy Monitoring"]'))[0];
  if (!bar) return null;
  const r = bar.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), left: bar.style.left };
}

async function shoot(browser, theme, kase) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (/^http:\/\/(localhost|127\.0\.0\.1)/.test(u) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();
  });

  await openGantt(page, theme, kase === '409');

  const before = await page.evaluate(barRect);
  if (!before) { console.log(`[${theme}/${kase}] BRAK PASKA Energy`); await page.close(); return errors; }
  // Pasek już jest w kadrze (sekcja Dependencies). Lekkie dosunięcie do środka.
  await page.evaluate(() => {
    const bar = Array.from(document.querySelectorAll('[title^="Energy Monitoring"]'))[0];
    if (bar) bar.scrollIntoView({ block: 'center' });
  });
  await sleep(600);
  const r = await page.evaluate(barRect);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dx = Math.round(r.w / 2); // +14 dni = pół 28-dniowego okna

  const out = path.join(outDir, `pl3-${theme}-${kase === 'hint' ? 'drag-hint' : '409'}.png`);

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy, { steps: 12 });

  if (kase === 'hint') {
    await sleep(500);
    const hint = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('span')).find((s) => /Drag to move/i.test(s.textContent || ''));
      return el ? { text: (el.textContent || '').trim(), cls: el.className.slice(0, 80) } : null;
    });
    await page.screenshot({ path: out });
    await page.mouse.up();
    console.log(`[${theme}/hint] bar`, JSON.stringify(r), 'dx', dx, 'HINT', JSON.stringify(hint), 'ERRORS', errors.length ? errors.join(' | ') : 'none');
  } else {
    await page.mouse.up();
    await sleep(2000);
    const after = await page.evaluate(barRect);
    const banner = await page.evaluate(() => {
      const el =
        document.querySelector('[data-testid="plan-window-conflict"]') ||
        Array.from(document.querySelectorAll('[role="alert"]')).find((e) => (e.textContent || '').trim());
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { text: (el.textContent || '').trim().slice(0, 120), y: Math.round(b.y), visible: b.y >= 0 && b.y <= 900 };
    });
    // Jeżeli komunikat konfliktu wypadł z kadru, dosuń go do widoku razem z paskiem.
    if (banner && !banner.visible) {
      await page.evaluate(() => {
        const el =
          document.querySelector('[data-testid="plan-window-conflict"]') ||
          Array.from(document.querySelectorAll('[role="alert"]')).find((e) => (e.textContent || '').trim());
        if (el) el.scrollIntoView({ block: 'center' });
      });
      await sleep(400);
    }
    // Zdejmij fokus z paska, żeby podpowiedź „Drag to move" i ring nie udawały
    // trwającego przeciągania na zrzucie PO odrzuceniu zapisu. Po 409 karta
    // re-renderuje pasek (nowy węzeł), więc stary onFocus/onBlur nie odpala i
    // focusedId zostaje — wymuszamy focus+blur na AKTUALNYM węźle paska.
    await page.evaluate(() => {
      const bar = Array.from(document.querySelectorAll('[title^="Energy Monitoring"]'))[0];
      if (bar) {
        bar.focus();
        bar.blur();
      }
    });
    await sleep(300);
    await page.screenshot({ path: out });
    const reverted = after && before && after.left === before.left;
    console.log(`[${theme}/409] before.left`, before.left, 'after.left', after && after.left, 'REVERTED', reverted, 'BANNER', JSON.stringify(banner), 'ERRORS', errors.length ? errors.join(' | ') : 'none');
  }
  await page.close();
  return errors;
}

const browser = await chromium.launch();
let totalErrors = 0;
for (const theme of themes) {
  for (const kase of cases) {
    const errs = await shoot(browser, theme, kase);
    totalErrors += errs.length;
  }
}
await browser.close();
console.log('DONE. bledyKonsoli(lacznie):', totalErrors, '->', outDir);

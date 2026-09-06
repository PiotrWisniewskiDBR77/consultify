import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const baseURL = process.env.ODBIOR_BASE_URL || 'http://127.0.0.1:3069';
const authPath = process.env.ODBIOR_AUTH_STATE;
const reportPath = process.env.KLAWIATURA_REPORT
  || 'evidence/odbior-zywo-20260905/iv-tryb-ciemny/klawiatura.json';

if (!authPath || !fs.existsSync(authPath)) throw new Error('Wymagany istniejący ODBIOR_AUTH_STATE');
const storageState = JSON.parse(fs.readFileSync(authPath, 'utf8'));
storageState.origins = (storageState.origins || []).map((origin: { origin: string }) => ({
  ...origin,
  origin: origin.origin.replace('http://localhost:3000', baseURL),
}));

const ekrany = [
  ['01-moja-praca', '/my-work'], ['02-czat', '/chat'], ['03-wywiad', '/interview'],
  ['04-narzedzia', '/discovery-tools'], ['05-ocena', '/assessment/drd'],
  ['06-inicjatywy', '/initiatives'], ['07-realizacja', '/execution'], ['08-wyniki', '/results'],
  ['09-finanse', '/finance'], ['10-materialy', '/document-studio'], ['11-audyty', '/audits'],
  ['12-spotkania', '/meetings'], ['13-organizacja', '/organization/profile'],
  ['14-panel-administratora', '/admin/security'], ['15-ustawienia', '/settings/security'],
  ['16-partnerzy', '/partner'],
] as const;

type Wynik = {
  ekran: string; url: string; finalUrl: string; tab: 'PASS' | 'FAIL'; fokus: 'PASS' | 'FAIL';
  esc: 'PASS' | 'FAIL' | 'NIE_ZMIERZONO'; krokiDoCta: number | null; szczegoly: string[];
};
const wyniki: Wynik[] = [];

async function focusSnapshot(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { id: '', visible: false, opis: 'body' };
    const style = getComputedStyle(el);
    const outlineWidth = Number.parseFloat(style.outlineWidth || '0');
    const focusBlue = style.outlineColor === 'rgb(91, 141, 239)';
    const visible = focusBlue && outlineWidth >= 2;
    return {
      id: el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 60) || el.tagName,
      visible,
      opis: `${el.tagName}:${style.outlineColor}:${style.outlineWidth}`,
    };
  });
}

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1440, height: 900 }, locale: 'pl-PL' });

for (const [ekran, url] of ekrany) {
  test(`${ekran}: Tab/c-focus/Esc`, async ({ browser }) => {
    test.setTimeout(30_000);
    const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 }, locale: 'pl-PL' });
    const page = await context.newPage();
    const szczegoly: string[] = [];
    await page.goto(baseURL + url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8_000);
    expect(page.url(), 'sesja nie może trafić na login').not.toContain('/login');

    const cta = page.locator('main button:visible, main a:visible, [role="tablist"] button:visible')
      .filter({ hasNotText: /^\s*$/ }).first();
    const ctaHandle = await cta.elementHandle().catch(() => null);
    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    let krokiDoCta: number | null = null;
    let fokus = true;
    for (let krok = 1; krok <= 12; krok += 1) {
      await page.keyboard.press('Tab');
      const snapshot = await focusSnapshot(page);
      fokus = fokus && snapshot.visible;
      if (!snapshot.visible) szczegoly.push(`brak c-focus krok ${krok}: ${snapshot.opis} (${snapshot.id})`);
      if (ctaHandle && await page.evaluate((target) => document.activeElement === target, ctaHandle)) {
        krokiDoCta = krok;
        break;
      }
    }

    let esc: Wynik['esc'] = 'NIE_ZMIERZONO';
    const trigger = page.getByRole('button', { name: /Otwórz menu profilu użytkownika/i }).first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
      const panel = page.locator('[role="menu"]:visible, [role="dialog"]:visible').last();
      if (await panel.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
        const closed = await panel.isHidden().catch(() => false);
        const returned = await trigger.evaluate((el) => document.activeElement === el).catch(() => false);
        esc = closed && returned ? 'PASS' : 'FAIL';
        if (!closed) szczegoly.push('Esc nie zamknął panelu profilu');
        if (!returned) szczegoly.push('fokus nie wrócił do triggera profilu');
      } else szczegoly.push('trigger profilu nie otworzył menu/dialogu');
    } else szczegoly.push('brak widocznego triggera profilu');

    const wynik: Wynik = {
      ekran, url, finalUrl: page.url(), tab: krokiDoCta === null ? 'FAIL' : 'PASS',
      fokus: fokus ? 'PASS' : 'FAIL', esc, krokiDoCta, szczegoly,
    };
    wyniki.push(wynik);
    console.log(`KLAWIATURA ${ekran} Tab=${wynik.tab} focus=${wynik.fokus} Esc=${wynik.esc}`);
    await context.close();
  });
}

test.afterAll(() => {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ kiedy: new Date().toISOString(), baseURL, wyniki }, null, 2));
  expect(wyniki).toHaveLength(ekrany.length);
});

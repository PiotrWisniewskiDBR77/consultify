/* eslint-disable */
/**
 * FALA 0 — druga runda: persist kolumn (reload w TEJ SAMEJ karcie), klawiatura
 * (Tab/Shift+Tab cykl, Enter/Space na kebabie i pstryczku, Esc warstwowo z
 * powrotem fokusu), formularze/modale (otwórz, walidacja, Esc, powrót
 * fokusu). Jeden proces przeglądarki, per-scenariusz własna karta.
 *
 * node dev-render/verify-f0-deep.mjs > /tmp/f0-deep-report.json
 */
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3601/';
const OUTDIR = 'docs/qa/screens/rn-g3-f0-reverify-2026-08-11';
fs.mkdirSync(OUTDIR, { recursive: true });

async function withPage(browser, fn) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const netErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 400));
  });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e).slice(0, 400)));
  page.on('response', (res) => {
    if (res.status() >= 400) netErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('http://localhost') || u.startsWith('http://127.0.0.1') || u.startsWith('data:') || u.startsWith('blob:')) {
      return route.continue();
    }
    return route.abort();
  });
  const result = await fn(page, consoleErrors, netErrors);
  await page.close();
  return { result, consoleErrors, netErrors };
}

const shot = async (page, name) => {
  await page.screenshot({ path: `${OUTDIR}/${name}.png` }).catch(() => {});
};

(async () => {
  const browser = await chromium.launch();
  const out = {};

  // ── 1) persist kolumn: kpi-registry, w tej samej karcie (reload) ────────
  out.persistKpiColumns = (
    await withPage(browser, async (page) => {
      await page.goto(`${BASE}?screen=results-vnext-kpi-registry&state=ready`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await page.locator('button[aria-label="Ustawienia widoku"]').first().click();
      await page.waitForTimeout(300);
      await shot(page, 'persist--01-popover-before');
      // odznacz "Proces" (pierwsza odblokowana, nie-locked kolumna poza Status)
      const procesRow = page.locator('text=Proces').first();
      await procesRow.click();
      await page.waitForTimeout(300);
      await shot(page, 'persist--02-proces-unchecked');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const headerTextAfterReload = await page.locator('thead').first().innerText();
      await page.locator('button[aria-label="Ustawienia widoku"]').first().click();
      await page.waitForTimeout(300);
      await shot(page, 'persist--03-popover-after-reload');
      const procesCheckboxState = await page
        .locator('text=Proces')
        .first()
        .locator('xpath=preceding-sibling::*[1] | ..')
        .first()
        .evaluate((el) => el.outerHTML)
        .catch(() => 'N/A');
      return { headerTextAfterReload, procesCheckboxState };
    })
  );

  // ── 2) klawiatura: kebab Enter/Space, Esc warstwowo + powrót fokusu ─────
  out.keyboardKpiRegistry = (
    await withPage(browser, async (page) => {
      await page.goto(`${BASE}?screen=results-vnext-kpi-registry&state=ready`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const kebab = page.locator('tbody tr:nth-child(1) button[aria-label="Row actions"]').first();
      await kebab.focus();
      await shot(page, 'kbd--00-kebab-focused');
      const focusedBeforeEnter = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      await shot(page, 'kbd--01-kebab-after-enter');
      const menuOpenAfterEnter = await page.locator('[role="menu"], [role="menuitem"]').count();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await shot(page, 'kbd--02-after-esc-1');
      const activeAfterEsc1 = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
      // Space na kebabie
      await kebab.focus();
      await page.keyboard.press(' ');
      await page.waitForTimeout(400);
      await shot(page, 'kbd--03-kebab-after-space');
      const menuOpenAfterSpace = await page.locator('[role="menu"], [role="menuitem"]').count();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Tab cycle: policz elementy fokusowalne, sprawdź widoczny ring na kilku
      const tabStops = [];
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return null;
          const cs = getComputedStyle(el);
          return {
            tag: el.tagName,
            aria: el.getAttribute('aria-label'),
            text: el.textContent?.trim().slice(0, 30),
            outline: cs.outlineStyle,
            boxShadow: cs.boxShadow?.slice(0, 60),
          };
        });
        tabStops.push(info);
      }
      await shot(page, 'kbd--04-after-12-tabs');

      // Otwórz preview klikiem, potem Esc -> zamyka preview, fokus wraca do wiersza
      await page.locator('tbody tr:nth-child(1)').first().click();
      await page.waitForTimeout(400);
      await shot(page, 'kbd--05-preview-open');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await shot(page, 'kbd--06-preview-esc-closed');
      const previewGoneAfterEsc = await page.locator('text=Otwórz').count();

      return {
        focusedBeforeEnter,
        menuOpenAfterEnter,
        activeAfterEsc1,
        menuOpenAfterSpace,
        tabStops,
        previewGoneAfterEsc,
      };
    })
  );

  // ── 3) OKR: modal create Objective — otwórz, walidacja, Esc, powrót fokusu ──
  out.okrObjectiveModal = (
    await withPage(browser, async (page) => {
      await page.goto(`${BASE}?screen=results-vnext-okr-objectives&level=objectives&modal=create`, {
        waitUntil: 'networkidle',
      });
      await page.waitForTimeout(1000);
      await shot(page, 'okr-modal--00-create-open');
      // spróbuj zapisać bez wypełnienia -> walidacja
      const saveBtn = page.getByRole('button', { name: /Zapisz|Utwórz|Save/i }).first();
      if (await saveBtn.count()) {
        await saveBtn.click().catch(() => {});
        await page.waitForTimeout(400);
        await shot(page, 'okr-modal--01-po-probie-zapisu-pustego');
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await shot(page, 'okr-modal--02-po-esc');
      const modalStillOpen = await page.locator('[role="dialog"]').count();
      return { modalStillOpenAfterEsc: modalStillOpen };
    })
  );

  // ── 4) ROI: quick-create modal ───────────────────────────────────────────
  out.roiCreateModal = (
    await withPage(browser, async (page) => {
      await page.goto(`${BASE}?screen=results-vnext-roi-registry&tab=all&state=ready`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const newBtn = page.getByRole('button', { name: /Nowa sprawa|New case|Nowy przypadek/i }).first();
      const newBtnCount = await newBtn.count();
      if (newBtnCount) {
        await newBtn.click();
        await page.waitForTimeout(500);
        await shot(page, 'roi-create--00-open');
        const submitBtn = page.getByRole('button', { name: /Utwórz|Zapisz|Create/i }).first();
        if (await submitBtn.count()) {
          await submitBtn.click().catch(() => {});
          await page.waitForTimeout(400);
          await shot(page, 'roi-create--01-empty-submit-validation');
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await shot(page, 'roi-create--02-after-esc');
      }
      const dialogCountAfterEsc = await page.locator('[role="dialog"]').count();
      return { newBtnFound: !!newBtnCount, dialogCountAfterEsc };
    })
  );

  // ── 5) ROI model: formularz Assumption create ────────────────────────────
  out.roiAssumptionForm = (
    await withPage(browser, async (page) => {
      await page.goto(
        `${BASE}?screen=results-vnext-roi-model&tab=assumptions&selected=roi-case-1&assumptionForm=create`,
        { waitUntil: 'networkidle' }
      );
      await page.waitForTimeout(1000);
      await shot(page, 'roi-assumption--00-open');
      const dialogCount = await page.locator('[role="dialog"]').count();
      const submitBtn = page.getByRole('button', { name: /Zapisz|Dodaj|Save/i }).first();
      if (await submitBtn.count()) {
        await submitBtn.click().catch(() => {});
        await page.waitForTimeout(400);
        await shot(page, 'roi-assumption--01-empty-submit');
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await shot(page, 'roi-assumption--02-after-esc');
      const dialogAfterEsc = await page.locator('[role="dialog"]').count();
      return { dialogCount, dialogAfterEsc };
    })
  );

  // ── 6) OKR registry: locked row kebab (blocked bez powodu widocznego?) ──
  out.okrLockedKebab = (
    await withPage(browser, async (page) => {
      await page.goto(`${BASE}?screen=results-vnext-okr-registry&tab=org`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      // znajdź wiersz z ikoną kłódki (locked) i otwórz jego kebab
      const lockedRow = page.locator('tbody tr').filter({ has: page.locator('svg') }).first();
      await page.locator('tbody tr:nth-child(2) button[aria-label="Row actions"]').first().click();
      await page.waitForTimeout(400);
      await shot(page, 'okr-locked--00-kebab-open');
      const menuText = await page.locator('body').innerText();
      await page.keyboard.press('Escape');
      return { menuSnippet: menuText.slice(0, 0) }; // pełny tekst i tak w zrzucie
    })
  );

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();

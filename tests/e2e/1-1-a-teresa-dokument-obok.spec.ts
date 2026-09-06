/**
 * 1.1-A (06.09) — Teresa pisze W DOKUMENCIE OBOK, a nie w innym module.
 * [ODMROZENIE 13_CHAT DEC-397]
 *
 * Defekt właściciela (staging, 06.09): przy otwartym dokumencie obok prośba
 * „Zrob mi plan w okni obok" (a) wypisała plan W CZACIE, dokument został
 * pusty, (b) wyprodukowała kartę `Initiatives · create`, (c) szablon
 * dokumentu był po angielsku.
 *
 * Ten test sprawdza MECHANIKĘ, nie treść modelu: odpowiedź AI jest
 * niedeterministyczna, więc `/api/ai/generate` jest podstawiony (route stub).
 * Sprawdzane jest to, co musi być prawdą niezależnie od modelu:
 *   (a) powstaje KARTA propozycji z podglądem i przyciskiem „Wstaw do
 *       dokumentu" — i NIC jeszcze nie jest zapisane;
 *   (b) po kliknięciu treść jest w edytorze obok i w zakładce MD;
 *   (c) „Odrzuć" zostawia dokument bez zmian (SSOT §5 S4);
 *   (d) prośba o INICJATYWĘ nie jest przechwytywana przez ścieżkę dokumentu
 *       — leci do Teresy, gdzie decyduje osobne „Zatwierdź".
 *
 * Uruchomienie na lokalnym stanowisku (patrz
 * `scripts/dev/stanowisko-lokalne/README.md`):
 *   ODBIOR_AUTH_STATE=/private/tmp/stanowisko-noc/auth.json \
 *   E2E_BASE_URL=http://localhost:3090 \
 *   npx playwright test tests/e2e/1-1-a-teresa-dokument-obok.spec.ts
 * Bez `ODBIOR_AUTH_STATE` test jest pomijany (skip), a nie fałszywie zielony.
 */

import fs from 'node:fs';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3090';
const AUTH_STATE = process.env.ODBIOR_AUTH_STATE || '';
const STUB_MARKDOWN = [
  '## Plan wdrożenia',
  '',
  '- Krok pierwszy: zebrać wymagania.',
  '- Krok drugi: wybrać dostawcę.',
  '',
  'ZNACZNIK-TESTOWY-1-1-A',
].join('\n');

const maSesje = Boolean(AUTH_STATE && fs.existsSync(AUTH_STATE));

test.describe('1.1-A — propozycja do dokumentu obok', () => {
  test.skip(!maSesje, 'Brak ODBIOR_AUTH_STATE — test wymaga zalogowanej sesji stanowiska.');
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Sesja jest zapisana dla innego portu; `origins` przepisujemy na KOPII
    // w pamięci (plik sesji jest współdzielony — nigdy go nie zapisujemy).
    const surowa = JSON.parse(fs.readFileSync(AUTH_STATE, 'utf8'));
    const wzor = (surowa.origins || []).find((o: { origin: string }) =>
      o.origin.includes('localhost')
    );
    const storageState = {
      cookies: surowa.cookies || [],
      origins: [...(surowa.origins || []), ...(wzor ? [{ ...wzor, origin: BASE }] : [])],
    };
    context = await browser.newContext({
      storageState: storageState as never,
      viewport: { width: 1440, height: 900 },
    });
    page = await context.newPage();

    // Stub generacji: mechanika ma być mierzalna niezależnie od modelu.
    await page.route('**/api/ai/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: STUB_MARKDOWN }),
      });
    });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  async function otworzDokumentObok() {
    await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/);
    const przycisk = page.locator('[data-testid="chat-work-panel-button"]');
    await przycisk.first().click();
    await expect(page.locator('[data-testid="chat-work-panel"]')).toBeVisible({ timeout: 20_000 });
    const szablon = page.locator('text=Napisz dokument');
    if (await szablon.count()) await szablon.first().click().catch(() => undefined);
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 20_000 });
  }

  async function wyslij(tekst: string) {
    const pole = page.locator('textarea').last();
    await pole.click();
    await pole.fill(tekst);
    await page.keyboard.press('Enter');
  }

  test('(a) prośba „w oknie obok" daje kartę propozycji, a nie zapis', async () => {
    await otworzDokumentObok();
    const trescPrzed = (await page.locator('.ProseMirror').first().innerText()).trim();

    await wyslij('Zrob mi plan w okni obok');

    const karta = page.locator('[data-testid="teresa-document-proposal"]');
    await expect(karta).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-testid="teresa-document-proposal-badge"]')).toHaveText(
      'Do zatwierdzenia'
    );
    await expect(page.locator('[data-testid="teresa-document-proposal-preview"]')).toContainText(
      'ZNACZNIK-TESTOWY-1-1-A'
    );
    await expect(page.locator('[data-testid="teresa-document-proposal-insert"]')).toBeVisible();

    // Nic nie zostało zapisane: dokument bez zmian, żadnej karty innego modułu.
    expect((await page.locator('.ProseMirror').first().innerText()).trim()).toBe(trescPrzed);
    await expect(page.locator('text=Initiatives · create')).toHaveCount(0);
  });

  test('(b) „Wstaw do dokumentu" wstawia treść do edytora i do zakładki MD', async () => {
    await page.locator('[data-testid="teresa-document-proposal-insert"]').first().click();

    await expect(page.locator('.ProseMirror').first()).toContainText('ZNACZNIK-TESTOWY-1-1-A', {
      timeout: 20_000,
    });
    await expect(page.locator('[data-testid="teresa-document-proposal-badge"]')).toHaveText(
      'Wstawione do dokumentu'
    );

    // Markdown kanoniczny — zakładka MD czyta z tego samego źródła.
    await page.locator('button:has-text("MD")').first().click();
    await expect(page.locator('[data-testid="canvas-md-view"]')).toHaveValue(/## Plan wdrożenia/, {
      timeout: 20_000,
    });
    await page.locator('button:has-text("Edytor")').first().click();
  });

  test('(c) „Odrzuć" nie zmienia dokumentu', async () => {
    await otworzDokumentObok();
    const trescPrzed = (await page.locator('.ProseMirror').first().innerText()).trim();

    await wyslij('Przygotuj konspekt w dokumencie obok');
    await expect(page.locator('[data-testid="teresa-document-proposal"]')).toBeVisible({
      timeout: 60_000,
    });
    await page.locator('[data-testid="teresa-document-proposal-reject"]').first().click();

    await expect(
      page.locator('[data-testid="teresa-document-proposal"]')
    ).toHaveAttribute('data-proposal-state', 'rejected');
    expect((await page.locator('.ProseMirror').first().innerText()).trim()).toBe(trescPrzed);
  });

  test('(d) prośba o inicjatywę nie jest przechwytywana przez ścieżkę dokumentu', async () => {
    await otworzDokumentObok();
    const zadania: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/ai/')) zadania.push(req.url());
    });

    await wyslij('Zrob inicjatywe z tego planu');
    await page.waitForTimeout(15_000);

    // Żadnej karty dokumentu — wiadomość poszła do Teresy, gdzie o utworzeniu
    // obiektu decyduje osobne „Zatwierdź" (a potem „Wykonaj").
    await expect(page.locator('[data-testid="teresa-document-proposal"]')).toHaveCount(0);
    expect(zadania.some((u) => u.includes('/api/ai/chat/stream'))).toBe(true);
    expect(zadania.some((u) => u.includes('/api/ai/generate'))).toBe(false);
  });
});

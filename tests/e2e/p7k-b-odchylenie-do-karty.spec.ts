/**
 * P7K część B — MECHANIKA WARTOŚCI NA ŻYWO, jeden przepływ end-to-end:
 *
 *   rezultat poza limitem → czerwony wiersz w raporcie KPI (poziom 2)
 *   → wpis w Skrzynce odpowiedzialnego → karta działania (§2.4)
 *   → zadanie osoby → zamknięcie karty → wpis znika ze Skrzynki
 *
 * plus drugi przebieg: rezultat W LIMICIE nie tworzy niczego.
 *
 * Uruchomienie na STANOWISKU LOKALNYM (nie CI, nie staging, nie demo):
 *   E2E_BASE_URL=http://127.0.0.1:3105 \
 *   ODBIOR_AUTH_STATE=/private/tmp/stanowisko-noc/auth-p7kb.json \
 *   npx playwright test tests/e2e/p7k-b-odchylenie-do-karty.spec.ts
 *
 * DANE: realny miernik z zasiewu DBR77 (`WIELKOŚĆ SPRZEDAŻY NETTO (kraj)`,
 * `threshold_min`, cel 4465, limit krytyczny 3572). Test SPRZĄTA PO SOBIE
 * w `test.afterAll` — pomiar, karta, zadanie i wpis Skrzynki znikają, bo
 * dane pokazowe są twarzą produktu.
 */
import fs from 'node:fs';

import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3105';
const authPath = process.env.ODBIOR_AUTH_STATE;
if (!authPath) throw new Error('ODBIOR_AUTH_STATE jest wymagane (plik sesji Playwright)');
const storageState = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const zrodlo = (storageState.origins || []).find(
  (origin: { localStorage?: Array<{ name: string; value: string }> }) =>
    (origin.localStorage || []).some((entry) => entry.name === 'token' && entry.value)
);
storageState.origins = [{ ...zrodlo, origin: baseURL }];
const token: string = (zrodlo.localStorage as Array<{ name: string; value: string }>).find(
  (e) => e.name === 'token'
)!.value;

const API = process.env.E2E_API_URL || 'http://127.0.0.1:4103';
const RAPORT = 'f590a9ef-46a5-5287-bcc9-4188eb665d0d';
const MIERNIK = 'WIELKOŚĆ SPRZEDAŻY NETTO (kraj)';
const OKRES_POZA = { start: '2026-11-01', koniec: '2026-11-30', etykieta: '11.2026' };
const OKRES_W_LIMICIE = { start: '2026-12-01', koniec: '2026-12-31' };
const ZRODLO_POMIARU = 'e2e-p7k-b';

test.use({ storageState, viewport: { width: 1440, height: 900 } });
test.setTimeout(180_000);
test.describe.configure({ mode: 'serial' });

const ZRZUTY = '/private/tmp/wt-p7k-b/evidence/p7k-b';

async function api(sciezka: string, init: RequestInit = {}) {
  return fetch(`${API}${sciezka}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

/** Kebab wiersza o podanej nazwie miernika → pozycja menu. */
async function akcjaWiersza(page: Page, nazwaMiernika: string, etykieta: string) {
  const wiersz = page.locator('tr', { hasText: nazwaMiernika }).first();
  await expect(wiersz).toBeVisible();
  await wiersz.getByRole('button', { name: 'Akcje wiersza' }).click();
  await page.getByRole('menuitem', { name: etykieta }).click();
}

async function wpiszRezultat(
  page: Page,
  okres: { start: string; koniec: string },
  wartosc: string
) {
  await page.getByTestId('kpi-measurement-period-start').fill(okres.start);
  await page.getByTestId('kpi-measurement-period-end').fill(okres.koniec);
  await page.getByTestId('kpi-measurement-actual-value').fill(wartosc);
  await page.getByTestId('kpi-measurement-source').fill(ZRODLO_POMIARU);
  await page.getByTestId('kpi-measurement-record-submit').click();
}

/**
 * SPRZĄTANIE — PRZED I PO. Dane pokazowe są twarzą produktu, a test musi być
 * powtarzalny: bez czyszczenia PRZED przebiegiem drugi start pada na
 * `ux_rvn_kpi_measurements_period` (pomiar tego okresu już jest) i wygląda
 * jak defekt produktu, którym nie jest. Kolejność wymuszona kluczami obcymi:
 * wpisy Skrzynki → zadania → karty → powiadomienia → sprawy odchylenia →
 * pomiary. Usuwamy WYŁĄCZNIE wiersze z naszym źródłem pomiaru i wywodzące
 * się z nich obiekty — zasiew DBR77 zostaje nietknięty.
 */
async function posprzataj() {
  const pool = new Pool({
    connectionString:
      process.env.E2E_DATABASE_URL || 'postgresql://postgres:noc@127.0.0.1:54400/consultify_noc',
  });
  try {
    const { rows } = await pool.query<{ measurement_id: string; kpi_id: string }>(
      `SELECT measurement_id, kpi_id FROM rvn_kpi_measurements WHERE source = $1`,
      [ZRODLO_POMIARU]
    );
    const kpiIds = [...new Set(rows.map((r) => r.kpi_id))];
    if (kpiIds.length > 0) {
      const wzorce = kpiIds.map((id) => `${id}:%`);
      await pool.query(
        `DELETE FROM canonical_inbox_items WHERE source_entity_type = 'action_card'
           AND source_entity_id IN (SELECT id::text FROM action_cards WHERE source_id LIKE ANY($1))`,
        [wzorce]
      );
      await pool.query(
        `DELETE FROM tasks WHERE source_type = 'action_card'
           AND source_id IN (SELECT id::text FROM action_cards WHERE source_id LIKE ANY($1))`,
        [wzorce]
      );
      await pool.query(
        `DELETE FROM notifications WHERE type = 'ACTION_CARD_ASSIGNED'
           AND entity_id IN (SELECT id::text FROM action_cards WHERE source_id LIKE ANY($1))`,
        [wzorce]
      ).catch(() => undefined);
      await pool.query(`DELETE FROM action_cards WHERE source_id LIKE ANY($1)`, [wzorce]);
    }
    if (rows.length > 0) {
      const ids = rows.map((r) => r.measurement_id);
      await pool.query(`DELETE FROM rvn_kpi_deviation_cases WHERE trigger_measurement_id = ANY($1)`, [ids]);
      await pool.query(`DELETE FROM rvn_kpi_measurements WHERE measurement_id = ANY($1)`, [ids]);
    }
  } finally {
    await pool.end();
  }
}

test.beforeAll(posprzataj);
test.afterAll(posprzataj);

test('rezultat poza limitem: czerwony wiersz → Skrzynka → karta → zadanie → zamknięcie', async ({ page }) => {
  await page.goto(`/results/kpi/scorecards/${RAPORT}`);
  const wiersz = page.locator('tr', { hasText: MIERNIK }).first();
  await expect(wiersz).toBeVisible({ timeout: 30_000 });

  // ── 1. Wpisz rezultat POZA LIMITEM (limit krytyczny 3572, wpisujemy 2000) ──
  await akcjaWiersza(page, MIERNIK, 'Wpisz rezultat');
  await wpiszRezultat(page, OKRES_POZA, '2000');
  await expect(page.getByTestId('kpi-measurement-record-submit')).toBeHidden({ timeout: 30_000 });

  /* ── 2. WIERSZ JEST CZERWONY ──
     Trzy fakty, każdy sprawdzany osobno, bo każdy mówi co innego:
      · KOLOR WIERSZA — jest niezałatwione przekroczenie limitu;
      · KOMÓRKA OKRESU — to TEN okres wypadł poza limit (rezultat 2000);
      · IKONA KARTY — jest otwarta karta działania i da się w nią kliknąć.
     Plakietka STANU celowo NIE jest tu sprawdzana: serwer liczy ją z
     OSTATNIEGO ZAMKNIĘTEGO okresu (`latestPerformanceStatus`), a listopad
     2026 jeszcze się nie zamknął. Wymaganie od niej „Krytyczne" byłoby
     żądaniem, żeby front zmyślił stan, którego serwer nie policzył. */
  await expect
    .poll(async () => (await wiersz.getAttribute('class')) ?? '', { timeout: 30_000 })
    .toContain('bg-c-danger');
  await expect(wiersz.getByText('2000')).toBeVisible();
  await expect(wiersz.getByTestId('kpi-report-open-action-card')).toBeVisible();
  await page.screenshot({ path: `${ZRZUTY}/e2e-01-l2-czerwony-wiersz.png` });

  // ── 3. SKRZYNKA odpowiedzialnego ma wpis ──
  await page.goto('/my-work');
  const wpis = page.getByText(new RegExp(`Odchylenie: ${MIERNIK.replace(/[()]/g, '\\$&')} ${OKRES_POZA.etykieta}`));
  await expect(wpis.first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${ZRZUTY}/e2e-02-skrzynka-wpis.png` });

  // ── 4. KLIK otwiera KARTĘ DZIAŁANIA z polami §2.4 ──
  await page.getByTestId('inbox-action-card-entry').first().click();
  const karta = page.locator('[data-action-card]').first();
  await expect(karta).toBeVisible();
  await expect(karta.getByText('Okres', { exact: true })).toBeVisible();
  await expect(karta.getByText(`${OKRES_POZA.start} – ${OKRES_POZA.koniec}`)).toBeVisible();
  await expect(karta.getByText(/Odchylenie: /).first()).toBeVisible();
  // Odpowiedzialność = NAZWISKO, nigdy identyfikator.
  await expect(karta.getByText('Audyt Nocny').first()).toBeVisible();
  await page.screenshot({ path: `${ZRZUTY}/e2e-03-karta-dzialania.png` });

  // ── 5. „UTWÓRZ ZADANIE" → zadanie osoby ──
  await karta.getByTestId('action-card-create-task').click();
  await expect(page.getByText(/Zadanie utworzone/)).toBeVisible({ timeout: 20_000 });
  const zadania = await (await api('/api/tasks?limit=200')).json().catch(() => null);
  const utworzone = await (
    await api('/api/action-cards')
  ).json();
  expect(utworzone.cards.length).toBeGreaterThan(0);
  expect(zadania).toBeTruthy();

  // ── 6. ZAMKNIĘCIE KARTY → wpis znika ze Skrzynki ──
  await karta.getByTestId('action-card-close').click();
  await expect(page.getByText(/Karta zamknięta/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('inbox-action-card-entry')).toHaveCount(0, { timeout: 20_000 });
  const poZamknieciu = await (await api('/api/action-cards?status=OPEN')).json();
  expect(poZamknieciu.cards).toHaveLength(0);
});

test('rezultat W LIMICIE nie tworzy ani wpisu, ani karty', async ({ page }) => {
  await page.goto(`/results/kpi/scorecards/${RAPORT}`);
  await expect(page.locator('tr', { hasText: MIERNIK }).first()).toBeVisible({ timeout: 30_000 });

  await akcjaWiersza(page, MIERNIK, 'Wpisz rezultat');
  await wpiszRezultat(page, OKRES_W_LIMICIE, '5000'); // cel 4465, threshold_min ⇒ w normie
  await expect(page.getByTestId('kpi-measurement-record-submit')).toBeHidden({ timeout: 30_000 });

  const karty = await (await api('/api/action-cards?status=OPEN')).json();
  expect(karty.cards).toHaveLength(0);

  await page.goto('/my-work');
  await expect(page.getByTestId('inbox-action-card-entry')).toHaveCount(0, { timeout: 20_000 });
});

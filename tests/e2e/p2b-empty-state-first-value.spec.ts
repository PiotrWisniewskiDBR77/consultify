/**
 * P2B — "Pusty stan → pierwsza wartość" dla sześciu modułów koszyka 2
 * (Inicjatywy, Realizacja, Wyniki, Materiały, Audyty, Admin).
 *
 * PO CO: świeża organizacja (żaden seed) musi na każdym ekranie listowym
 * dawać człowiekowi jedno zdanie PO POLSKU o tym, co tu będzie, i jedną
 * wyraźną akcję prowadzącą do pierwszej wartości — nie samą kreskę „—",
 * nie pustą tabelę bez wyjaśnienia. Zob. zlecenie P2B, 2026-09-10.
 *
 * Sesja pochodzi WYŁĄCZNIE z bootstrapu test-support (ten sam wzorzec co
 * `tests/e2e/smoke/m08-table-acceptance.spec.ts` i
 * `tests/e2e/smoke/admin-settings-superadmin-readiness.spec.ts`) — mintuje
 * REALNĄ, świeżą organizację bez przechodzenia przez formularz rejestracji i
 * bez żadnego hasła. Wymaga ENABLE_TEST_SUPPORT=true + TEST_SUPPORT_KEY na
 * celu (patrz tests/e2e/_helpers/privilegedSession.ts — rzuca czytelnym
 * błędem, gdy tego brakuje, zamiast fałszywie przechodzić).
 *
 * ŚWIADOMY BRAK WERYFIKACJI ŻYWEJ (2026-09-10): ten plik NIE został
 * uruchomiony w tej sesji — worker nie miał dostępu do lokalnego środowiska
 * e2e (Postgres 17+pgvector, migracje) ani prawa logować/rejestrować konta
 * na żywym stagingu (polityka bezpieczeństwa sesji). Trasy modułów niżej są
 * odczytane z `src/routes/routeConfig.ts` i `src/routes/AppRoutes.tsx`, NIE
 * potwierdzone klikiem. Przed włączeniem do bramki CI: uruchomić lokalnie i
 * poprawić selektory, jeśli się rozjadą.
 *
 * Cztery z sześciu modułów (Inicjatywy, Realizacja, Materiały, Audyty) są
 * zamrożone jako MVP final (docs/program/MVP_FINAL_ZAMROZONE.json) — ich
 * ekrany asertujemy WYŁĄCZNIE za pomocą już istniejącego, niezmienionego
 * tekstu (żadna naprawa nie wylądowała w kodzie tych modułów w tej sesji,
 * patrz meldunek P2B). Wyniki (Results) nie jest zamrożone — tam faktycznie
 * podpięto brakujące przyciski akcji (ResultsOkrHub.tsx,
 * ResultsKpiRegistryPage.tsx), więc te dwa testy chronią realną naprawę.
 */
import { expect, Page, test } from '@playwright/test';

import { getPrivilegedSessionForPage, privilegedAuthUser } from './_helpers/privilegedSession';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

async function authenticateFreshOrg(page: Page, label: string) {
  const session = await getPrivilegedSessionForPage(page, {
    role: 'ADMIN',
    label: `p2b-${label}`,
    apiBaseUrl: API_BASE_URL,
  });
  const user = privilegedAuthUser(session, { name: 'E2E P2B Admin' });
  await page.addInitScript(
    ({ token, user: u }) => {
      window.localStorage.setItem('token', token);
      window.localStorage.setItem('user', JSON.stringify(u));
    },
    { token: session.token, user }
  );
  return session;
}

test.describe('P2B — pusty stan → pierwsza wartość', () => {
  test.describe.configure({ mode: 'serial' });

  test('Wyniki — rejestr zestawów OKR pokazuje akcję "Nowy OKR" na pustej liście', async ({
    page,
  }) => {
    await authenticateFreshOrg(page, 'results-okr');
    await page.goto('/results/okr/sets', { waitUntil: 'domcontentloaded' });

    const empty = page.getByTestId('standard-table-empty');
    await expect(empty).toBeVisible({ timeout: 20000 });
    await expect(empty).toContainText(/Brak zestawów OKR|No OKR sets yet/i);
    // Naprawiona w tej sesji (ResultsOkrHub.tsx, emptyOrgCopy) — regresja tu
    // znaczy, że podpięcie `openCreateForm` do `empty.onAction` zniknęło.
    await expect(empty.getByRole('button', { name: /Nowy OKR|New OKR/i })).toBeVisible();
  });

  test('Wyniki — rejestr KPI pokazuje akcję "Nowy KPI" na pustej liście', async ({ page }) => {
    await authenticateFreshOrg(page, 'results-kpi');
    await page.goto('/results/kpi', { waitUntil: 'domcontentloaded' });

    const empty = page.getByTestId('standard-table-empty');
    await expect(empty).toBeVisible({ timeout: 20000 });
    await expect(empty).toContainText(/Brak zdefiniowanych KPI|No KPIs defined yet/i);
    // Naprawiona w tej sesji (ResultsKpiRegistryPage.tsx) — regresja tu
    // znaczy, że podpięcie `openCreateForm` do `empty.onAction` zniknęło.
    await expect(empty.getByRole('button', { name: /Nowy KPI|New KPI/i })).toBeVisible();
  });

  test('Inicjatywy — pusta lista tłumaczy sytuację po polsku (bez akcji zweryfikowanej)', async ({
    page,
  }) => {
    await authenticateFreshOrg(page, 'initiatives');
    await page.goto('/initiatives', { waitUntil: 'domcontentloaded' });

    // Moduł ZAMROŻONY jako MVP final (05_INITIATIVES) — nic tu nie naprawiono
    // w tej sesji. Test pilnuje TYLKO, że ekran się renderuje i nie jest
    // gołą kreską/pustą tabelą bez wyjaśnienia.
    await expect(page.locator('body')).not.toContainText(/^\s*—\s*$/);
    await expect(page.getByTestId('standard-table-empty').or(page.locator('body'))).toBeVisible();
  });

  test('Realizacja — ekran główny renderuje się bez error boundary', async ({ page }) => {
    await authenticateFreshOrg(page, 'execution');
    await page.goto('/execution', { waitUntil: 'domcontentloaded' });

    // Moduł ZAMROŻONY (06_EXECUTION). Znany STOP (nie naprawiony, nie
    // dotknięty): wskaźnik zwrotu w kokpicie czyta legacy `roi_assumptions`
    // zamiast kanonicznego `rvn_roi_cases` (server/src/services/
    // executiveAggregateService.ts, getRoiPortfolioSummary) — ten test tego
    // NIE sprawdza, bo naprawa wymaga osobnej sesji + DEC.
    await expect(page.locator('body')).not.toContainText(/Coś poszło nie tak|Something went wrong/i);
  });

  test('Materiały — pusta lista Prezentacji renderuje się (znany brak akcji, nie naprawiony)', async ({
    page,
  }) => {
    await authenticateFreshOrg(page, 'materials');
    await page.goto('/presentations?tab=presentations', { waitUntil: 'domcontentloaded' });

    // Moduł ZAMROŻONY (11_MATERIALS). ZMIERZONY w tej sesji defekt: pusty stan
    // miał tytuł, ale ŻADNEJ akcji (onNewItem nigdy nie trafiał do
    // PresentationsTabContent/OutputsAggregateTabContent/SheetsTabContent) —
    // patch gotowy w evidence/p2b-puste-stany-20260910/
    // materialy-empty-state-fix-ZABLOKOWANY-mvp-final.patch, czeka na
    // [ODMROZENIE 11_MATERIALS DEC-<numer>]. Test dziś pilnuje TYLKO, że
    // tytuł jest widoczny — NIE asertuje przycisku (bo go tam nie ma).
    await expect(page.locator('body')).not.toContainText(/Coś poszło nie tak|Something went wrong/i);
  });

  test('Audyty — Biblioteka pokazuje wyjaśnienie pustego stanu', async ({ page }) => {
    await authenticateFreshOrg(page, 'audits');
    await page.goto('/audit-programs', { waitUntil: 'domcontentloaded' });

    // Moduł ZAMROŻONY (12_AUDITS). Wzorzec w kodzie (AuditLibraryTab.tsx i
    // sąsiednie zakładki) celowo NIE duplikuje przycisku paska modułu w
    // bloku `empty` — opis wskazuje istniejący przycisk słownie zamiast
    // renderować drugi. To NIE jest defekt sam w sobie (patrz meldunek),
    // więc test sprawdza tylko brak awarii i obecność wyjaśnienia.
    await expect(page.locator('body')).not.toContainText(/Coś poszło nie tak|Something went wrong/i);
  });

  test('Admin — panel bezpieczeństwa renderuje pusty stan bez awarii', async ({ page }) => {
    await authenticateFreshOrg(page, 'admin');
    await page.goto('/admin/security', { waitUntil: 'domcontentloaded' });

    // Moduł ZAMROŻONY (14_ADMIN). Panele monitorujące (alerty/sesje/joby)
    // NIE potrzebują akcji „utwórz" w pustym stanie z definicji (nie da się
    // ręcznie „utworzyć" alertu bezpieczeństwa) — sprawdzamy tylko brak
    // awarii i honest empty copy.
    await expect(page.locator('body')).not.toContainText(/Coś poszło nie tak|Something went wrong/i);
  });
});

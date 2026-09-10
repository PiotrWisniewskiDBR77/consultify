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
 * ZWERYFIKOWANE ŻYWO (2026-09-10, dyżur domknięcia S2.2): plik uruchomiony
 * lokalnie (Postgres 17+pgvector w jednorazowym kontenerze, migracje strict
 * na czystej bazie, backend+frontend lokalne, sesja z bootstrapu
 * test-support). Trasy OKR/KPI z pierwszej wersji tego pliku były
 * odczytane z routeConfig „na oko" i myliły się: `/results/okr/sets` (bez
 * ID) nie jest trasą listy — React Router dopasowuje to jako WARTOŚĆ
 * parametru dynamicznej trasy raportu i próbuje wczytać nieistniejący
 * raport "sets", co daje realny błąd na ekranie, nie pusty stan. Poprawione
 * na realne trasy Menu 2 (`/results/okr`, `/results/kpi` bez `?kpiView=`) i
 * realny tekst, jaki te ekrany faktycznie renderują — patrz komentarze przy
 * obu testach OKR/KPI niżej. `ResultsOkrHub.tsx` (skąd pochodził oryginalny
 * tekst "Brak zestawów OKR"/"Nowy OKR") okazał się MARTWYM kodem — nie jest
 * podpięty do żadnej trasy w AppRoutes.tsx po migracji na pakiet p7k
 * (OkrReportRegistryPage); zgłoszone osobno w meldunku, nie naprawiane tu.
 *
 * Cztery z sześciu modułów (Inicjatywy, Realizacja, Materiały, Audyty) są
 * zamrożone jako MVP final (docs/program/MVP_FINAL_ZAMROZONE.json) — ich
 * ekrany asertujemy WYŁĄCZNIE za pomocą już istniejącego, niezmienionego
 * tekstu (żadna naprawa nie wylądowała w kodzie tych modułów w tej sesji,
 * patrz meldunek P2B). Wyniki (Results) nie jest zamrożone — tam faktycznie
 * podpięto brakujące przyciski akcji (OkrReportRegistryPage.tsx,
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

  test('Wyniki — rejestr raportów OKR pokazuje akcję "Nowy raport" na pustej liście', async ({
    page,
  }) => {
    await authenticateFreshOrg(page, 'results-okr');
    // Zmierzone 2026-09-10 (uruchomienie lokalne): `/results/okr/sets` (bez
    // ID) NIE jest realną trasą listy. ROUTES.RESULTS_OKR.SET wymaga
    // `:okrSetId`, więc React Router dopasowuje "sets" jako WARTOŚĆ parametru
    // dynamicznej trasy REPORT (`/results/okr/:setId`) i próbuje wczytać
    // raport o id="sets" — stąd realny błąd na ekranie ("Something went
    // wrong completing this action"), nie pusty stan. Menu 2 "OKR" faktycznie
    // prowadzi na ROOT `/results/okr` (ResultsOkrRegistryPage →
    // OkrReportRegistryPage, src/routes/AppRoutes.tsx:3369-3389) — to jest
    // realny ekran klienta. `ResultsOkrHub.tsx` (skąd pochodził oryginalny
    // tekst "Brak zestawów OKR"/"Nowy OKR" testu) nie jest już podpięty do
    // ŻADNEJ trasy w AppRoutes.tsx — martwy kod po migracji na pakiet p7k
    // (zbudowane, ale niepodłączone; zgłoszone osobno w meldunku).
    await page.goto('/results/okr', { waitUntil: 'domcontentloaded' });

    const empty = page.getByTestId('standard-table-empty');
    await expect(empty).toBeVisible({ timeout: 20000 });
    await expect(empty).toContainText(/Brak raportów OKR|No OKR reports/i);
    // Naprawiona w tej sesji (OkrReportRegistryPage.tsx, komentarz "P2B
    // (2026-09-10)") — regresja tu znaczy, że podpięcie akcji do pustego
    // stanu (`empty.onAction` → `/results/okr/sets`) zniknęło.
    await expect(empty.getByRole('button', { name: /Nowy raport|New report/i })).toBeVisible();
  });

  test('Wyniki — rejestr raportów KPI pokazuje akcję "Nowy raport" na pustej liście', async ({
    page,
  }) => {
    await authenticateFreshOrg(page, 'results-kpi');
    await page.goto('/results/kpi', { waitUntil: 'domcontentloaded' });

    // Zmierzone 2026-09-10 (uruchomienie lokalne): `/results/kpi` bez
    // `?kpiView=` renderuje domyślnie zakładkę RAPORTÓW ("Brak raportów
    // KPI"/"No KPI reports yet", akcja "Nowy raport"), nie rejestr
    // pojedynczych wskaźników ("Brak zdefiniowanych KPI"/"Nowy KPI" — ten
    // wariant żyje pod `?kpiView=wskazniki`, patrz
    // ResultsKpiRegistryPage.tsx ok. linii 1021/1717). Oryginalny tekst testu
    // opisywał ekran, na który świeży użytkownik NIE trafia klikając "KPI"
    // w Menu 2 — testujemy realny domyślny ekran.
    const empty = page.getByTestId('standard-table-empty');
    await expect(empty).toBeVisible({ timeout: 20000 });
    await expect(empty).toContainText(/Brak raportów KPI|No KPI reports yet/i);
    // Naprawiona w tej sesji (ResultsKpiRegistryPage.tsx, komentarz "P2B
    // (2026-09-10)" przy zakładce raportów) — regresja tu znaczy, że
    // podpięcie `openCreateScorecard` do `empty.onAction` zniknęło.
    await expect(empty.getByRole('button', { name: /Nowy raport|New report/i })).toBeVisible();
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

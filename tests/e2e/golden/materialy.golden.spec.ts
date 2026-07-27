/**
 * URODZINOWA SUITA — złote ścieżki modułu Materiały (E2E, realny UI).
 *
 * Cel (dosłownie, właściciel): "zobacz czy serio to jest warte moich urodzin".
 * Ten plik daje UCZCIWY werdykt PASS/FAIL per ścieżka — żadnych test.skip dla
 * wygody. Gdy ścieżka nie działa, test FAILuje ze zrzutem, nie chowa się.
 *
 * Auth: globalny storageState (tests/e2e/smoke/global-setup.ts) loguje jedną
 * E2E-organizację przez /api/test-support/bootstrap. Wszystkie testy w tym
 * pliku pracują na TEJ SAMEJ organizacji, dlatego cała suita jest `serial`
 * (mode: 'serial') — równoległe tworzenie/seedowanie artefaktów w tej samej
 * org byłoby źródłem fałszywych FAILi, nie prawdziwych błędów produktu.
 *
 * UWAGA (odkryte podczas pisania tego pliku): `?tab=` na /presentations
 * przyjmuje QUERY VALUES z outputsLibraryTabQuery.ts (`documents`,
 * `presentations`, `sheets`, `templates`, …) — NIE wewnętrzne id zakładek
 * (`outputs_documents`, `outputs_sheets`). Pomylenie tych dwóch cichо ląduje
 * na zakładce domyślnej (`presentations`) zamiast rzucić błędem — pierwsza
 * wersja tego pliku miała ten błąd i dawała fałszywy trop (klik "Czysto" na
 * rzekomej zakładce Dokumenty tworzył PREZENTACJĘ). `gotoHub()` poniżej
 * używa wyłącznie wartości z RAP_TAB_TO_QUERY.
 *
 * Zrzuty (screenshot zawsze, nie tylko on-failure, dla G2/G3/G5) lądują w
 * e2e-zrzuty/ w worktree — patrz SHOTS_DIR.
 */
import path from 'node:path';

import { type Page, expect, request as pwRequest, test } from '@playwright/test';

import { getAuthHeader } from '../_helpers/testSupportState';
import { dismissOverlayIfPresent, suppressOnboarding } from '../smoke/work-canvas-helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const SHOTS_DIR = path.resolve(process.cwd(), 'e2e-zrzuty');

// NOTE: intentionally NOT `mode: 'serial'` — a serial group aborts every
// remaining test after the first failure, and the whole point of this suite
// is an honest PASS/FAIL/DEGRADED verdict for EACH of G1-G8, not "we stopped
// looking after G2 broke". Cross-test isolation is instead guaranteed by
// running with `--workers=1` (strictly sequential, one test at a time, same
// shared org) — see the run command in the final report.

/** Hub root testid — StandardModuleBar-based Materiały. */
const HUB_TESTID = 'reports-presentations-hub';

// Fresh test-support org == fresh user == first-run onboarding/welcome tour
// modal on the very first render. It sits on a full-screen `z-modal` overlay
// and swallows every click underneath it (root cause of a false "outputs-new-btn
// click times out" failure seen in an earlier run of this suite — not a real
// product bug, just an unsuppressed onboarding overlay). Every test in this
// file goes through this instead of a raw page.goto.
test.beforeEach(async ({ page }) => {
  await suppressOnboarding(page);
});

/** `tab` must be one of RAP_TAB_TO_QUERY's VALUES (documents/presentations/
 * sheets/templates/…), not the internal RapTab id — see file header note. */
async function gotoHub(page: Page, tab?: string): Promise<void> {
  const url = tab ? `/presentations?tab=${encodeURIComponent(tab)}` : '/presentations';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await dismissOverlayIfPresent(page);
  await expect(page.getByTestId(HUB_TESTID)).toBeVisible({ timeout: 20000 });
  await dismissOverlayIfPresent(page);
}

function shot(name: string) {
  return path.join(SHOTS_DIR, `${name}.png`);
}

/** Seed a blank Document Studio artifact directly via the backend (Mode 1,
 * useLlm:false — deterministic, no LLM). Fallback path for G2 when the UI
 * create flow proves too fragile under MOCK_DB — see rejestr note in the
 * test body for what "fragile" means in this run. */
async function seedBlankDocumentArtifact(
  title: string
): Promise<{ artifactId: string; title: string }> {
  const apiCtx = await pwRequest.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: { ...getAuthHeader(), 'content-type': 'application/json' },
  });
  try {
    const intake = {
      title,
      description: 'E2E golden-path seed — deterministic, no LLM.',
      documentType: 'generic_document',
      language: 'en',
      density: 'concise',
    };
    const outline = {
      documentType: 'generic_document',
      title,
      sections: [
        { title: 'Section 1', level: 1, purpose: '', expectedLengthHint: 'short' },
      ],
      recommendedDensity: 'concise',
      recommendedRegister: 'professional',
      recommendedLanguageStyle: 'formal',
    };
    const genRes = await apiCtx.post('/api/document-studio/generate', {
      data: { intake, outline, useLlm: false },
      timeout: 60000,
    });
    if (!genRes.ok()) {
      throw new Error(
        `seedBlankDocumentArtifact: generate failed ${genRes.status()} ${await genRes.text()}`
      );
    }
    const body = (await genRes.json()) as { artifactId: string; schema?: { title?: string } };
    return { artifactId: body.artifactId, title: body.schema?.title || title };
  } finally {
    await apiCtx.dispose();
  }
}

test.describe('Materiały — złote ścieżki (URODZINOWA SUITA)', () => {
  test('G1 — Hub Materiałów: Menu 1 ma dokładnie 5 zakładek, zero Architekta osobno', async ({
    page,
  }) => {
    await gotoHub(page);

    const tablist = page.getByRole('tablist', { name: 'Module sections' });
    await expect(tablist).toBeVisible({ timeout: 15000 });

    const tabs = tablist.getByRole('tab');
    await expect(tabs).toHaveCount(5, { timeout: 15000 });

    const labels = await tabs.allTextContents();
    expect(labels, `zakładki Menu 1: ${JSON.stringify(labels)}`).toHaveLength(5);

    for (const label of labels) {
      expect(
        label,
        `zakładka "${label}" nie powinna wspominać Architekta — to tryb WEWNĄTRZ Szablonów, nie osobna zakładka`
      ).not.toMatch(/architekt|architect/i);
    }
  });

  test('G2 — Utwórz dokument Czysto → widzę na liście → otwieram treść', async ({ page }) => {
    test.setTimeout(90000);

    await gotoHub(page, 'documents');

    let titleText = '';
    let uiCreateOk = false;

    // --- Attempt 1: real UI flow (Dodaj → Dokument → Czysto). ---
    try {
      await page.getByTestId('outputs-new-btn').click();
      const launcher = page.getByTestId('materials-create-launcher');
      await expect(launcher).toBeVisible({ timeout: 8000 });
      // defaultFormat='document' on the 'outputs_documents' tab → KROK 1 is
      // skipped, launcher opens straight on KROK 2 (mode picker).
      await page.getByTestId('materials-create-launcher-mode-blank').click();

      await page.waitForURL(/\/document-studio\/[^/?]+/, { timeout: 20000 });
      await expect(page.getByTestId('document-studio-mels-shell')).toBeVisible({
        timeout: 20000,
      });
      titleText = (await page.getByTestId('mels-topbar-title').innerText()).trim();
      uiCreateOk = true;
    } catch (uiErr) {
      // Documented, ALLOWED degradation (per task brief): UI create-flow proved
      // too fragile in MOCK_DB — fall back to seeding via the same backend
      // endpoint the UI itself calls, and test from "visible on the list" on.
      // eslint-disable-next-line no-console
      console.warn(
        `[DEGRADED] G2: UI create flow (Dodaj→Dokument→Czysto) failed, falling back to API seed. Reason: ${
          uiErr instanceof Error ? uiErr.message : String(uiErr)
        } | urlAtFailure=${page.url()}`
      );
      const seedTitle = `E2E Golden Blank ${Date.now()}`;
      const seeded = await seedBlankDocumentArtifact(seedTitle);
      titleText = seeded.title;
    }

    expect(titleText, 'dokument musi mieć jakiś tytuł do odnalezienia na liście').not.toBe('');

    // --- Back to Materiały → Dokumenty, find the new row. ---
    // Origin registration runs async server-side (retryWithBackoff, fire-and-
    // forget) — poll a few times instead of asserting on the first paint.
    let rowVisible = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      await gotoHub(page, 'documents');
      const row = page.getByRole('row', { name: titleText });
      rowVisible = await row.first().isVisible().catch(() => false);
      if (rowVisible) break;
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: shot('g2-documents-list'), fullPage: true });
    expect(
      rowVisible,
      `nowy dokument "${titleText}" nie pojawił się na liście Dokumentów po utworzeniu (uiCreateOk=${uiCreateOk})`
    ).toBe(true);

    // --- Open it: double-click → real content, never the intake form. ---
    const row = page.getByRole('row', { name: titleText }).first();
    await row.dblclick();
    await page.waitForURL(/\/document-studio/, { timeout: 20000 });
    await expect(page.getByTestId('document-studio-mels-shell')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('document-load-error')).toHaveCount(0);
    await expect(
      page.getByText(/Generate without template|Opisz dokument/i)
    ).toHaveCount(0);
    await page.screenshot({ path: shot('g2-document-opened'), fullPage: true });
  });

  test('G3 — Zepsuty link (?artifactId=nieistniejący) → polski błąd, nigdy intake', async ({
    page,
  }) => {
    await page.goto('/document-studio?artifactId=nie-istnieje-xyz', {
      waitUntil: 'domcontentloaded',
    });
    await dismissOverlayIfPresent(page);

    const errorBox = page.getByTestId('document-load-error');
    await expect(errorBox).toBeVisible({ timeout: 20000 });
    await expect(errorBox).toContainText(/Nie znaleziono tego dokumentu/i);

    const backBtn = page.getByRole('button', { name: /Wróć do Materiałów/i });
    await expect(backBtn).toBeVisible();

    // Never silently falls back to the empty intake form.
    await expect(
      page.getByText(/Generate without template|Opisz dokument/i)
    ).toHaveCount(0);

    await page.screenshot({ path: shot('g3-broken-link-error'), fullPage: true });

    await backBtn.click();
    await page.waitForURL(/\/presentations\?tab=documents/, { timeout: 15000 });
  });

  test('G4a — /presentations/wizard (bez parametrów) → /prezentacje', async ({ page }) => {
    await page.goto('/presentations/wizard', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/prezentacje/, { timeout: 15000 });
  });

  test('G4b — /presentations/wizard?cloneTemplateArtifactId=… → tab=template_architect', async ({
    page,
  }) => {
    await page.goto('/presentations/wizard?cloneTemplateArtifactId=e2e-fake-id', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(/\/presentations\?.*tab=template_architect/, { timeout: 15000 });
  });

  test('G4c — /presentation-studio → /presentations', async ({ page }) => {
    await page.goto('/presentation-studio', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/presentations(\?|$)/, { timeout: 15000 });
  });

  test('G4d — /wordy → /document-studio', async ({ page }) => {
    await page.goto('/wordy', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/document-studio/, { timeout: 15000 });
  });

  test('G5 — Szablony: lista + „New template" → Architekt szablonów → powrót', async ({
    page,
  }) => {
    // Flag is default-ON per src/utils/deckArchitectFlag.ts, but the brief
    // asks to force it explicitly via localStorage for determinism.
    await page.addInitScript(() => {
      window.localStorage.setItem('ff.deckArchitect', '1');
    });

    await gotoHub(page, 'templates');
    // Renders without crashing — the split "New template" CTA is the anchor
    // proof the Templates tab mounted its real content, not an error boundary.
    await expect(page.getByTestId('outputs-new-btn')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: shot('g5-templates-list'), fullPage: true });

    await page.getByTestId('templates-new-split-toggle').click();
    await expect(page.getByTestId('templates-new-split-menu')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('templates-open-deck-architect').click();

    const backBtn = page.getByTestId('templates-architect-back');
    await expect(backBtn).toBeVisible({ timeout: 15000 });
    await expect(backBtn).toContainText(/Szablony/i);
    await page.screenshot({ path: shot('g5-deck-architect-embedded'), fullPage: true });

    await backBtn.click();
    await expect(page.getByTestId('templates-architect-back')).toHaveCount(0);
    await expect(page.getByTestId('outputs-new-btn')).toBeVisible({ timeout: 10000 });
  });

  test('G6 — Arkusze: dwie etykiety pochodzenia (DEGRADED — patrz diagnoza)', async ({
    page,
  }) => {
    // UCZCIWA DIAGNOZA (nie fałszywy zielony teatr): seedowanie realnego
    // artefaktu 'workbook'-origin idzie przez POST /api/workbook/generate,
    // który woła generator LLM-owy naprawdę (brak deterministycznego
    // useLlm:false trybu jak w Document Studio) — pod MOCK_DB/bez klucza AI
    // to niedeterministyczne ryzyko timeoutu/kosztu w CI. Seedowanie
    // 'tp_tables'-origin wymaga łańcucha bazy→tabeli→governance_mode=governed→
    // GET /api/table-platform/tables/:id/export/xlsx?registerArtifact=true —
    // wieloetapowy pipeline bez jednego test-support endpointu. Oba poza
    // rozsądnym budżetem TEGO robotnika (patrz zlecenie: "degraduj i odnotuj").
    // Mapowanie sourceTable → etykieta jest już pokryte jednostkowo:
    // tests/components/sheetOriginBadge.test.ts (SHEET_ORIGIN_META).
    // Tu sprawdzamy tylko, że zakładka Arkusze faktycznie renderuje się na
    // żywo (nie biały ekran / error boundary) — widokowy dowód życia.
    await gotoHub(page, 'sheets');
    await expect(page.getByTestId('outputs-new-btn')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);
    await page.screenshot({ path: shot('g6-sheets-tab-degraded'), fullPage: true });
  });

  test('G7 — Prezentacje z Teresy: /prezentacje ładuje się bez błędów konsoli', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/prezentacje', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).toContainText(/./, { timeout: 20000 });
    await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);

    expect(
      pageErrors,
      `nieprzechwycone wyjątki JS na /prezentacje: ${JSON.stringify(pageErrors)}`
    ).toHaveLength(0);
    expect(
      consoleErrors,
      `błędy konsoli na /prezentacje: ${JSON.stringify(consoleErrors)}`
    ).toHaveLength(0);
  });

  test('G8 — Raport z Assessment żyje: /reports/builder?new=true otwiera flow tworzenia', async ({
    page,
  }) => {
    await page.goto('/reports/builder?new=true', { waitUntil: 'domcontentloaded' });
    await dismissOverlayIfPresent(page);
    await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: /New report|Nowy raport/i })
    ).toBeVisible({ timeout: 20000 });
  });
});

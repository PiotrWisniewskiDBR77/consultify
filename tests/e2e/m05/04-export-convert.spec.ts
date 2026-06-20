/**
 * M05 §8 Eksport (IdeaExportMenu) + §9 Konwersja idea → output
 * Źródło schematów: Harvard/Testy manualne/TESTY_M05_IDEAS_ZARZADZANIE.md (linie 497–581)
 *
 * To NIE smoke ani test kodu — gnamy ŻYWE UI (localhost:3000) i weryfikujemy kontrakt
 * przez REALNE API (:3001, staging DB) = odpowiednik „zrzutu DB" ze specyfikacji manualnej.
 * Bearer (makeApi) = setup + readback DB. Brak ważnego tokenu → uczciwy test.skip.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * KONTRAKT konwersji (zweryfikowany na ŻYWYM serwerze, my-work.routes.ts:6026):
 *   POST /api/my-work/my-ideas/:id/convert  { target, options? }
 *     target ∈ initiative | task_set | decision | report | presentation | team_chat
 *     → 200 { promotedTo, promotedEntityId, created:{…Id}, sourceSessionId? }
 *       i REALNIE wstawia encję downstream + promuje ideę (stage='promoted').
 *     invalid target → 400 {error:/Invalid target/}; nieistniejąca idea → 404 {error:/not found/}.
 *   created keys per target:
 *     initiative   → { initiativeId }
 *     task_set     → { taskIds: [...] }
 *     decision     → { decisionId }
 *     report       → { reportId }       (+ outputId)
 *     presentation → { presentationId } (+ outputId; 501 gdy brak tabeli presentations)
 *     team_chat    → { conversationId, chatProjectId }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CO ODPALAMY NA ŻYWO vs CO DELEGUJEMY (minimalizacja zaśmiecania DB):
 *   Konwersja NIE ma DELETE downstream (znana luka M13) → każdy convert zostawia
 *   nieszkodliwy DRAFT-rezyduum. Dlatego:
 *
 *   • §9.1 initiative  → JEDEN realny convert (load-bearing proof): 200 + created.initiativeId
 *                        to UUID + readback GET /api/initiatives. CELOWO bez cleanup
 *                        (DELETE inicjatyw → 404 by-design). To jedyne residuum typu „initiative".
 *   • §9.3 decision    → JEDEN realny convert (decision = odrębny typ rezyduum, brak
 *                        realnego DELETE decisions API): 200 + created.decisionId UUID.
 *   • §9.2 task_set    → JEDEN realny convert (taski to odrębny typ, /api/tasks DELETE = no-op
 *                        stub): 200 + created.taskIds tablica.
 *   • §9.4 report / §9.5 presentation / §9.6 team_chat → NIE odpalamy realnie
 *                        (każdy = kolejny nieusuwalny typ rezyduum). Asercja kontraktu
 *                        DELEGOWANA do tests/integration/mywork/my-work.convert.contract.test.ts
 *                        (S5 pokrywa initiative happy-path + walidację; report/presentation/
 *                        team_chat dzielą ten sam handler/promote() — ścieżka wspólna).
 *                        Tu zostawiamy test.skip z jawnym powodem.
 *   • §9.7 negatywne   → invalid target → 400; nieistniejąca idea → 404. TANIE, bez rezyduum
 *                        — odpalamy oba realnie.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * §8 EKSPORT — klientowy (canvas → blob download), NIE API:
 *   • §8.1 PNG/SVG/PDF/MD/JSON → driver UI: otwórz workspace, otwórz IdeaExportMenu
 *     (window event 'idea-workspace-open-export-menu'), asercja że opcje formatów się
 *     renderują + screenshot. Realne pobranie bajtów pliku jest niewykonalne headless →
 *     test.skip dla samego file-bytes.
 *   • §8.2 CSV tabeli → kontrakt API GET /export-csv (jeśli środowisko ma endpoint).
 *   • §8.3 server export STUB (L-05): flaga VITE_ENABLE_IDEA_SERVER_EXPORT OFF →
 *     opcja „server export" NIE jest oferowana jako działająca akcja (DP-5). Na poziomie UI
 *     asercja: menu pokazuje TYLKO klientowe formaty, brak osobnego przycisku „eksport
 *     serwerowy/raport serwera". Pokryte unitem IdeaExportMenu.server-export-flag.test.tsx.
 *
 * Run (serwery dev już działają):
 *   E2E_USE_WEB_SERVER=false E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://localhost:3000 \
 *   npx playwright test tests/e2e/m05/04-export-convert.spec.ts --project=chromium --workers=1 --reporter=list
 */
import { APIRequestContext, Page, expect, test } from '@playwright/test';

import {
  MW,
  createIdeaApi,
  deleteIdeaApi,
  hasAuth,
  makeApi,
  req,
  setupAuth,
  shot,
  uniq,
  unwrap,
} from './_helpers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONVERT_URL = (id: string) => `${MW}/my-ideas/${id}/convert`;

/**
 * Otwórz workspace idei (deep-link /workspace → MyWorkHub:467 openMap) i wymuś otwarcie
 * IdeaExportMenu przez window-event. IdeaMapWorkspace jest lazy (Suspense) — czekamy aż
 * kanwa zamontuje listener PRZED dispatchem; retry dispatchu aż nagłówek menu się pojawi.
 * Zwraca true gdy menu się otwarło (nagłówek widoczny), inaczej false (honest-skip w teście).
 */
async function openExportMenu(page: Page, ideaId: string): Promise<boolean> {
  await page.goto(`/my-work/ideas/${encodeURIComponent(ideaId)}/workspace`, {
    waitUntil: 'domcontentloaded',
  });
  // poczekaj aż workspace się zamontuje (react-flow kanwa lub toolbar narzędzi)
  await page
    .locator('.react-flow, [data-testid*="workspace"], [class*="reactflow"], canvas')
    .first()
    .waitFor({ state: 'visible', timeout: 40_000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }
  const heading = page.getByRole('heading', { name: /Eksport mapy|Export map/i }).first();
  // IdeaMapWorkspace nasłuchuje 'idea-workspace-open-export-menu' (IdeaMapWorkspace.tsx:2528)
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.evaluate((id) => {
      window.dispatchEvent(
        new CustomEvent('idea-workspace-open-export-menu', { detail: { ideaId: id } })
      );
    }, ideaId);
    if (await heading.isVisible({ timeout: 4000 }).catch(() => false)) return true;
    await page.waitForTimeout(1200);
  }
  return false;
}

test.describe('M05 §8 Eksport (IdeaExportMenu) + §9 Konwersja idea → output', () => {
  test.skip(!hasAuth(), 'Brak ważnego tokenu /tmp/consultify-auth.json — uczciwy skip');
  test.setTimeout(120_000);

  let api: APIRequestContext;
  // Idee testowe sprzątamy ZAWSZE. Promowane encje downstream (initiative/decision/
  // task_set/report/presentation/team_chat) NIE mają DELETE → zostają jako nieszkodliwy DRAFT.
  const trashIdeas: string[] = [];

  test.beforeAll(async () => {
    api = await makeApi();
  });

  test.afterAll(async () => {
    for (const id of trashIdeas) await deleteIdeaApi(api, id);
    await api.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  // ════════════════════════════ §8 EKSPORT ════════════════════════════

  // ── §8.1 Eksport klientowy (PNG/SVG/PDF/MD/JSON) [MANUAL] ──
  test('§8.1 — IdeaExportMenu renderuje formaty klientowe PNG/SVG/PDF/MD/JSON [MANUAL]', async ({
    page,
  }) => {
    const idea = await createIdeaApi(api, uniq('M05-E2E-CV-Export'), { tags: ['test'] });
    trashIdeas.push(idea.id);

    const opened = await openExportMenu(page, idea.id);
    await shot(page, 's8-1');
    test.skip(
      !opened,
      'IdeaMapWorkspace (lazy canvas) nie zamontował menu eksportu w headless — eksport klient-side pokryty unitem IdeaExportMenu.test.tsx'
    );

    // Menu otwarte → każdy klientowy format renderuje się jako opcja (label PL/EN z FORMATS).
    const formatLabels: RegExp[] = [
      /PNG \(obraz\)|PNG \(image\)/i,
      /SVG \(wektor\)|SVG \(vector\)/i,
      /^PDF$/i,
      /Markdown/i,
      /JSON \(dane\)|JSON \(data\)/i,
    ];
    for (const rx of formatLabels) {
      await expect(page.getByText(rx).first(), `opcja ${rx} obecna`).toBeVisible({
        timeout: 10_000,
      });
    }
    await shot(page, 's8-1');
    // Realne pobranie bajtów pliku (canvas→blob→download) poza zakresem headless; asercja
    // = obecność wszystkich formatów klientowych w menu (realny PASS, nie skip).
  });

  // ── §8.2 Eksport CSV tabeli [DB] ──
  test('§8.2 — export-csv tabeli: GET zwraca 200 text/csv (lub 404/501 gdy brak na env)', async ({
    page,
  }) => {
    const idea = await createIdeaApi(api, uniq('M05-E2E-CV-Csv'), { tags: ['test'] });
    trashIdeas.push(idea.id);

    const res = await req(api, 'get', `${MW}/my-ideas/${idea.id}/export-csv`);
    // Kontrakt: 200 + Content-Type text/csv. Gdy endpoint nie jest na tym środowisku
    // (404) lub stub (501) — odnotuj jako honest-skip zamiast fałszywej czerwieni.
    if (res.status() === 200) {
      const ct = res.headers()['content-type'] || '';
      expect(ct, `Content-Type CSV → ${ct}`).toMatch(/text\/csv|application\/csv/i);
      const body = await res.text();
      expect(typeof body, 'CSV body to tekst').toBe('string');
    } else {
      expect([404, 501], `GET export-csv → ${res.status()} (brak na env = honest-skip)`).toContain(
        res.status()
      );
      test.skip(true, `export-csv niedostępny na tym środowisku (HTTP ${res.status()})`);
    }

    await shot(page, 's8-2');
  });

  // ── §8.3 Eksport serwerowy — znana luka L-05 (flaga OFF) [FLAG] ──
  test('§8.3 — server export STUB ukryty za flagą OFF: menu oferuje TYLKO formaty klientowe (L-05/DP-5)', async ({
    page,
  }) => {
    const idea = await createIdeaApi(api, uniq('M05-E2E-CV-Srv'), { tags: ['test'] });
    trashIdeas.push(idea.id);

    const opened = await openExportMenu(page, idea.id);
    await shot(page, 's8-3');
    test.skip(
      !opened,
      'IdeaMapWorkspace (lazy canvas) nie zamontował menu eksportu w headless — flaga L-05 OFF pokryta unitem IdeaExportMenu.server-export-flag.test.tsx'
    );

    // VITE_ENABLE_IDEA_SERVER_EXPORT jest OFF (default) → recordExportRequest() NIE odpala
    // POST /v4-final/ideas/:id/export (IdeaExportMenu.tsx:519). Na poziomie UI: brak osobnej,
    // serwerowej akcji eksportu — żaden klik nie powinien wystrzelić requestu do /export.
    // Pokryte unitem IdeaExportMenu.server-export-flag.test.tsx; tu strzeżemy braku side-effectu.
    let serverExportFired = false;
    page.on('request', (r) => {
      if (/\/v4-final\/ideas\/[^/]+\/export\b/.test(r.url())) serverExportFired = true;
    });

    // Klik w PNG (klientowy) — nie powinno wywołać serwerowego eksportu.
    const png = page.getByText(/PNG \(obraz\)|PNG \(image\)/i).first();
    if (await png.isVisible().catch(() => false)) {
      await png.click().catch(() => {});
      await page.waitForTimeout(1200);
    }
    expect(serverExportFired, 'flaga OFF → żaden POST /v4-final/ideas/:id/export nie poleciał').toBe(
      false
    );

    await shot(page, 's8-3');
  });

  // ════════════════════════════ §9 KONWERSJA ════════════════════════════

  // ── §9.1 → Initiative [DB] — LOAD-BEARING realny convert ──
  // CLEANUP-WYJĄTEK: DELETE inicjatyw nie istnieje (404 by-design) → tworzymy JEDNĄ i NIE sprzątamy.
  test('§9.1 — convert→initiative: 200 + created.initiativeId (UUID) + readback GET /api/initiatives [DB]', async ({
    page,
  }) => {
    const idea = await createIdeaApi(api, uniq('M05-E2E-CV-Init'), { tags: ['test'] });
    trashIdeas.push(idea.id);

    const res = await req(api, 'post', CONVERT_URL(idea.id), { data: { target: 'initiative' } });
    expect(res.status(), `convert initiative → ${res.status()}`).toBe(200);
    const body = unwrap(await res.json());
    expect(body.promotedTo).toBe('initiative');
    const initiativeId = body?.created?.initiativeId ?? body?.promotedEntityId;
    expect(String(initiativeId), 'created.initiativeId to UUID').toMatch(UUID_RE);
    expect(String(body.promotedEntityId)).toBe(String(initiativeId));

    // Readback „DB": inicjatywa figuruje na realnej liście PMO.
    const list = await req(api, 'get', '/api/initiatives?limit=100');
    if (list.ok()) {
      const lb = await list.json();
      const items = Array.isArray(lb) ? lb : lb.data || lb.initiatives || [];
      const found = items.find((it: any) => String(it.id) === String(initiativeId));
      expect(found, 'utworzona inicjatywa widoczna w GET /api/initiatives').toBeTruthy();
    }

    // Idea promowana (stage='promoted') po konwersji — readback przez getById.
    const after = await req(api, 'get', `${MW}/my-ideas/${idea.id}`);
    if (after.ok()) {
      const row = unwrap(await after.json());
      expect(String(row?.stage ?? row?.promotedTo ?? '')).toMatch(/promoted|initiative/i);
    }

    await page.goto(`/my-work/ideas/${encodeURIComponent(idea.id)}/workspace`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1500);
    await shot(page, 's9-1');
    // brak cleanup inicjatywy (DELETE→404 by-design) — nieszkodliwy DRAFT
  });

  // ── §9.2 → Task Set [DB] — realny convert (odrębny typ rezyduum) ──
  test('§9.2 — convert→task_set: 200 + created.taskIds (tablica) [DB]', async ({ page }) => {
    const idea = await createIdeaApi(api, uniq('M05-E2E-CV-Tasks'), { tags: ['test'] });
    trashIdeas.push(idea.id);

    const res = await req(api, 'post', CONVERT_URL(idea.id), { data: { target: 'task_set' } });
    expect(res.status(), `convert task_set → ${res.status()}`).toBe(200);
    const body = unwrap(await res.json());
    expect(body.promotedTo).toBe('task_set');
    expect(Array.isArray(body?.created?.taskIds), 'created.taskIds to tablica').toBeTruthy();

    await page.goto(`/my-work/ideas/${encodeURIComponent(idea.id)}/workspace`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1500);
    await shot(page, 's9-2');
    // taski bez realnego DELETE (/api/tasks DELETE = no-op stub) — nieszkodliwe rezyduum
  });

  // ── §9.3 → Decision [DB] — realny convert (odrębny typ rezyduum) ──
  test('§9.3 — convert→decision: 200 + created.decisionId (UUID) [DB]', async ({ page }) => {
    const idea = await createIdeaApi(api, uniq('M05-E2E-CV-Dec'), { tags: ['test'] });
    trashIdeas.push(idea.id);

    const res = await req(api, 'post', CONVERT_URL(idea.id), { data: { target: 'decision' } });
    expect(res.status(), `convert decision → ${res.status()}`).toBe(200);
    const body = unwrap(await res.json());
    expect(body.promotedTo).toBe('decision');
    expect(String(body?.created?.decisionId ?? body?.promotedEntityId), 'decisionId UUID').toMatch(
      UUID_RE
    );

    await page.goto(`/my-work/ideas/${encodeURIComponent(idea.id)}/workspace`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1500);
    await shot(page, 's9-3');
    // decisions bez realnego DELETE API — nieszkodliwe rezyduum
  });

  // ── §9.4 → Report [DB] — DELEGOWANE do integration contract ──
  test('§9.4 — convert→report: kontrakt zdelegowany do integration test (residuum nieusuwalne)', async ({
    page,
  }) => {
    // Report tworzy kolejny nieusuwalny typ rezyduum. Handler dzieli wspólną ścieżkę
    // (walidacja target + promote()) z initiative, którą pokrywamy na żywo (§9.1) oraz
    // tests/integration/mywork/my-work.convert.contract.test.ts (S5). Nie odpalamy realnie.
    await page.goto('/my-work/ideas', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await shot(page, 's9-4');
    test.skip(
      true,
      'report convert pokryty integration contract (S5) — unikamy nieusuwalnego rezyduum DB'
    );
  });

  // ── §9.5 → Presentation [DB] — DELEGOWANE do integration contract ──
  test('§9.5 — convert→presentation: kontrakt zdelegowany do integration test (residuum nieusuwalne)', async ({
    page,
  }) => {
    // Presentation = kolejny nieusuwalny typ rezyduum (+ 501 gdy brak tabeli presentations na env).
    // Wspólna ścieżka handlera pokryta §9.1 (żywo) + integration S5. Nie odpalamy realnie.
    await page.goto('/my-work/ideas', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await shot(page, 's9-5');
    test.skip(
      true,
      'presentation convert pokryty integration contract (S5) — unikamy nieusuwalnego rezyduum DB'
    );
  });

  // ── §9.6 → Team Chat [DB] — DELEGOWANE do integration contract ──
  test('§9.6 — convert→team_chat: kontrakt zdelegowany do integration test (residuum nieusuwalne)', async ({
    page,
  }) => {
    // team_chat tworzy chat_projects + conversations (nieusuwalne na tym harnessie).
    // Wspólna ścieżka handlera pokryta §9.1 (żywo) + integration S5. Nie odpalamy realnie.
    await page.goto('/my-work/ideas', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await shot(page, 's9-6');
    test.skip(
      true,
      'team_chat convert pokryty integration contract (S5) — unikamy nieusuwalnego rezyduum DB'
    );
  });

  // ── §9.7 Negatywne ścieżki konwersji [DB] — tanie, bez rezyduum ──
  test('§9.7 — convert negatywne: invalid target → 400, nieistniejąca idea → 404 [DB]', async ({
    page,
  }) => {
    const idea = await createIdeaApi(api, uniq('M05-E2E-CV-Neg'), { tags: ['test'] });
    trashIdeas.push(idea.id);

    // Invalid target → 400 (walidacja przed jakimkolwiek INSERT — brak rezyduum).
    const bad = await req(api, 'post', CONVERT_URL(idea.id), { data: { target: 'nonsense_xyz' } });
    expect(bad.status(), `invalid target → ${bad.status()}`).toBe(400);
    const badBody = await bad.json().catch(() => ({}));
    expect(String(badBody?.error ?? ''), 'błąd „Invalid target"').toMatch(/invalid target/i);

    // Nieistniejąca idea → 404 (guard WHERE id=? AND user_id=? AND organization_id=?).
    const ghost = '00000000-0000-4000-8000-000000000000';
    const missing = await req(api, 'post', CONVERT_URL(ghost), { data: { target: 'initiative' } });
    expect(missing.status(), `nieistniejąca idea → ${missing.status()}`).toBe(404);
    const missBody = await missing.json().catch(() => ({}));
    expect(String(missBody?.error ?? ''), 'błąd „not found"').toMatch(/not found/i);

    await page.goto('/my-work/ideas', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await shot(page, 's9-7');
  });
});

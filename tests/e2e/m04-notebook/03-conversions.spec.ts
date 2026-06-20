/**
 * M04 §4 Ekstrakcja akcji / provenance + §5 Konwersje do encji
 * Źródło schematów: Harvard/Testy manualne/TESTY_M04_NOTATNIK.md (§4, §5)
 *
 * KONTRAKT (ustalony z serwera, weryfikowany na ŻYWYCH odpowiedziach):
 *   POST /api/my-work/notebook/pages/:id/convert
 *     body: { target, title?, description?, assessmentType? }
 *     target ∈ task|decision|initiative|report|presentation|assessment  (NIE 'idea')
 *     → 201 { id, type, title, sourceSessionId? } + tworzy realną encję
 *       oraz UPDATE notebook_pages.status='converted', converted_to_json += {type,id}
 *   POST /api/my-work/notebook/pages/:id/extract-actions   → SSE (text/event-stream)
 *     emituje 'actions' {items:[]} + 'done' {count}; LLM → odporne asercje
 *   Provenance task/decision: source_type='notebook', source_id=pageId
 *     readback: GET /api/my-work/tasks?source=notebook&onlyOpen=false
 *               GET /api/my-work/decisions?source=notebook
 *   initiative trafia do tabeli `initiatives` → GET /api/initiatives ją listuje.
 *   UI pill "Initiatives" → handleHandoffInitiatives → convert target=initiative
 *     → toast "Initiative created"/"Inicjatywa utworzona".
 *   UI "Expand into document" (data-testid notebook-expand-to-document)
 *     → POST /api/work-canvas/drafts (provenance.sourceType='notebook').
 *
 * UWAGA cleanup: usuwanie inicjatyw NIEzaimplementowane (DELETE→404) — initiative
 *   tworzymy JEDNĄ i zostawiamy. Task/decision nie mają realnego DELETE API
 *   (/api/tasks/:id to no-op stub, brak DELETE w decisions.routes) — zostawiamy
 *   nieszkodliwe dane testowe; strony notatnika sprzątamy zawsze.
 */
import { APIRequestContext, expect, test } from '@playwright/test';

import {
  createPageApi,
  deletePageApi,
  getDefaultNotebookId,
  getPageApi,
  loadAuth,
  makeApi,
  openNote,
  openNotebook,
  req,
  setupAuth,
  uniq,
} from './_helpers';

// Treść ≥100 słów — by przejść klientowy convert-gate (wordCount≥80) dla
// report/presentation/assessment; serwer i tak konwertuje, ale trzymamy spójność z UI.
const LONG_TEXT = Array.from(
  { length: 24 },
  (_, i) =>
    `Zdanie numer ${i + 1} opisuje istotny aspekt analizowanego procesu transformacji cyfrowej w organizacji.`
).join(' ');

const CONVERT_URL = (id: string) => `/api/my-work/notebook/pages/${id}/convert`;

test.describe('M04 §4 Ekstrakcja/provenance + §5 Konwersje do encji', () => {
  test.skip(!loadAuth(), 'Brak ważnego tokenu /tmp/consultify-auth.json — uczciwy skip');
  test.setTimeout(120_000);

  let api: APIRequestContext;
  let notebookId: string;
  const trash: string[] = [];

  test.beforeAll(async () => {
    api = await makeApi();
    notebookId = await getDefaultNotebookId(api);
  });

  test.afterAll(async () => {
    for (const id of trash) await deletePageApi(api, id);
    await api.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  // ════════════════ §4 Ekstrakcja akcji + provenance ════════════════

  // ── §4.1 Ekstrakcja akcji (LLM, SSE) ───────────────────
  test('§4.1 extract-actions zwraca strukturę listy akcji (SSE 200, nie 4xx/5xx)', async () => {
    const marker = uniq('EXTRACT');
    const created = await createPageApi(
      api,
      notebookId,
      `E2E Extract ${marker}`,
      'Do zrobienia: 1. Przygotować raport kwartalny. 2. Wysłać zaproszenia na warsztat. 3. Zaktualizować budżet projektu.'
    );
    trash.push(created.id);

    const res = await req(api, 'post', `/api/my-work/notebook/pages/${created.id}/extract-actions`, {
      data: { language: 'pl' },
    });

    // Realny kontrakt: endpoint istnieje i odpowiada (NIE 404/500), nawet gdy LLM
    // zwróci pustą listę. To SSE — body to strumień zdarzeń data: {...}.
    expect(res.status(), `extract-actions → ${res.status()}`).toBe(200);
    const raw = await res.text();
    // Strumień zawiera zdarzenia 'stage'/'actions'/'done' (lub 'error' przy awarii LLM).
    expect(raw).toMatch(/data:\s*\{/);
    expect(raw).toMatch(/"type":"(actions|done|stage|error)"/);

    // Gdy ekstrakcja się powiodła — 'actions' niesie tablicę items.
    const actionsLine = raw
      .split('\n')
      .map((l) => l.replace(/^data:\s*/, '').trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.type === 'actions');
    if (actionsLine) {
      expect(Array.isArray(actionsLine.items), 'actions.items powinno być tablicą').toBeTruthy();
    }
  });

  // ── §4.2 Single task z provenance (source_type=notebook) ─
  test('§4.2 convert→task tworzy task z provenance notebook_page (readback API)', async () => {
    const marker = uniq('PROV1');
    const created = await createPageApi(api, notebookId, `E2E ProvTask ${marker}`, `Zadanie ${marker} do wykonania.`);
    trash.push(created.id);

    const res = await req(api, 'post', CONVERT_URL(created.id), { data: { target: 'task' } });
    expect(res.status(), `convert task → ${res.status()}`).toBe(201);
    const entity = await res.json();
    expect(entity.id, 'utworzony task ma id').toBeTruthy();
    expect(entity.type).toBe('task');

    // Readback "DB": task figuruje na liście z source_type=notebook, source_id=pageId.
    const list = await req(api, 'get', '/api/my-work/tasks?source=notebook&onlyOpen=false&limit=200');
    expect(list.ok(), `GET tasks → ${list.status()}`).toBeTruthy();
    const body = await list.json();
    const tasks = Array.isArray(body) ? body : body.data || body.tasks || [];
    const mine = tasks.find((t: any) => String(t.id) === String(entity.id));
    expect(mine, 'utworzony task w readbacku').toBeTruthy();
    expect(String(mine.sourceType || '').toLowerCase()).toBe('notebook');
    expect(String(mine.sourceId)).toBe(String(created.id));
  });

  // ── §4.3 Bulk provenance (wiele targetów z jednej notatki) ─
  test('§4.3 dwa converty z jednej strony → oba z provenance + 2 wpisy converted_to', async () => {
    const marker = uniq('BULK');
    const created = await createPageApi(api, notebookId, `E2E Bulk ${marker}`, `Bulk provenance ${marker}.`);
    trash.push(created.id);

    const r1 = await req(api, 'post', CONVERT_URL(created.id), { data: { target: 'task' } });
    expect(r1.status()).toBe(201);
    const e1 = await r1.json();
    const r2 = await req(api, 'post', CONVERT_URL(created.id), { data: { target: 'decision' } });
    expect(r2.status()).toBe(201);
    const e2 = await r2.json();
    expect(e1.id).not.toBe(e2.id);

    // converted_to_json strony zawiera oba wpisy (provenance po stronie źródła).
    const pageAfter = await getPageApi(api, created.id);
    const conv: any[] = pageAfter?.convertedTo || pageAfter?.converted_to || [];
    const ids = conv.map((c: any) => String(c.id));
    expect(ids, 'converted_to zawiera id task').toContain(String(e1.id));
    expect(ids, 'converted_to zawiera id decision').toContain(String(e2.id));

    // decision figuruje w readbacku z provenance notebook.
    const dl = await req(api, 'get', '/api/my-work/decisions?source=notebook&limit=200');
    expect(dl.ok()).toBeTruthy();
    const db = await dl.json();
    const decisions = Array.isArray(db) ? db : db.data || db.decisions || [];
    const dmine = decisions.find((d: any) => String(d.id) === String(e2.id));
    expect(dmine, 'utworzona decyzja w readbacku').toBeTruthy();
    expect(String(dmine.sourceType || '').toLowerCase()).toBe('notebook');
  });

  // ── §4.4 Idempotencja (dwa szybkie converty pod rząd) ───
  test('§4.4 dwa szybkie converty task → dwie odrębne encje + spójne converted_to', async () => {
    const marker = uniq('IDEM');
    const created = await createPageApi(api, notebookId, `E2E Idem ${marker}`, `Idempotencja ${marker}.`);
    trash.push(created.id);

    // Sekwencyjnie (jak guard creatingIdx w UI) — unika race read-modify-write na converted_to.
    const a = await req(api, 'post', CONVERT_URL(created.id), { data: { target: 'task' } });
    const b = await req(api, 'post', CONVERT_URL(created.id), { data: { target: 'task' } });
    expect([a.status(), b.status()].every((s) => s === 201)).toBeTruthy();
    const ea = await a.json();
    const eb = await b.json();
    // Każdy convert tworzy nową encję (brak deduplikacji to świadomy kontrakt) —
    // ale converted_to nie powinno gubić/duplikować ponad faktycznie utworzone.
    const pageAfter = await getPageApi(api, created.id);
    const conv: any[] = pageAfter?.convertedTo || pageAfter?.converted_to || [];
    const ids = conv.map((c: any) => String(c.id));
    expect(ids).toContain(String(ea.id));
    expect(ids).toContain(String(eb.id));
    // brak duplikatów tego samego id
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ════════════════ §5 Konwersje do encji ════════════════

  // ── §5.1 → task ────────────────────────────────────────
  test('§5.1 convert→task → 201 + encja z id', async () => {
    const created = await createPageApi(api, notebookId, uniq('E2E ToTask'), 'Treść do zadania.');
    trash.push(created.id);
    const res = await req(api, 'post', CONVERT_URL(created.id), { data: { target: 'task' } });
    expect(res.status(), `→ ${res.status()}`).toBe(201);
    const e = await res.json();
    expect(e.id).toBeTruthy();
    expect(e.type).toBe('task');
  });

  // ── §5.2 → decision ────────────────────────────────────
  test('§5.2 convert→decision → 201 + encja z id', async () => {
    const created = await createPageApi(api, notebookId, uniq('E2E ToDecision'), 'Treść do decyzji.');
    trash.push(created.id);
    const res = await req(api, 'post', CONVERT_URL(created.id), { data: { target: 'decision' } });
    expect(res.status(), `→ ${res.status()}`).toBe(201);
    const e = await res.json();
    expect(e.id).toBeTruthy();
    expect(e.type).toBe('decision');
  });

  // ── §5.3 → initiative (+ widoczna w GET /api/initiatives) ─
  // CLEANUP-WYJĄTEK: DELETE inicjatyw nie jest zaimplementowany (404) →
  // tworzymy JEDNĄ inicjatywę i celowo jej NIE sprzątamy.
  test('§5.3 convert→initiative → 201 + encja istnieje w GET /api/initiatives', async () => {
    const marker = uniq('Init');
    const created = await createPageApi(api, notebookId, `E2E ToInitiative ${marker}`, 'Treść do inicjatywy.');
    trash.push(created.id);
    const res = await req(api, 'post', CONVERT_URL(created.id), {
      data: { target: 'initiative', title: `E2E Initiative ${marker}` },
    });
    expect(res.status(), `→ ${res.status()}`).toBe(201);
    const e = await res.json();
    expect(e.id).toBeTruthy();
    expect(e.type).toBe('initiative');

    // Weryfikacja "DB": inicjatywa figuruje na realnej liście PMO.
    const list = await req(api, 'get', '/api/initiatives?limit=100');
    expect(list.ok(), `GET initiatives → ${list.status()}`).toBeTruthy();
    const body = await list.json();
    const items = Array.isArray(body) ? body : body.data || body.initiatives || [];
    const found = items.find(
      (it: any) => String(it.id) === String(e.id) || it.title === `E2E Initiative ${marker}` || it.name === `E2E Initiative ${marker}`
    );
    expect(found, 'utworzona inicjatywa widoczna w GET /api/initiatives').toBeTruthy();
    // brak cleanup inicjatywy (DELETE→404 by-design)
  });

  // ── §5.3-UI → initiative przez ŻYWY pill "Initiatives" ──
  test('§5.3-UI pill Initiatives → POST convert(initiative) 201 + toast', async ({ page }) => {
    const marker = uniq('UIInit');
    const created = await createPageApi(
      api,
      notebookId,
      `E2E UIInitiative ${marker}`,
      `Notatka ${marker} z konkretną treścią do przekształcenia w inicjatywę.`
    );
    trash.push(created.id);

    await openNotebook(page, notebookId);
    await openNote(page, created.title);

    // pill chipa ma title "Send to Initiatives"/"Prześlij do Inicjatyw" — disambiguacja od nawigacji
    const pill = page
      .locator('button[title="Send to Initiatives"], button[title="Prześlij do Inicjatyw"]')
      .first();
    await pill.waitFor({ state: 'visible', timeout: 15_000 });
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => /\/notebook\/pages\/[^/]+\/convert/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 25_000 }
      ),
      pill.click(),
    ]);
    expect([200, 201]).toContain(resp.status());
    const payload = resp.request().postDataJSON?.() as any;
    expect(payload?.target).toBe('initiative');

    // toast potwierdzenia (PL/EN)
    await expect(
      page.getByText(/Initiative created|Inicjatywa utworzona/i).first()
    ).toBeVisible({ timeout: 10_000 });
    // brak cleanup inicjatywy (DELETE→404 by-design)
  });

  // ── §5.4 → report (długa treść, generuje outline → wolniejsze) ─
  test('§5.4 convert→report (długa treść) → 201 + encja z id', async () => {
    const created = await createPageApi(api, notebookId, uniq('E2E ToReport'), LONG_TEXT);
    trash.push(created.id);
    const res = await req(api, 'post', CONVERT_URL(created.id), { data: { target: 'report' } });
    expect(res.status(), `→ ${res.status()}`).toBe(201);
    const e = await res.json();
    expect(e.id).toBeTruthy();
    expect(e.type).toBe('report');
  });

  // ── §5.5 → presentation (długa treść, outline) ─────────
  test('§5.5 convert→presentation (długa treść) → 201 + encja z id', async () => {
    const created = await createPageApi(api, notebookId, uniq('E2E ToPresentation'), LONG_TEXT);
    trash.push(created.id);
    const res = await req(api, 'post', CONVERT_URL(created.id), { data: { target: 'presentation' } });
    expect(res.status(), `→ ${res.status()}`).toBe(201);
    const e = await res.json();
    expect(e.id).toBeTruthy();
    expect(e.type).toBe('presentation');
  });

  // ── §5.6 → assessment (długa treść) ────────────────────
  test('§5.6 convert→assessment (długa treść) → 201 + encja z id', async () => {
    const created = await createPageApi(api, notebookId, uniq('E2E ToAssessment'), LONG_TEXT);
    trash.push(created.id);
    const res = await req(api, 'post', CONVERT_URL(created.id), {
      data: { target: 'assessment', assessmentType: 'DRD' },
    });
    expect(res.status(), `→ ${res.status()}`).toBe(201);
    const e = await res.json();
    expect(e.id).toBeTruthy();
    expect(e.type).toBe('assessment');
  });

  // ── §5.7 Provenance po konwersji (converted_to_json) ────
  test('§5.7 po convarcie strona ma status=converted + wpis w converted_to', async () => {
    const created = await createPageApi(api, notebookId, uniq('E2E Prov7'), 'Provenance po konwersji.');
    trash.push(created.id);
    const res = await req(api, 'post', CONVERT_URL(created.id), { data: { target: 'task' } });
    expect(res.status()).toBe(201);
    const e = await res.json();

    const pageAfter = await getPageApi(api, created.id);
    expect(pageAfter, 'readback strony').toBeTruthy();
    expect(String(pageAfter.status)).toBe('converted');
    const conv: any[] = pageAfter.convertedTo || pageAfter.converted_to || [];
    const match = conv.find((c: any) => String(c.id) === String(e.id));
    expect(match, 'converted_to zawiera wpis o utworzonej encji').toBeTruthy();
    expect(String(match.type)).toBe('task');
  });

  // ── §5.8 Expand into document (ŻYWE UI → POST /work-canvas/drafts) ─
  test('§5.8 "Expand into document" → POST /api/work-canvas/drafts (200/201) z provenance', async ({ page }) => {
    const marker = uniq('EXPAND');
    const created = await createPageApi(
      api,
      notebookId,
      `E2E Expand ${marker}`,
      `Notatka ${marker} do rozwinięcia w pełny dokument Canvas.`
    );
    trash.push(created.id);

    await openNotebook(page, notebookId);
    await openNote(page, created.title);

    const expandBtn = page.locator('[data-testid="notebook-expand-to-document"]').first();
    await expandBtn.waitFor({ state: 'visible', timeout: 15_000 });

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/work-canvas/drafts') && r.request().method() === 'POST',
        { timeout: 25_000 }
      ),
      expandBtn.click(),
    ]);
    expect([200, 201]).toContain(resp.status());

    // provenance w wysłanym body (sourceType=notebook)
    const sent = resp.request().postDataJSON?.() as any;
    expect(sent?.provenance?.sourceType).toBe('notebook');
    expect(String(sent?.provenance?.sourceId ?? sent?.provenance?.source_id)).toBe(String(created.id));
  });
});

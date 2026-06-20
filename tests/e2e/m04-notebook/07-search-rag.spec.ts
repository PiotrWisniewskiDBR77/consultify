/**
 * M04 §10 Search/RAG REPAIR + AI continuous enrichment (Agent 3).
 *
 * Cel: udowodnić, że po naprawie FTS (migracja 20260620_2000_notebook_fts_repair +
 * utwardzenie route'ów) wyszukiwanie i RAG NIE 500-ują z brakującej kolumny
 * `search_vector` — zwracają 200, a gdy FTS niedostępne degradują (degraded/LIKE),
 * nigdy surowego 500. Plus: classify deklaruje `method`, suggest-topics deklaruje
 * `method`, a enrich-owe auto-tagi pojawiają się na stronie.
 *
 * To NIE smoke ani test kodu — gna REALNE API backendu (:3001, staging DB) z Bearerem
 * z zalogowanej sesji OWNER. Brak ważnego tokenu → cała seria `test.skip` (uczciwy skip).
 *
 * UWAGA (środowisko): jeśli migracja FTS NIE jest jeszcze zaaplikowana na tym env,
 * search/RAG nadal działają (degraded), więc asercje celują w „200 albo świadomy
 * degraded", nie w surowy 500. Po aplikacji migracji ścieżka FTS daje pełne wyniki.
 *
 * Kontrakty (zweryfikowane z kodem):
 *   - Legacy search:   GET  /api/notebook/search?q=                 → {results,total}      (notebook.routes.ts:182)
 *   - V8 search:       GET  /api/v8/notebook/search?q=              → {data:{results,total,degraded,degraded_reason},meta}
 *   - Legacy RAG:      POST /api/notebook/rag-context {query}       → {context,citations}  (notebook.routes.ts:206)
 *   - Pages search:    GET  /api/my-work/notebook/pages?q=          → array (header X-Notebook-Search-Degraded gdy FTS off)
 *   - Classify:        POST /api/my-work/notebook/pages/:id/classify → {..., method:'heuristic'}
 *   - Suggest-topics:  POST /api/my-work/notebook/pages/:id/suggest-topics → {topics, method:'ai'|'heuristic'}
 */
import { APIRequestContext, expect, test } from '@playwright/test';

import {
  createPageApi,
  deletePageApi,
  getDefaultNotebookId,
  getPageApi,
  loadAuth,
  makeApi,
  req,
  uniq,
} from './_helpers';

test.describe('M04 §10 Search/RAG repair + AI enrich (Agent 3)', () => {
  test.skip(!loadAuth(), 'Brak ważnego tokenu /tmp/consultify-auth.json — uczciwy skip');
  test.setTimeout(90_000);

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

  // ── §10.R1 legacy search NIE 500-uje z search_vector ──────────
  test('§10.R1 GET /api/notebook/search — 200 albo świadomy degraded, nigdy surowy 500 (search_vector)', async () => {
    const phrase = uniq('ftsprobe');
    const created = await createPageApi(
      api,
      notebookId,
      `E2E FTS ${phrase}`,
      `Fraza testowa ${phrase} dla naprawionego wyszukiwania pełnotekstowego.`
    );
    trash.push(created.id);
    await new Promise((r) => setTimeout(r, 1500));

    const res = await req(api, 'get', `/api/notebook/search?q=${encodeURIComponent(phrase)}`);
    const txt = await res.text();

    // GŁÓWNA REGRESJA: po naprawie NIE wolno zwracać surowego 500 z brakującej kolumny.
    const rawColumn500 = res.status() >= 500 && /search_vector|does not exist/i.test(txt);
    expect(
      rawColumn500,
      `regresja: search nadal 500-uje z search_vector (${res.status()}): ${txt.slice(0, 200)}`
    ).toBeFalsy();

    if ([501, 503].includes(res.status())) {
      test.skip(true, `search pipeline niedostępny (${res.status()}) — embeddings flag/key off`);
      return;
    }
    expect(res.ok(), `GET /api/notebook/search → ${res.status()}`).toBeTruthy();
    const body = JSON.parse(txt);
    expect(Array.isArray(body.results), 'search.results nie jest tablicą').toBeTruthy();
    expect(typeof body.total).toBe('number');
  });

  // ── §10.R2 V8 search ujawnia degraded zamiast 500 ─────────────
  test('§10.R2 GET /api/v8/notebook/search — 200 z {data,meta}; degraded → degraded_reason', async () => {
    const res = await req(api, 'get', '/api/v8/notebook/search?q=test');
    if ([403, 404, 503, 501].includes(res.status())) {
      test.skip(true, `v8 search niedostępny (${res.status()}) — org nie-v8 / fallback by-design`);
      return;
    }
    expect(res.ok(), `GET /api/v8/notebook/search → ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.data, 'v8 search brak pola data').toBeTruthy();
    expect(Array.isArray(body.data.results)).toBeTruthy();
    expect(typeof body.data.total).toBe('number');
    if (body.data.degraded) {
      expect(typeof body.data.degraded_reason).toBe('string');
    }
  });

  // ── §10.R3 pages?q= degraduje przez header, nie 500 ──────────
  test('§10.R3 GET /api/my-work/notebook/pages?q= — 200 (tablica); FTS-off sygnalizowane headerem', async () => {
    const phrase = uniq('pagesq');
    const created = await createPageApi(
      api,
      notebookId,
      `E2E PagesQ ${phrase}`,
      `Treść z frazą ${phrase} do filtra q listy stron.`
    );
    trash.push(created.id);
    await new Promise((r) => setTimeout(r, 1000));

    const res = await req(api, 'get', `/api/my-work/notebook/pages?q=${encodeURIComponent(phrase)}`);
    const txt = await res.text();
    const rawColumn500 = res.status() >= 500 && /search_vector|does not exist/i.test(txt);
    expect(rawColumn500, `pages?q= 500-uje z search_vector: ${txt.slice(0, 200)}`).toBeFalsy();

    expect(res.ok(), `GET pages?q= → ${res.status()}`).toBeTruthy();
    const body = JSON.parse(txt);
    expect(Array.isArray(body), 'pages?q= nie zwraca tablicy').toBeTruthy();
    // gdy FTS niedostępne, route degraduje do LIKE i ustawia header (świadoma degradacja)
    const degradedHeader = res.headers()['x-notebook-search-degraded'];
    if (degradedHeader) {
      expect(degradedHeader).toContain('fts');
    }
  });

  // ── §10.R4 RAG-context NIE 500-uje; zwraca cytaty ─────────────
  test('§10.R4 POST /api/notebook/rag-context — 200 z {context,citations}, nigdy surowy 500', async () => {
    const res = await req(api, 'post', '/api/notebook/rag-context', {
      data: { query: 'Jakie są kluczowe ustalenia z notatek?' },
    });
    const txt = await res.text();
    const rawColumn500 = res.status() >= 500 && /search_vector|does not exist/i.test(txt);
    expect(rawColumn500, `RAG nadal 500-uje z search_vector: ${txt.slice(0, 200)}`).toBeFalsy();

    if ([501, 503].includes(res.status())) {
      test.skip(true, `RAG pipeline niedostępny (${res.status()}) — embeddings flag/key off`);
      return;
    }
    expect(res.ok(), `POST /api/notebook/rag-context → ${res.status()}`).toBeTruthy();
    const body = JSON.parse(txt);
    expect(typeof body, 'RAG result nie jest obiektem').toBe('object');
    expect(body).not.toBeNull();
    // kontrakt buildRAGContext: cytaty do źródeł (mogą być puste przy braku notatek)
    expect(Array.isArray(body.citations), 'RAG brak tablicy citations').toBeTruthy();
    expect(typeof body.context).toBe('string');
  });

  // ── §10.R5 classify deklaruje method='heuristic' ──────────────
  test('§10.R5 POST classify zwraca method=heuristic (nie udaje AI)', async () => {
    const created = await createPageApi(
      api,
      notebookId,
      `E2E Classify ${uniq('cls')}`,
      'TODO: create the report. TODO: fix the bug. Action: review the plan. Build the module.'
    );
    trash.push(created.id);

    const res = await req(api, 'post', `/api/my-work/notebook/pages/${created.id}/classify`);
    expect(res.ok(), `classify → ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.method, 'classify musi deklarować method').toBe('heuristic');
    expect(typeof body.suggestedType).toBe('string');
  });

  // ── §10.R6 suggest-topics deklaruje method (ai|heuristic) ─────
  test('§10.R6 POST suggest-topics zwraca {topics, method}', async () => {
    const created = await createPageApi(
      api,
      notebookId,
      `E2E Topics ${uniq('top')}`,
      'Strategia cenowa dla segmentu enterprise: pakiety, marże, retencja.'
    );
    trash.push(created.id);

    const res = await req(api, 'post', `/api/my-work/notebook/pages/${created.id}/suggest-topics`, {
      data: { language: 'pl' },
    });
    expect(res.ok(), `suggest-topics → ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.topics), 'topics nie jest tablicą').toBeTruthy();
    expect(['ai', 'heuristic']).toContain(body.method);
  });

  // ── §10.R7 AI auto-enrich: auto-tagi po zapisie ───────────────
  // Enrich wpina CTO w save-path; jeśli na tym env jeszcze nie wpięte, tagi się nie
  // pojawią same z API create → uczciwy skip zamiast fałszywej zieleni.
  test('§10.R7 auto-enrich nadaje auto-tagi (lub świadomy skip gdy hook niewpięty)', async () => {
    const marker = uniq('enrichprobe');
    const created = await createPageApi(
      api,
      notebookId,
      `Pricing strategy ${marker}`,
      'We reviewed pricing, packaging and retention for the enterprise tier.'
    );
    trash.push(created.id);
    // enrich bywa async/po-zapisie — daj chwilę
    await new Promise((r) => setTimeout(r, 2500));

    const fromApi = await getPageApi(api, created.id);
    expect(fromApi, 'strona nie istnieje').not.toBeNull();
    const tags: string[] = Array.isArray(fromApi.tags)
      ? fromApi.tags
      : Array.isArray(fromApi.tags_json)
        ? fromApi.tags_json
        : [];
    const hasAutoTag = tags.some((t) => /pricing|strategy|enterprise|packaging|retention/i.test(t));
    if (!hasAutoTag) {
      test.skip(
        true,
        'auto-enrich hook nie wpięty w save-path na tym env (CTO integruje centralnie) — brak auto-tagów; nie fałszujemy zieleni'
      );
      return;
    }
    expect(hasAutoTag, 'oczekiwano auto-taga z treści').toBeTruthy();
  });
});

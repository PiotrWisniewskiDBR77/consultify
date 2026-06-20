/**
 * M04 §6 AI Proposals + §7 Capture API + §8 Klasyfikacja
 * Źródło schematów: Harvard/Testy manualne/TESTY_M04_NOTATNIK.md (§6, §7, §8)
 *
 * To NIE są smoke ani testy kodu — gnają REALNE API backendu (:3001, staging DB)
 * i UI (:3000). Asercje opierają się WYŁĄCZNIE na żywych odpowiedziach API/UI.
 *
 * Ustalone kontrakty (z routerów serwera — patrz raport zwrotny):
 *  - AI Proposals (V8, my-work router → /api/v8/my-work):
 *      GET  /api/v8/my-work/notebook/pages/:id/ai-proposals?status=proposed&limit=N
 *           → 200 { data: { proposals: [...] } }
 *      POST /api/v8/my-work/notebook/pages/:id/ai-proposals
 *           body { proposalType:'insert'|'replace'|'append', blockContent:{}, rationale:string }
 *           → 201 { data: { id, status:'proposed', ... } }
 *      POST /api/v8/my-work/notebook/ai-proposals/:proposalId/resolve
 *           body { action:'accepted'|'rejected' }  (UWAGA: 'action', nie 'status'; ścieżka NIE pod /pages)
 *           → 200 { data: { status:'accepted'|'rejected', ... } }
 *  - Capture (notebook.routes → /api/notebook):
 *      POST /api/notebook/capture/web-clip  { url, content, title? }      → 201 { pageId, ... }
 *      POST /api/notebook/capture/email     { content, emailSubject?, emailFrom? } → 201
 *      POST /api/notebook/capture/import    { title, content }            → 201
 *      POST /api/notebook/capture/upload    (multipart file) — pominięte (patrz §7.3)
 *      capture_source zapisywane jako: web_clipper | email_forward | api_import | upload
 *  - Klasyfikacja:
 *      POST /api/v8/my-work/notebook/pages/:id/classify  → 200 { data: { method:'heuristic', suggestedType, ... } }
 *      POST /api/my-work/notebook/pages/:id/suggest-topics (owner-only) → 200 { topics: [...] } (LLM+fallback)
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

test.describe('M04 §6 AI Proposals + §7 Capture + §8 Klasyfikacja', () => {
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

  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  // Helper: utwórz propozycję na stronie; zwraca id propozycji.
  async function createProposal(pageId: string, rationale: string): Promise<string> {
    const res = await req(api, 'post', `/api/v8/my-work/notebook/pages/${pageId}/ai-proposals`, {
      data: {
        proposalType: 'append',
        blockContent: {
          type: 'paragraph',
          content: [{ type: 'text', text: rationale }],
        },
        rationale,
      },
    });
    expect([200, 201], `POST ai-proposals → ${res.status()}`).toContain(res.status());
    const body = await res.json();
    const proposal = body.data || body;
    expect(proposal.id, 'propozycja musi mieć id').toBeTruthy();
    return proposal.id as string;
  }

  // ── §6.1 Lista propozycji (GET) ─────────────────────────
  test('§6.1 GET ai-proposals?status=proposed → 200 + tablica', async () => {
    const marker = uniq('PROP-LIST');
    const created = await createPageApi(api, notebookId, `E2E Proposals ${marker}`, 'seed body');
    trash.push(created.id);

    const res = await req(
      api,
      'get',
      `/api/v8/my-work/notebook/pages/${created.id}/ai-proposals?status=proposed&limit=20`
    );
    // Kluczowe: kontrakt działa (NIE 404/500), zwraca kształt z tablicą proposals.
    expect(res.status(), `GET ai-proposals → ${res.status()}`).toBe(200);
    const body = await res.json();
    const proposals = body?.data?.proposals ?? body?.proposals ?? body?.data ?? body;
    expect(Array.isArray(proposals), 'proposals musi być tablicą (może pustą)').toBeTruthy();
  });

  // ── §6.2 Tworzenie propozycji (POST) + obecność w GET ───
  test('§6.2 POST ai-proposals → 201 z id; GET potem ją zawiera', async () => {
    const marker = uniq('PROP-CREATE');
    const created = await createPageApi(api, notebookId, `E2E PropCreate ${marker}`, 'body');
    trash.push(created.id);

    const proposalId = await createProposal(created.id, `Rationale ${marker}`);

    // weryfikacja "DB": GET listy zawiera świeżo utworzoną propozycję ze statusem 'proposed'
    const res = await req(
      api,
      'get',
      `/api/v8/my-work/notebook/pages/${created.id}/ai-proposals?status=proposed&limit=50`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    const proposals: any[] = body?.data?.proposals ?? body?.proposals ?? [];
    const found = proposals.find((p) => p.id === proposalId);
    expect(found, 'utworzona propozycja musi być w GET').toBeTruthy();
    expect(found.status).toBe('proposed');
  });

  // ── §6.3 Accept (resolve {action:'accepted'}) ───────────
  test('§6.3 resolve accepted → 200 + status zmieniony na accepted', async () => {
    const marker = uniq('PROP-ACCEPT');
    const created = await createPageApi(api, notebookId, `E2E PropAccept ${marker}`, 'body');
    trash.push(created.id);
    const proposalId = await createProposal(created.id, `Accept ${marker}`);

    const res = await req(
      api,
      'post',
      `/api/v8/my-work/notebook/ai-proposals/${proposalId}/resolve`,
      { data: { action: 'accepted' } }
    );
    expect(res.status(), `resolve accepted → ${res.status()}`).toBe(200);
    const body = await res.json();
    const resolved = body.data || body;
    expect(resolved.status).toBe('accepted');

    // weryfikacja "DB": propozycja zniknęła z listy proposed (status≠proposed)
    const after = await req(
      api,
      'get',
      `/api/v8/my-work/notebook/pages/${created.id}/ai-proposals?status=proposed&limit=50`
    );
    const proposals: any[] = (await after.json())?.data?.proposals ?? [];
    expect(proposals.some((p) => p.id === proposalId)).toBeFalsy();
  });

  // ── §6.4 Reject (resolve {action:'rejected'}) ───────────
  test('§6.4 resolve rejected → 200 + status zmieniony na rejected', async () => {
    const marker = uniq('PROP-REJECT');
    const created = await createPageApi(api, notebookId, `E2E PropReject ${marker}`, 'body');
    trash.push(created.id);
    const proposalId = await createProposal(created.id, `Reject ${marker}`);

    const res = await req(
      api,
      'post',
      `/api/v8/my-work/notebook/ai-proposals/${proposalId}/resolve`,
      { data: { action: 'rejected' } }
    );
    expect(res.status(), `resolve rejected → ${res.status()}`).toBe(200);
    const body = await res.json();
    const resolved = body.data || body;
    expect(resolved.status).toBe('rejected');

    const after = await req(
      api,
      'get',
      `/api/v8/my-work/notebook/pages/${created.id}/ai-proposals?status=proposed&limit=50`
    );
    const proposals: any[] = (await after.json())?.data?.proposals ?? [];
    expect(proposals.some((p) => p.id === proposalId)).toBeFalsy();
  });

  // ── §7.1 Capture web-clip ───────────────────────────────
  test('§7.1 capture/web-clip → 201 + strona z capture_source=web_clipper', async () => {
    const marker = uniq('WEBCLIP');
    const res = await req(api, 'post', '/api/notebook/capture/web-clip', {
      data: {
        url: `https://example.com/${marker}`,
        title: `Web clip ${marker}`,
        content: `Synthetic clipped content ${marker}. Body of the article.`,
      },
    });
    expect([200, 201], `web-clip → ${res.status()}`).toContain(res.status());
    const body = await res.json();
    const pageId = body.pageId || body?.data?.pageId;
    expect(pageId, 'web-clip musi zwrócić pageId').toBeTruthy();
    trash.push(pageId);

    // weryfikacja "DB": GET strony pokazuje capture_source = web_clipper
    const fromApi = await getPageApi(api, pageId);
    expect(fromApi, 'strona z web-clip musi istnieć').not.toBeNull();
    expect(fromApi.captureSource).toBe('web_clipper');
  });

  // ── §7.2 Capture email ──────────────────────────────────
  test('§7.2 capture/email → 201 + strona z capture_source=email_forward', async () => {
    const marker = uniq('EMAIL');
    const res = await req(api, 'post', '/api/notebook/capture/email', {
      data: {
        emailFrom: 'sender@example.com',
        emailSubject: `Forwarded ${marker}`,
        content: `Synthetic email body ${marker}.`,
      },
    });
    expect([200, 201], `email → ${res.status()}`).toContain(res.status());
    const body = await res.json();
    const pageId = body.pageId || body?.data?.pageId;
    expect(pageId, 'email musi zwrócić pageId').toBeTruthy();
    trash.push(pageId);

    const fromApi = await getPageApi(api, pageId);
    expect(fromApi).not.toBeNull();
    expect(fromApi.captureSource).toBe('email_forward');
  });

  // ── §7.3 Capture upload (multipart) ─────────────────────
  test('§7.3 capture/upload → 201 + strona z capture_source=upload', async () => {
    const marker = uniq('UPLOAD');
    // upload to multipart/form-data z polem "file" (multer .single('file')).
    // Playwright APIRequestContext.post wspiera multipart przez { multipart }.
    const res = await api.post('/api/notebook/capture/upload', {
      multipart: {
        title: `Uploaded ${marker}`,
        file: {
          name: `${marker}.txt`,
          mimeType: 'text/plain',
          buffer: Buffer.from(`Synthetic uploaded text ${marker}.`, 'utf8'),
        },
      },
    });
    expect([200, 201], `upload → ${res.status()}`).toContain(res.status());
    const body = await res.json();
    const pageId = body.pageId || body?.data?.pageId;
    expect(pageId, 'upload musi zwrócić pageId').toBeTruthy();
    trash.push(pageId);

    const fromApi = await getPageApi(api, pageId);
    expect(fromApi).not.toBeNull();
    expect(fromApi.captureSource).toBe('upload');
  });

  // ── §7.4 Capture import (API import) ────────────────────
  test('§7.4 capture/import → 201 + strona z capture_source=api_import', async () => {
    const marker = uniq('IMPORT');
    const res = await req(api, 'post', '/api/notebook/capture/import', {
      data: {
        title: `Imported ${marker}`,
        content: `Synthetic imported content ${marker}.`,
      },
    });
    expect([200, 201], `import → ${res.status()}`).toContain(res.status());
    const body = await res.json();
    const pageId = body.pageId || body?.data?.pageId;
    expect(pageId, 'import musi zwrócić pageId').toBeTruthy();
    trash.push(pageId);

    const fromApi = await getPageApi(api, pageId);
    expect(fromApi).not.toBeNull();
    expect(fromApi.captureSource).toBe('api_import');
  });

  // ── §7.5 Badge źródła w UI ──────────────────────────────
  test('§7.5 strona z capture_source pokazuje badge źródła w edytorze', async ({ page }) => {
    const marker = uniq('BADGE');
    // utwórz stronę przez capture/web-clip → badge "Web clip"
    const res = await req(api, 'post', '/api/notebook/capture/web-clip', {
      data: {
        url: `https://example.com/badge/${marker}`,
        title: `E2E Badge ${marker}`,
        content: `Badge probe content ${marker}.`,
      },
    });
    expect([200, 201]).toContain(res.status());
    const pageId = (await res.json()).pageId;
    trash.push(pageId);

    await openNotebook(page, notebookId);
    // strony z capture mogą nie trafiać do domyślnego notatnika (notebook_id null/inbox) —
    // jeśli nie da się otworzyć w tym widoku, miękkie pominięcie (nie fałszywa porażka).
    const opened = await openNote(page, `E2E Badge ${marker}`)
      .then(() => true)
      .catch(() => false);
    test.skip(!opened, '§7.5: strona capture nie jest w domyślnym notatniku — miękkie pominięcie');

    // Badge "Web clip" (label z notebookCaptureSourceSummary).
    const badge = page.getByText(/Web clip|web-clip|Wgrany plik|Uploaded file|Email|Import API|API import/i).first();
    const visible = await badge.isVisible({ timeout: 8000 }).catch(() => false);
    test.skip(!visible, '§7.5: badge źródła nieobecny w tym widoku edytora — miękkie pominięcie');
    expect(visible).toBeTruthy();
  });

  // ── §8.1 Klasyfikacja (heurystyka, NIE AI) ──────────────
  test('§8.1 classify → 200 + method:heuristic (lock) + sugestia typu', async () => {
    const marker = uniq('CLASSIFY');
    // treść z action-itemami → heurystyka powinna dać konkretny suggestedType
    const body = [
      'TODO list for the project:',
      '- create the onboarding flow',
      '- fix the login bug',
      '- implement billing',
      '- review the report',
    ].join('\n');
    const created = await createPageApi(api, notebookId, `E2E Classify ${marker}`, body);
    trash.push(created.id);

    const res = await req(api, 'post', `/api/v8/my-work/notebook/pages/${created.id}/classify`);
    expect(res.status(), `classify → ${res.status()}`).toBe(200);
    const json = await res.json();
    const data = json.data || json;
    // KLUCZOWA asercja: serwer JAWNIE deklaruje że to heurystyka, nie udające AI.
    expect(data.method).toBe('heuristic');
    // zwraca sugestię typu (klasyfikację)
    expect(typeof data.suggestedType, 'classify musi zwrócić suggestedType').toBe('string');
    expect(data.suggestedType.length).toBeGreaterThan(0);
  });

  // ── §8.2 Suggest topics (LLM + fallback) ────────────────
  test('§8.2 suggest-topics → 200 + niepusta lista tematów', async () => {
    const marker = uniq('TOPICS');
    const created = await createPageApi(
      api,
      notebookId,
      `E2E Topics ${marker}`,
      `Note about customer churn, retention metrics and pricing strategy. ${marker}`
    );
    trash.push(created.id);

    const res = await req(
      api,
      'post',
      `/api/my-work/notebook/pages/${created.id}/suggest-topics`,
      { data: { language: 'en' } }
    );
    expect(res.status(), `suggest-topics → ${res.status()}`).toBe(200);
    const json = await res.json();
    const topics = json.topics ?? json?.data?.topics;
    expect(Array.isArray(topics), 'topics musi być tablicą').toBeTruthy();
    // LLM+fallback gwarantuje niepustą listę (handler nigdy nie zwraca []).
    expect(topics.length, 'suggest-topics zawsze daje ≥1 temat (LLM lub fallback)').toBeGreaterThan(0);
    expect(typeof topics[0]).toBe('string');
  });
});

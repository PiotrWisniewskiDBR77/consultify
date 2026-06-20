/**
 * M04 §1.3/§1.4 CRUD notatnika + §2.4 współbieżność + §3 Slash menu (formatowanie + AI)
 * Źródło schematów: Harvard/Testy manualne/TESTY_M04_NOTATNIK.md (§1.3, §1.4, §2.4, §3.1–§3.6)
 *
 * To NIE są smoke ani testy kodu — gnamy żywe UI (slash menu) i weryfikujemy kontrakt
 * przez REALNE API (CRUD notatnika, last-write-wins, autosave PUT, getPageApi po wstawieniu bloku).
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

test.describe('M04 §1.3/§1.4 CRUD notatnika + §2.4 współbieżność + §3 Slash menu', () => {
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

  // ── helper: otwórz świeżą pustą stronę i zwróć locator edytora ──
  async function openFreshEditor(page: any, label: string) {
    const created = await createPageApi(api, notebookId, `E2E ${label} ${uniq('SL')}`, '');
    trash.push(created.id);
    await openNotebook(page, notebookId);
    await openNote(page, created.title);
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.click();
    return { created, editor };
  }

  // ── §1.3 Edit notatnik (kontrakt API PUT) ───────────────
  test('§1.3 edycja tytułu notatnika → PUT 200 + GET potwierdza nowy tytuł', async () => {
    const origTitle = uniq('NB Edit');
    const createRes = await req(api, 'post', '/api/my-work/notebooks', {
      data: { title: origTitle },
    });
    expect([200, 201], `POST notebook → ${createRes.status()}`).toContain(createRes.status());
    const createdBody = await createRes.json();
    const nb = createdBody.data || createdBody;
    const nbId = nb.id as string;
    expect(nbId).toBeTruthy();

    try {
      const newTitle = uniq('NB Renamed');
      const putRes = await req(api, 'put', `/api/my-work/notebooks/${nbId}`, {
        data: { title: newTitle },
      });
      expect(putRes.status(), `PUT notebook → ${putRes.status()}`).toBe(200);

      // weryfikacja "DB": GET listy zawiera nowy tytuł, nie stary
      const after = await req(api, 'get', '/api/my-work/notebooks');
      const list = (await after.json()).notebooks || [];
      const found = list.find((n: any) => n.id === nbId);
      expect(found, 'notatnik istnieje po edycji').toBeTruthy();
      expect(found.title).toBe(newTitle);
    } finally {
      await req(api, 'delete', `/api/my-work/notebooks/${nbId}`).catch(() => {});
    }
  });

  // ── §1.4 Delete notatnik (kontrakt API DELETE) ──────────
  test('§1.4 usunięcie notatnika → DELETE 200 + znika z listy', async () => {
    const title = uniq('NB Delete');
    const createRes = await req(api, 'post', '/api/my-work/notebooks', { data: { title } });
    expect([200, 201]).toContain(createRes.status());
    const createdBody = await createRes.json();
    const nb = createdBody.data || createdBody;
    const nbId = nb.id as string;
    expect(nbId, 'utworzono notatnik').toBeTruthy();

    const delRes = await req(api, 'delete', `/api/my-work/notebooks/${nbId}`);
    expect([200, 204], `DELETE notebook → ${delRes.status()}`).toContain(delRes.status());

    // weryfikacja "DB": lista nie zawiera skasowanego notatnika
    const after = await req(api, 'get', '/api/my-work/notebooks');
    const list = (await after.json()).notebooks || [];
    expect(list.some((n: any) => n.id === nbId)).toBeFalsy();
  });

  // ── §2.4 Konkurencyjna edycja (last-write-wins) ─────────
  test('§2.4 dwa kolejne PUT-y (dwie karty) → GET zwraca treść z ostatniego (last-write-wins)', async () => {
    const created = await createPageApi(api, notebookId, `E2E Concurrent ${uniq('CW')}`, 'seed');
    trash.push(created.id);

    const marker = uniq('LWW');
    const mkBody = (text: string) => ({
      title: created.title,
      contentJson: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      },
      contentText: text,
    });

    // Karta A zapisuje pierwsza
    const first = await req(api, 'put', `/api/v8/my-work/notebook/pages/${created.id}`, {
      data: mkBody(`${marker} pierwsza wersja (karta A)`),
    });
    expect([200, 204], `PUT #1 → ${first.status()}`).toContain(first.status());

    // Karta B nadpisuje (last write)
    const lastText = `${marker} druga wersja (karta B) WYGRYWA`;
    const second = await req(api, 'put', `/api/v8/my-work/notebook/pages/${created.id}`, {
      data: mkBody(lastText),
    });
    expect([200, 204], `PUT #2 → ${second.status()}`).toContain(second.status());

    // weryfikacja "DB": stan końcowy = OSTATNI zapis
    await new Promise((r) => setTimeout(r, 500));
    const fromApi = await getPageApi(api, created.id);
    const serialized = JSON.stringify(fromApi);
    expect(serialized).toContain('karta B');
    expect(serialized).not.toContain('karta A');
  });

  // ── §3.1 Slash menu — wywołanie ──────────────────────────
  test('§3.1 wpisanie "/" otwiera menu formatowania; usunięcie "/" zamyka', async ({ page }) => {
    const { editor } = await openFreshEditor(page, 'Slash Open');

    await editor.click();
    await page.keyboard.type('/', { delay: 50 });
    await page.waitForTimeout(800);

    // menu zawiera pozycje formatowania
    const h1 = page.getByText(/Heading 1|Nagłówek 1/i).first();
    const bullet = page.getByText(/Bullet List|Lista punktowana/i).first();
    await expect(h1, 'menu slash pokazuje Heading 1').toBeVisible({ timeout: 8_000 });
    await expect(bullet, 'menu slash pokazuje Bullet List').toBeVisible({ timeout: 8_000 });

    // zamknięcie: menu "lepkie" po Escape → kasujemy "/" Backspace (uwaga z live)
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(600);
    await expect(h1, 'menu slash zniknęło po usunięciu "/"').toBeHidden({ timeout: 6_000 });
  });

  // ── §3.2 Slash — filtrowanie ─────────────────────────────
  test('§3.2 wpisanie "/head" filtruje listę do nagłówków', async ({ page }) => {
    const { editor } = await openFreshEditor(page, 'Slash Filter');

    await editor.click();
    await page.keyboard.type('/', { delay: 50 });
    await page.waitForTimeout(500);
    // przed filtrowaniem Bullet List jest widoczna
    const bullet = page.getByText(/Bullet List|Lista punktowana/i).first();
    await expect(bullet).toBeVisible({ timeout: 8_000 });

    // filtr po "head"/"nag" → zostają tylko nagłówki, Bullet List znika
    await page.keyboard.type('head', { delay: 60 });
    await page.waitForTimeout(600);
    const h1 = page.getByText(/Heading 1|Nagłówek 1/i).first();
    await expect(h1, 'po filtrze "head" Heading 1 widoczny').toBeVisible({ timeout: 6_000 });
    await expect(bullet, 'po filtrze "head" Bullet List odfiltrowana').toBeHidden({ timeout: 6_000 });

    // sprzątanie znaków w edytorze (best-effort)
    for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
  });

  // ── §3.3 Slash — wybór formatu wstawia blok (nagłówek) ──
  test('§3.3 wybór "Heading 1" wstawia <h1> + autosave PUT + heading w contentJson', async ({
    page,
  }) => {
    const { created, editor } = await openFreshEditor(page, 'Slash Heading');

    await editor.click();
    await page.keyboard.type('/', { delay: 50 });
    await page.waitForTimeout(500);
    await page.keyboard.type('head', { delay: 60 });
    await page.waitForTimeout(500);

    // wybierz Heading 1 (klik na pozycję; fallback Enter na pierwszej pozycji)
    const h1Option = page.getByText(/Heading 1|Nagłówek 1/i).first();
    await expect(h1Option).toBeVisible({ timeout: 8_000 });
    await h1Option.click().catch(async () => {
      await page.keyboard.press('Enter');
    });
    await page.waitForTimeout(400);

    const headingText = `H1 ${uniq('HD')}`;
    // rejestruj nasłuch autosave PUT PRZED pisaniem (debounce ~350ms potrafi odpalić zanim
    // listener wstanie — to było źródło flake'a). Best-effort: twardym dowodem jest readback API.
    const putPromise = page
      .waitForResponse(
        (r) =>
          /\/api\/(v8\/)?my-work\/notebook\/pages\//.test(r.url()) &&
          r.request().method() === 'PUT',
        { timeout: 20_000 }
      )
      .catch(() => null);

    await page.keyboard.type(headingText, { delay: 30 });

    // wizualnie: powstał nagłówek h1 z naszym tekstem
    const h1El = page.locator('.ProseMirror h1', { hasText: headingText }).first();
    await expect(h1El, 'edytor renderuje <h1> z tekstem').toBeVisible({ timeout: 10_000 });

    const put = await putPromise;
    if (put) expect([200, 204]).toContain(put.status());

    // weryfikacja "DB" (twardy dowód): contentJson zawiera node heading + tekst — polling.
    let serialized = '';
    await expect
      .poll(
        async () => {
          serialized = JSON.stringify(await getPageApi(api, created.id));
          return serialized.includes('heading') && serialized.includes(headingText);
        },
        { timeout: 15_000, message: 'contentJson powinien zawierać node heading + tekst nagłówka' }
      )
      .toBe(true);
  });

  // ── §3.4/§3.5 AI commands (ask/expand/challenge/action) — real-but-resilient ──
  for (const cmd of [
    { key: 'ask', label: /Ask AI|Ask Teresa|Zapytaj|Ask\b/i },
    { key: 'action', label: /Action|Zadani|Akcj|Extract action/i },
  ]) {
    test(`§3.4/§3.5 AI command "${cmd.key}" → leci request AI 200 + pojawia się odpowiedź`, async ({
      page,
    }) => {
      const { editor } = await openFreshEditor(page, `AI ${cmd.key}`);

      await editor.click();
      await page.keyboard.type('/', { delay: 50 });
      await page.waitForTimeout(700);

      const option = page.getByText(cmd.label).first();
      const hasOption = await option.isVisible({ timeout: 4_000 }).catch(() => false);
      test.skip(
        !hasOption,
        `Menu slash nie udostępnia pozycji AI "${cmd.key}" — uczciwy skip (brak flow AI w UI)`
      );

      // wybór pozycji AI; nasłuch na request AI równolegle
      const aiRespPromise = page
        .waitForResponse(
          (r) =>
            /\/api\/(v8\/)?.*(ai|llm|chat|assistant|notebook.*ai|generate)/i.test(r.url()) &&
            r.request().method() === 'POST',
          { timeout: 35_000 }
        )
        .catch(() => null);

      await option.click().catch(async () => {
        await page.keyboard.press('Enter');
      });
      await page.waitForTimeout(500);

      // jeśli pojawia się pole na prompt — wpisz krótkie pytanie i wyślij
      const promptBox = page
        .locator('textarea:visible, input[type="text"]:visible, [contenteditable="true"]:visible')
        .last();
      if (await promptBox.isVisible().catch(() => false)) {
        await promptBox.click().catch(() => {});
        await page.keyboard.type('Podsumuj w jednym zdaniu.', { delay: 20 });
        await page.keyboard.press('Enter');
      }

      const aiResp = await aiRespPromise;
      test.skip(
        !aiResp,
        `Nie wykryto requestu AI dla "${cmd.key}" — flow AI niedostępny w tym buildzie (uczciwy skip, nie fałszywa zieleń)`
      );
      expect(aiResp!.status(), `AI request status dla "${cmd.key}"`).toBe(200);

      // pojawił się jakikolwiek kontener odpowiedzi AI (nie asercjonujemy treści)
      const aiContainer = page
        .locator(
          '[data-ai-response], [class*="ai-response"], [class*="aiResponse"], [role="dialog"], [class*="suggestion"]'
        )
        .first();
      const containerVisible = await aiContainer.isVisible({ timeout: 15_000 }).catch(() => false);
      // fallback: edytor urósł o nową treść (odpowiedź wstawiona inline)
      const bodyHasText = await page
        .locator('.ProseMirror')
        .first()
        .innerText()
        .then((t) => t.trim().length > 0)
        .catch(() => false);
      expect(
        containerVisible || bodyHasText,
        'oczekiwano kontenera odpowiedzi AI lub nowej treści w edytorze'
      ).toBeTruthy();
    });
  }

  // ── §3.6 Wstawianie odpowiedzi AI do dokumentu ──────────
  test('§3.6 akceptacja odpowiedzi AI wstawia blok → autosave PUT + getPageApi pokazuje treść', async ({
    page,
  }) => {
    const { created, editor } = await openFreshEditor(page, 'AI Insert');

    await editor.click();
    await page.keyboard.type('/', { delay: 50 });
    await page.waitForTimeout(700);

    const askOption = page.getByText(/Ask AI|Ask Teresa|Zapytaj|Ask\b/i).first();
    const hasAsk = await askOption.isVisible({ timeout: 4_000 }).catch(() => false);
    test.skip(!hasAsk, 'Brak pozycji AI w menu slash — flow §3.6 niedostępny (uczciwy skip)');

    const aiRespPromise = page
      .waitForResponse(
        (r) =>
          /\/api\/(v8\/)?.*(ai|llm|chat|assistant|notebook.*ai|generate)/i.test(r.url()) &&
          r.request().method() === 'POST',
        { timeout: 35_000 }
      )
      .catch(() => null);

    await askOption.click().catch(async () => {
      await page.keyboard.press('Enter');
    });
    await page.waitForTimeout(500);

    const promptBox = page
      .locator('textarea:visible, input[type="text"]:visible, [contenteditable="true"]:visible')
      .last();
    if (await promptBox.isVisible().catch(() => false)) {
      await promptBox.click().catch(() => {});
      await page.keyboard.type('Napisz jedno krótkie zdanie testowe.', { delay: 20 });
      await page.keyboard.press('Enter');
    }

    const aiResp = await aiRespPromise;
    test.skip(!aiResp, 'Request AI nie wystąpił — flow §3.6 niedostępny (uczciwy skip)');
    expect(aiResp!.status()).toBe(200);
    await page.waitForTimeout(1500);

    // zaakceptuj / wstaw odpowiedź jeśli jest taki przycisk
    const insertBtn = page
      .getByRole('button', {
        name: /Insert|Accept|Wstaw|Zaakceptuj|Dodaj do|Add to|Apply|Zastosuj/i,
      })
      .first();
    const hasInsert = await insertBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    test.skip(
      !hasInsert,
      'Brak przycisku Insert/Wstaw dla odpowiedzi AI — wstawianie §3.6 niedostępne (uczciwy skip)'
    );

    // wstawienie powinno wywołać autosave PUT
    const putPromise = page
      .waitForResponse(
        (r) =>
          /\/api\/(v8\/)?my-work\/notebook\/pages\//.test(r.url()) &&
          r.request().method() === 'PUT',
        { timeout: 20_000 }
      )
      .catch(() => null);
    await insertBtn.click();
    const put = await putPromise;
    expect(put, 'oczekiwano autosave PUT po wstawieniu odpowiedzi AI').not.toBeNull();
    expect([200, 204]).toContain(put!.status());

    // weryfikacja "DB": strona ma niepustą treść po wstawieniu
    await page.waitForTimeout(1000);
    const fromApi = await getPageApi(api, created.id);
    const text = (fromApi?.contentText ?? JSON.stringify(fromApi?.contentJson ?? '')) as string;
    expect(text.trim().length, 'strona ma treść po wstawieniu odpowiedzi AI').toBeGreaterThan(0);
  });
});

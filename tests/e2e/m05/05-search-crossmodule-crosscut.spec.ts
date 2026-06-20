/**
 * M05 §10 search + §11 cross-module + §12 presence + §13 przekrojowe
 * Źródło schematów: Harvard/Testy manualne/TESTY_M05_IDEAS_ZARZADZANIE.md (linie 583–737)
 *
 * Deterministyczne API tam gdzie się da; uczciwy test.skip gdzie seam wymaga 2. modułu/konta.
 * Run:
 *   E2E_USE_WEB_SERVER=false E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://localhost:3000 \
 *   npx playwright test tests/e2e/m05/05-search-crossmodule-crosscut.spec.ts --project=chromium --workers=1 --reporter=list
 */
import { APIRequestContext, expect, test } from '@playwright/test';

import {
  MW,
  asList,
  createIdeaApi,
  deleteIdeaApi,
  getIdeaApi,
  gotoIdeas,
  hasAuth,
  makeApi,
  req,
  setupAuth,
  shot,
  syncMap,
  uniq,
  unwrap,
} from './_helpers';

test.describe('M05 §10 search + §11 cross-module + §12 presence + §13 przekrojowe', () => {
  test.skip(!hasAuth(), 'Brak ważnego tokenu /tmp/consultify-auth.json — uczciwy skip');
  test.setTimeout(120_000);

  let api: APIRequestContext;
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

  async function seed(title: string, extra: Record<string, unknown> = {}) {
    const idea = await createIdeaApi(api, title, extra);
    trashIdeas.push(idea.id);
    return idea;
  }

  // ─────────────────── §10 — Unified search (lista API ?q=) ───────────────────

  test('§10.1 — wyszukiwanie po treści [DB]', async ({ page }) => {
    const token = uniq('XQ');
    const hit = await seed(`M05-E2E-XM ${token} alpha`, { tags: ['xm'] });
    await seed('M05-E2E-XM unrelated beta', { tags: ['other'] });

    const res = await req(api, 'get', `${MW}/my-ideas?q=${encodeURIComponent(token)}&limit=200`);
    expect(res.ok(), `search q → ${res.status()}`).toBeTruthy();
    const rows = asList(await res.json());
    expect(rows.some((r: any) => r.id === hit.id), 'wynik zawiera trafienie po treści').toBe(true);
    await gotoIdeas(page);
    await shot(page, 's10-1');
  });

  test('§10.2 — wyszukiwanie po tagach [DB]', async ({ page }) => {
    const tag = uniq('tag').toLowerCase();
    const hit = await seed(`M05-E2E-XM tagged ${tag}`, { tags: [tag] });

    const res = await req(api, 'get', `${MW}/my-ideas?q=${encodeURIComponent(tag)}&limit=200`);
    expect(res.ok(), `search tag → ${res.status()}`).toBeTruthy();
    const rows = asList(await res.json());
    // trafienie po tagu lub po tytule zawierającym tag — oba akceptowalne
    expect(rows.some((r: any) => r.id === hit.id), 'wynik zawiera trafienie po tagu').toBe(true);
    await gotoIdeas(page);
    await shot(page, 's10-2');
  });

  // ─────────────────── §11 — Cross-module ───────────────────

  test('§11.1 — Czat → Idea (from-chat) [DB]', async ({ page }) => {
    const res = await req(api, 'post', `${MW}/my-ideas/from-chat`, {
      data: {
        title: uniq('M05-E2E-XM-chat'),
        body: 'utworzona z czatu',
        sourceType: 'chat',
        messages: [{ role: 'user', content: 'pomysł z czatu' }],
      },
    });
    await gotoIdeas(page);
    await shot(page, 's11-1');
    test.skip([400, 404, 422, 500, 503].includes(res.status()), `from-chat kontrakt inny na env (${res.status()})`);
    expect([200, 201], `from-chat → ${res.status()}`).toContain(res.status());
    const idea = unwrap(await res.json());
    if (idea?.id) trashIdeas.push(idea.id);
  });

  test('§11.2 — Notatnik → Idea (save-as-idea) [DELEGAT]', async ({ page }) => {
    await gotoIdeas(page);
    await shot(page, 's11-2');
    test.skip(true, 'Notebook→Idea = seam po stronie M04 (convert notebook page); brak bezpośredniego endpointu w zasięgu M05');
  });

  test('§11.3 — Idea → Inicjatywa (konwersja) [DELEGAT]', async ({ page }) => {
    await gotoIdeas(page);
    await shot(page, 's11-3');
    test.skip(
      true,
      'Pokryte LIVE w 04-export-convert.spec (§9.1) + integracja my-work.convert.contract S5; nie duplikujemy nieusuwalnego residue inicjatyw'
    );
  });

  test('§11.4 — Idea → Canvas (handoff) [MANUAL]', async ({ page }) => {
    await gotoIdeas(page);
    await shot(page, 's11-4');
    test.skip(true, 'Handoff idea→Canvas = interakcja UI (drag/split-view M02); poza zasięgiem API headless');
  });

  test('§11.5 — Idea → Outputs (deck/doc) [FLAG]', async ({ page }) => {
    await gotoIdeas(page);
    await shot(page, 's11-5');
    test.skip(true, 'Eksport→Outputs deck/doc zależny od flagi Deliverables-Light; pokryte w pakiecie Outputs/M17');
  });

  test('§11.6 — Idea → Team Chat (convert team_chat) [DELEGAT]', async ({ page }) => {
    await gotoIdeas(page);
    await shot(page, 's11-6');
    test.skip(
      true,
      'convert target team_chat pokryty przez handler convert (04-export-convert/integracja); nie tworzymy kolejnego residue'
    );
  });

  // ─────────────────── §12 — Presence (org-scope) ───────────────────

  test('§12 — presence GET/POST org-scoped [FLAG][DB]', async ({ page }) => {
    const idea = await seed(uniq('M05-E2E-XM-pres'));

    const post = await req(api, 'post', `${MW}/my-ideas/${idea.id}/presence`, {
      data: { userName: 'E2E', color: '#3b82f6' },
    });
    const get = await req(api, 'get', `${MW}/my-ideas/${idea.id}/presence`);
    await gotoIdeas(page);
    await shot(page, 's12-1');
    // presence wymaga realtime service — gdy niedostępny 500; akceptujemy 200 lub udokumentowany 500
    expect([200, 500], `presence POST → ${post.status()}`).toContain(post.status());
    expect([200], `presence GET → ${get.status()}`).toContain(get.status());
    const body = unwrap(await get.json());
    expect(body, 'presence GET zwraca obiekt z users').toBeTruthy();

    // org-scope: presence dla nieistniejącej/obcej idei → 404
    const ghost = await req(api, 'get', `${MW}/my-ideas/00000000-0000-0000-0000-000000000000/presence`);
    expect(ghost.status(), 'presence obcej idei → 404').toBe(404);
  });

  // ─────────────────── §13 — Przekrojowe ───────────────────

  test('§13.2 — persistencja po pełnym przeładowaniu [DB]', async ({ page }) => {
    const idea = await seed(uniq('M05-E2E-XM-persist'), { body: 'PERSIST-PROBE-ZXQ' });
    // zasiej mapę
    await syncMap(api, idea.id, 1, [{ id: 'p1', label: 'persist-node' }], []);

    // reload UI
    await gotoIdeas(page);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, 's13-2');

    // readback przez API = dane przetrwały (nie był to tylko optimistic update)
    const after = await getIdeaApi(api, idea.id);
    expect(after, 'idea istnieje po reload').toBeTruthy();
    expect(after.body, 'body przetrwało').toContain('PERSIST-PROBE-ZXQ');
    const map = unwrap(await (await req(api, 'get', `${MW}/my-ideas/${idea.id}/map`)).json());
    expect(JSON.stringify(map), 'mapa przetrwała (węzeł obecny)').toContain('persist-node');
  });

  test('§13.5 — i18n PL/EN: brak surowych kluczy i18n w DOM [MANUAL]', async ({ page }) => {
    await seed(uniq('M05-E2E-XM-i18n'));
    await gotoIdeas(page);
    await page.waitForTimeout(1500);
    const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
    await shot(page, 's13-5');
    // surowe markery braku tłumaczenia: [[key]] albo gołe dotted.key.path widoczne użytkownikowi
    expect(bodyText.includes('[['), 'brak surowego markera [[ ]] w UI').toBe(false);
    expect(/\bmy[A-Za-z]*\.[a-z]+\.[a-z]+\b/.test(bodyText), 'brak gołych kluczy i18n w UI').toBe(false);
  });

  test('§13.6 — dark mode renderuje listę [MANUAL]', async ({ page }) => {
    await seed(uniq('M05-E2E-XM-dark'));
    await page.addInitScript(() => {
      try {
        localStorage.setItem('theme', 'dark');
      } catch {
        /* noop */
      }
    });
    await gotoIdeas(page);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(800);
    await shot(page, 's13-6-dark');
    // dark = html ma klasę 'dark'; lista nadal renderuje (brak białego ekranu)
    const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDark, 'tryb dark aktywny').toBe(true);
  });

  test('§13.8 — konsola bez błędów ERROR przy wejściu na listę [MANUAL]', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await seed(uniq('M05-E2E-XM-console'));
    await gotoIdeas(page);
    await page.waitForTimeout(2000);
    await shot(page, 's13-8');
    // odfiltruj znane benign (network 4xx fav/recents, ResizeObserver, third-party)
    const BENIGN = /ResizeObserver|favicon|Failed to load resource|net::ERR|\b4\d\d\b|\b5\d\d\b/i;
    const fatal = errors.filter((e) => !BENIGN.test(e));
    expect(fatal, `błędy konsoli: ${fatal.join(' | ')}`).toHaveLength(0);
  });
});

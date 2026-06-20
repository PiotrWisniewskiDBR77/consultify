# BRIEF AGENTA — M07 Ideas · Process Flow · DOKOŃCZENIE DO ODBIORU 8/8

> Wklej jako pierwszą wiadomość do świeżego czata. Kontekst **tylko M07**. Cel: **MODUŁ ZAMKNIĘTY (8/8)**.

## Rola i cel
Agent-wykonawca **M07 Ideas — Process Flow** (`…/workspace/process_flow` — diagramy procesów z lanes, metryki kroków czas/koszt/FTE, VSM, KPI, AI Coach). Domykasz bramki z [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md): **Kod · DoD 7/7 · Epiki 6/6 · Kod-testy · Manual (Playwright) · UI · →F · →UI**. Dowód, nie deklaracja. Tylko M07.

## ⚡ Równoległość — ODPALAJ SUB-AGENTÓW
Rozdaj na: **edytor diagramu/lanes · metryki+VSM/KPI · AI Coach · testy (w tym naprawa martwego mocka — niżej)+i18n**.

## Kontekst PULI IDEAS (wspólny)
- Ideas = narzędzia My Work, record-based binding (`my_idea_maps.nodes_json`). Wspólna infra: blob-sync `useIdeaMapSync`, WS gateway `ideaCollabWs.gateway.ts` (wspólny z M06/M09). Beta `MYWORK_IDEAS` **closed**; **R6 live pending**.
- **WAŻNE — V8 mirror WYCIĘTY (DP-7 CUT 2026-06-17):** ścieżka kanoniczna to **blob-sync**, nie serwerowy mirror. NIE przywracaj `processFlowService.ts`/`v8/processFlow.routes.ts` (usunięte). `develop` readback czyta blob (`my-work.routes.ts:6088`).

## Źródła prawdy
- Repo: `…/consultify` · branch **Londyn** · **Tabela (wiersz M07):** `_STAN_PRACY_ODBIORY.md` · **Teczka:** `M07-ideas-process-flow.md` · **Spec (94 scenariusze):** `../Testy manualne/TESTY_M07_IDEAS_PROCESS_FLOW.md`

## Stan wejściowy M07 (zweryfikowany 2026-06-19)
**Zamknięte:** L-01 V8 mirror CUT (DP-7), L-02 WS org-scope + test 6/6 (`ideaCollabWs.orgscope.test.ts`). L-03/L-05/L-06 nieaktualne po CUT.
**Do domknięcia:**
- 🔧 **NAPRAW MARTWY TEST (znaleziony 2026-06-19):** `tests/integration/routes/my-work.home.fail-closed.contract.test.ts:91` zawiera `vi.mock('.../services/v8/processFlowService.js')` na **nieistniejący plik** (po CUT) + ten test **failuje** z osobnego powodu: mock `auth.middleware` eksportuje tylko `verifyToken`, brak `requireRole` → `Error: No "requireRole" export`. Napraw mock (dodaj `requireRole`) i usuń martwy `vi.mock`. To koryguje wcześniejszą deklarację teczki „0 server-side testów".
- **L-04** Edge UX (orthogonal/waypoints/swimlane resize) = **P2 enhancement, odroczone** — potwierdź odroczenie, nie buduj w tej fali.
- **L-03 hooki FE** (`useProcessFlowAIProposal.ts`, `useProcessFlowCRUD.ts`) = inert+fail-safe (gated `enabled:false`) — potwierdź że nieszkodliwe.
- i18n **252×** — Faza 4.

## Procedura → 8/8
1. **Kod** — napraw martwy test/mock (wyżej); potwierdź blob-sync ścieżkę. 2. **DoD 7/7**. 3. **Epiki 6/6**. 4. **Kod-testy** zielone (po naprawie mocka). 5. **Manual (Playwright)**. 6. **UI/UX** + a11y/dark live. 7. **→UI** 12 ekranów.

## Weryfikacja LIVE
`preview_start` `frontend-dev`+`backend-dev` (staging). Chrome MCP zalogowany: `navigate http://localhost:3000/my-work/ideas` → Process Flow. Sprawdź: dodaj kształt/lane, metryki kroku, auto-layout, VSM/KPI, AI Coach, eksport PNG, persystencja blob po reload. Dowód = screenshot + Network + logi.

## Testy manualne = Playwright + screenshoty (bramka „Manual N/N")
94 scenariusze z `TESTY_M07_…` jako **specy Playwright** (`tests/e2e/`). Każdy: **`page.screenshot({ path: 'tests/e2e/screenshots/m07/<id>.png' })`**. Krytyczne: draw-connection, persystencja po reload — ze screenshotem. Bramka „Manual" = tylko z `.png`.

## Twarde zasady
Tylko M07. NIGDY `git add -A`/`.`. prod=centerbeam: bez zgody. NIE przywracaj wyciętego V8 mirror. Sekrety/env = Piotr. UI: live+screenshot. Weryfikuj zanim ogłosisz.

## Co zwracasz
Wiersz M07 w trackerze + raport: bramki z dowodem, status **8/8** albo co zostało.

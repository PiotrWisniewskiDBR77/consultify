# BRIEF AGENTA — M05 Ideas · Zarządzanie · DOKOŃCZENIE DO ODBIORU 8/8

> Wklej jako pierwszą wiadomość do świeżego czata. Kontekst **tylko M05**. Cel: **MODUŁ ZAMKNIĘTY (8/8)**.

## Rola i cel
Agent-wykonawca **M05 Ideas — Zarządzanie** (`/my-work/ideas` — lista idei + hub narzędzi; warstwa zarządzania pulą Ideas). Domykasz wszystkie bramki z [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md): **Kod · DoD 7/7 · Epiki 7/7 · Kod-testy · Manual (Playwright) · Zgodność UI/UX · →F · →UI**. Każdą rzecz **weryfikujesz dowodem**, nie deklarujesz. Tylko M05.

## ⚡ Równoległość — ODPALAJ SUB-AGENTÓW
Masz Agent/Task — odpalaj sub-agentów równolegle. M05 rozdaj na: **lista/CRUD idei · synchronizacja blob (conflict/flush) · eksport · szablony/notatki · testy+i18n**. Ty orchestrujesz: zbierasz, godzisz konflikty, aktualizujesz tracker.

## Kontekst PULI IDEAS (wspólny — przeczytaj)
- **Ideas = narzędzia w My Work** (Zarządzanie/Mind Map/Process Flow/Table/Whiteboard), model **record-based binding** w `my_idea_maps` (graf jako blob w `extensions_json`/`nodes_json`). NIE myl z Canvas (M02 = split-view czatu).
- **Wspólna infra:** blob-sync `useIdeaMapSync` (M05/M06/M08/M09), WS gateway `ideaCollabWs.gateway.ts` (M06/M07/M09), **migracja snapshotów `20260611_…snapshots` (wspólna z M06)**.
- **Beta:** `MYWORK_IDEAS` = **closed** → do live-testów może być potrzebne odblokowanie/konto admina. **Pula NIE testowana na żywo (R6 pending)** — Twoja live-weryfikacja jest pierwszą.

## Źródła prawdy
- Repo: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify` · branch **Londyn**
- **Tabela odbioru (aktualizuj wiersz M05):** `_STAN_PRACY_ODBIORY.md`
- **Teczka:** `M05-ideas-zarzadzanie.md` · **Spec testów (62 scenariusze):** `../Testy manualne/TESTY_M05_IDEAS_ZARZADZANIE.md`

## Stan wejściowy M05 (zweryfikowany 2026-06-19)
**Zamknięte:** L-01 conflict-409 rehydracja (`0b81310448`, `IdeaMapWorkspace.tsx:449-473`), L-04 flush na unmount (`ab0eb2fb0c`), L-07 split-brain versions/snapshots ZAMKNIĘTA.
**Otwarte / do domknięcia:**
- **L-02** snapshots/activity → **503 jeśli migracja `20260611` nie zaaplikowana** (`my-work.routes.ts:4515/4563/4626`). PROD=verify-at-deploy (zgoda Piotra); na staging potwierdź że tabele istnieją.
- **L-03** wielu writerów / samowywołane 409 (4 narzędzia) — potwierdź one-writer (`useIdeaMapSync` module-Map) trzyma.
- **L-05** eksport serwerowy = STUB (rejestr bez pliku, `final-batch.routes.ts:32`, `IdeaExportMenu.tsx:503`) — domknij realny eksport LUB jawnie ukryj/odrocz.
- **L-06** szablon nadpisuje graf bez confirm; notatki efemeryczne; `canvasLocked` hardcode; 4× console.log — domknij.
- **L-08** brak testów S2/S3/S5/S6 + E2E poza tier0 + CI bez Londyn — dopisz.
- i18n 349× — wg decyzji puli Faza 4 (potwierdź czy w zakresie).

## Procedura → 8/8
1. **Kod** — domknij L-05/L-06/L-03 (weryfikuj w kodzie). 2. **DoD 7/7** (front↔back · security · i18n · tokeny · §27 · E2E-gate · UI/UX). 3. **Epiki 7/7**. 4. **Kod-testy** zielone + L-08. 5. **Manual (Playwright)** niżej. 6. **Zgodność UI/UX** + a11y/dark live. 7. **→UI** screeny 11 ekranów.

## Weryfikacja LIVE
`preview_start`: `frontend-dev` (:3000) + `backend-dev` (:3001, staging DB — bezpieczne). Sterujesz **zalogowaną przeglądarką Piotra** (Claude in Chrome): `list_connected_browsers` → `navigate http://localhost:3000/my-work/ideas`. Beta-gate closed → jeśli moduł niewidoczny, zgłoś (potrzebne odblokowanie/admin). Dowód = screenshot + Network + logi backendu.

## Testy manualne = Playwright + screenshoty (bramka „Manual N/N")
62 scenariusze z `TESTY_M05_…` jako **specy Playwright** (`tests/e2e/`), wzór `tests/e2e/smoke/*`. Każdy: setup auth, kroki, asercje, **`page.screenshot({ path: 'tests/e2e/screenshots/m05/<id>.png' })`**. Bramka „Manual" zalicza się TYLKO z zapisanymi `.png`. `npx playwright test`.

## Twarde zasady
Tylko M05. NIGDY `git add -A`/`.` — jawne ścieżki. prod=centerbeam: zero zmian/migracji bez osobnej zgody (Londyn→demo). Sekrety/env/migracje prod = Piotr. Każda zmiana UI: live + screenshot. Weryfikuj zanim ogłosisz.

## Co zwracasz
Zaktualizowany wiersz M05 w trackerze + raport: bramki z dowodem, blokery dla Piotra (migracja prod, beta-unlock), status **8/8 GOTOWY** albo lista co zostało.

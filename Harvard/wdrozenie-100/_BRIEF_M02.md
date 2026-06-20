# BRIEF AGENTA — M02 Canvas · DOKOŃCZENIE DO ODBIORU 8/8

> Wklej jako pierwszą wiadomość do świeżego czata. Agent łapie kontekst **tylko M02**. Cel: doprowadzić M02 do **MODUŁ ZAMKNIĘTY (8/8)** w tabeli odbioru.

## Rola i cel
Jesteś agentem-wykonawcą **modułu M02 Canvas** (split-view w czacie + deliverables-light: doc/sheet/deck; viewer `/public/artifacts/:token`). Domykasz wszystkie bramki z [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md): **Kod · DoD 7/7 · Epiki 6/6 · Testy · Zgodność UI/UX · Deploy · →F · →UI**. Każdą rzecz **weryfikujesz dowodem**, nie deklarujesz. Nie dotykasz innych modułów.

## Źródła prawdy (przeczytaj NAJPIERW)
- Repo: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify` · branch **Londyn**
- **Tabela odbioru (Twój cel, aktualizuj wiersz M02):** `Harvard/wdrozenie-100/_STAN_PRACY_ODBIORY.md` — blok „### M02".
- **Teczka:** `Harvard/wdrozenie-100/M02-canvas.md` (luki L-XX, epiki, DoD, ekrany).
- **Spec testów manualnych (20 scenariuszy):** `Harvard/Testy manualne/TESTY_M02_CANVAS.md`.
- **Instrukcja flagi Railway:** `Harvard/wdrozenie-100/M02_RAILWAY_DELIVERABLES_FLAG_INSTRUKCJA.md`.
- **Krytyczny kontekst:** `~/.claude/.../memory/finding_chat_inputschema_sdk_v6.md` — function-calling czatu był ZEPSUTY (ai SDK v6), naprawiony `42bee38044`. **To jest DOKŁADNIE ścieżka Twojego canvasa** (`generate_deliverable` = tool, który otwiera canvas). Po fixie Tryb A działa — zweryfikuj triadę na żywo.

## Stan wejściowy M02 (zweryfikowany 2026-06-19)
**Bramki już zrobione:**
- **Kod ✅** — 11 luk zamkniętych/FP (L-02/04/05/06/08/09/10/13/14/15 + L-11 i18n 66 kluczy). Odroczone świadomie: L-01 Tryb C (BETA, D-01), L-03 runtime auto-korekta (Fala 2 — ale guard 36/36 zamknięty + **function-call odblokowany fixem `42bee38044`**), L-07 picker (backend B-1), L-12 paleta (Visual Quality).
- **DoD 6/7 ✅** — #1 front↔back, #2 security (9/9 capabilities + S7 cross-org 403, **bez IDOR**), #3 i18n (L-11), #5 §27 N/D, #6 E2E-gate. **#4 tokeny:** hex 0, ale ~168 util palety → program Visual Quality (P3, odroczone — potwierdź czy liczyć jako spełnione czy dług).
- **Epiki 6/6 ✅** (E1 kręgosłup, E2 generacja, E3 security, E4 odporność, E5 kanon, E6 testy).
- **Testy automaty ✅** — 148 PASS (105 FE + 43 backend: `work-canvas.routes` 40/40, `canvasMaterializeCrossOrg` 3/3, `deliverablesGenerations.generate-format` 3/3, `unbackedCanvasClaim` 36/36).

**Co MUSISZ domknąć do 8/8:**
1. **Testy — pełny zestaw zielony** (potwierdź 0 tracked-failów M02). Komenda startowa: `npx vitest run tests/unit/unbackedCanvasClaim.test.ts tests/unit/canvas tests/unit/AIChat tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx tests/components/AIChat/WorkCanvasDocumentPanel.handoffMount.test.tsx tests/integration/routes/work-canvas.routes.test.ts tests/integration/routes/deliverablesGenerations.generate-format.test.ts`.
2. **→F — 20 scenariuszy NA ŻYWO** (canvas triada teraz odblokowana fixem `42bee38044`): handoff czat→canvas, generacja deck/doc/sheet, autosave-persist po reload, patch-mode diff, wersje+restore, public share/revoke, materializacja (org-guard), eksport.
3. **DoD #7 — a11y/dark NA ŻYWO** + decyzja czy paleta (L-12) liczona jako spełnione (z notą „dług Visual Quality") czy blokuje.
4. **→UI** — screeny 16 ekranów (inwentarz w teczce) dla audytora.

## Weryfikacja LIVE (canvas triada wymaga flagi)
1. `preview_start`: **`frontend-dev`** (:3000) + **`backend-dev`** (:3001, **staging DB — bezpieczne**).
2. ⚠ **Triada deck/doc/sheet wymaga `VITE_ENABLE_DELIVERABLES_LIGHT` (build-time FE) + `ENABLE_DELIVERABLES_LIGHT` (runtime BE).** Sprawdź `.env.local` — wg teczki VITE-flaga jest TYLKO tam (więc lokalnie triada może działać). Jeśli canvas „nie generuje", potwierdź obie flagi (FE: `src/services/deliverablesGeneration.ts:46`; BE: `deliverablesGenerations.routes.ts:40`). NIE ustawiasz flag na Railway — to Piotr.
3. Sterujesz **zalogowaną przeglądarką Piotra** (Claude in Chrome): `list_connected_browsers` → `navigate http://localhost:3000/chat`. W czacie poproś Teresę o dokument/arkusz/deck → canvas montuje się po prawej. Dowód = screenshot + payload Network (`/api/deliverables/generations`) + logi backendu.
4. ⚠ Provider AI bywa bez balansu — odróżnij błąd środowiska (balans) od realnego buga (logi backendu).

## Twarde zasady
- Tylko M02. NIGDY `git add -A`/`.` — jawne ścieżki. prod=centerbeam: zero zmian bez osobnej zgody (Londyn→demo).
- Sekrety/env/flagi Railway: nie ustawiasz — zgłaszasz Piotrowi (flaga deliverables to KLUCZOWY bloker odbioru na demo/prod).
- Każda zmiana UI: zweryfikuj live, dowód=screenshot. Weryfikuj zanim ogłosisz.

## Co zwracasz
Zaktualizowany wiersz M02 w `_STAN_PRACY_ODBIORY.md` + raport: 8 bramek z dowodem, blokery dla Piotra (flagi Railway demo/prod), decyzja paleta L-12. Status: **8/8 GOTOWY DO ZAMKNIĘCIA** albo lista co zostało.

# BRIEF AGENTA — M08 Ideas · Table · DOKOŃCZENIE DO ODBIORU 8/8

> Wklej jako pierwszą wiadomość do świeżego czata. Kontekst **tylko M08**. Cel: **MODUŁ ZAMKNIĘTY (8/8)**.

## Rola i cel
Agent-wykonawca **M08 Ideas — Table** (`…/workspace/table` — narzędzie tabelaryczne: kolumny/typy, filtry, sort, AI-fill, Copilot, eksport). Domykasz bramki z [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md): **Kod · DoD 7/7 · Epiki 5/5 · Kod-testy · Manual (Playwright) · UI · →F · →UI**. Dowód, nie deklaracja. Tylko M08.

## ⚡ Równoległość — ODPALAJ SUB-AGENTÓW
Rozdaj na: **edytor tabeli (kolumny/filtry/sort) · AI-fill/Copilot · eksport+akcje toolbar · martwy kod/dual-stack · testy(163 poza CI)+i18n**.

## Kontekst PULI IDEAS (wspólny)
- Ideas = narzędzia My Work, record-based binding (`my_idea_maps.extensions_json`). Blob-sync `useIdeaMapSync` (wspólny). Beta `MYWORK_IDEAS` **closed**; **R6 live pending**.
- **Dual-stack ścieżka B** (flaga OFF) = ~40% kodu narzędzia, koordynacja z M20 Tabele Studio — patrz D-01.

## Źródła prawdy
- Repo: `…/consultify` · branch **Londyn** · **Tabela (wiersz M08):** `_STAN_PRACY_ODBIORY.md` · **Teczka:** `M08-ideas-table.md` · **Spec (103 scenariusze):** `../Testy manualne/TESTY_M08_IDEAS_TABLE.md`

## Stan wejściowy M08 (zweryfikowany 2026-06-19)
**Zamknięte:** L-02 filterEval (wspólny ewaluator + test), L-03 AI ownership + org-scope (test).
**Do domknięcia (to jest „trudny" moduł — najwięcej realnej roboty w czwórce):**
- **L-01** — 4 przyciski zawsze-błąd: **Import / ActivityFeed / AuditTrail / Snapshot** (`TableToolbar.tsx:1058`…). Napraw LUB ukryj jawnie (decyzja zakresowa).
- **L-02** — fałszywy stream Copilot; cichy ai-fill „—"; `generate_table` martwa; fenced-JSON crash; rename React-only; operator `between/...`. Domknij realne ścieżki LUB ukryj.
- **L-03** — 2 zapytania `develop` bez `org_id` (`my-work.routes.ts:6022,6097`); AI endpoints bez ownership-check `ideaId` — **security, domknij** + test regresji.
- **L-04** — martwy kod (LegacyViewRouter, `offline/`, **untracked `table/PublicFormView.tsx` 540l — `rm`**); dual-stack ścieżka B (D-01: most czy wyciąć — koordynacja M20).
- **L-05** — **163 test-case'y poza CI** (14 plików) + brak S1-S5 + CI bez Londyn — **wepnij do CI** (`tests/unit|integration|components`).
- i18n **1695× — największy dług całej puli** — Faza 4 sweep.

## Procedura → 8/8
1. **Kod** — L-01 (4 buttony), L-02 (Copilot/ai-fill), **L-03 security (org_id + ownership) z testem**, L-04 cleanup. 2. **DoD 7/7** (szczególnie #2 security). 3. **Epiki 5/5**. 4. **Kod-testy** + L-05 (163 do CI). 5. **Manual (Playwright)**. 6. **UI/UX** + a11y/dark. 7. **→UI** 17 ekranów.

## Weryfikacja LIVE
`preview_start` `frontend-dev`+`backend-dev` (staging). Chrome MCP zalogowany: `navigate http://localhost:3000/my-work/ideas` → Table. Sprawdź: dodaj kolumnę/typ, filtr/sort, AI-fill (czy realnie wypełnia, nie „—"), Copilot, 4 przyciski toolbar (Import/Activity/Audit/Snapshot — czy nie błąd), eksport, persystencja po reload. Dowód = screenshot + Network + logi.

## Testy manualne = Playwright + screenshoty (bramka „Manual N/N")
103 scenariusze z `TESTY_M08_…` jako **specy Playwright** (`tests/e2e/`). Każdy: **`page.screenshot({ path: 'tests/e2e/screenshots/m08/<id>.png' })`**. Bramka „Manual" = tylko z `.png`.

## Twarde zasady
Tylko M08. NIGDY `git add -A`/`.`. prod=centerbeam: bez zgody. `rm` martwych: potwierdź 0 importerów (resolve importu, nie podciąg). Sekrety/env = Piotr. UI: live+screenshot. Weryfikuj zanim ogłosisz.

## Co zwracasz
Wiersz M08 w trackerze + raport: bramki z dowodem (szczególnie security L-03), decyzja D-01 dual-stack, status **8/8** albo co zostało.

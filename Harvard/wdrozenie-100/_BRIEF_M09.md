# BRIEF AGENTA — M09 Ideas · Whiteboard · DOKOŃCZENIE DO ODBIORU 8/8

> Wklej jako pierwszą wiadomość do świeżego czata. Kontekst **tylko M09**. Cel: **MODUŁ ZAMKNIĘTY (8/8)**. **To najcięższy moduł puli (audyt 49/100, rozmiar L).**

## Rola i cel
Agent-wykonawca **M09 Ideas — Whiteboard** (`…/workspace/whiteboard` — tablica współpracy: kształty, sticky, NodeResizer, realtime, sesja facilitacji, voting). Domykasz bramki z [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md): **Kod · DoD 7/7 · Epiki 6/6 · Kod-testy · Manual (Playwright) · UI · →F · →UI**. Dowód, nie deklaracja. Tylko M09.

## ⚡ Równoległość — ODPALAJ SUB-AGENTÓW
Rozdaj na: **kanwa/kształty/NodeResizer · realtime (WS graph_patch) · sesja facilitacji/role/voting/governance · obrazy base64 · testy(WS/shared board)+i18n**.

## Kontekst PULI IDEAS (wspólny)
- Ideas = narzędzia My Work, record-based binding (`my_idea_maps`). WS gateway `ideaCollabWs.gateway.ts` (wspólny z M06/M07). Beta `MYWORK_IDEAS` **closed**; **R6 live pending**.
- **Multiplayer model (DP-3, decyzja 2026-06-18):** realtime org-scope `graph_patch` = v1 (`5928262e0f`: org-read fallback daje 2. uczestnikowi 200 zamiast 404). **Shared-WRITE persistence = świadomy v1.1 backlog** (nie-właściciel widzi na żywo, ale NIE utrwala do kanonicznej tablicy) — NIE forsuj shared-write w tej fali.

## Źródła prawdy
- Repo: `…/consultify` · branch **Londyn** · **Tabela (wiersz M09):** `_STAN_PRACY_ODBIORY.md` · **Teczka:** `M09-ideas-whiteboard.md` · **Spec (126 scenariuszy):** `../Testy manualne/TESTY_M09_IDEAS_WHITEBOARD.md`

## Stan wejściowy M09 (zweryfikowany 2026-06-19)
**Zamknięte:** L-01 multiplayer org-read fallback (`my-work.routes.ts:3588`, realtime=v1, test `map-orgread.contract`), L-02 whiteboard `graph_patch` (`whiteboard/useWhiteboardCollab.ts` + test), L-03 WS+facilitation org-scope.
**Do domknięcia:**
- **L-04** — stan sesji nieczytany (0 call-sites); **role samonadawane** (powinny z serwera); governance FE-only; voting niespójny — domknij (security/poprawność sesji facilitacji).
- **L-05** — martwy kod; kształty; NodeResizer (wg notatek wpięty 2026-06-17 — potwierdź); obrazy base64.
- **L-06** — **brak testów WS/shared board + E2E** (`tests/unit/MyWork/`, `tests/integration/mywork/`) — dopisz (P0-test).
- **D-02** obrazy base64 (limit body 10MB) — cap rozmiaru lub object storage (decyzja Piotra).
- i18n — Faza 4.

## Procedura → 8/8
1. **Kod** — L-04 (sesja/role z serwera/governance/voting), L-05 (martwy kod/kształty). 2. **DoD 7/7**. 3. **Epiki 6/6**. 4. **Kod-testy** + L-06 (WS/shared board). 5. **Manual (Playwright)**. 6. **UI/UX** + a11y/dark. 7. **→UI** 11 ekranów.

## Weryfikacja LIVE
`preview_start` `frontend-dev`+`backend-dev` (staging). Chrome MCP zalogowany: `navigate http://localhost:3000/my-work/ideas` → Whiteboard. **Realtime/sesja: testuj 2 kartami** (`tabs_create_mcp`) — kształt z jednej widoczny w drugiej (org-read fallback = 2. uczestnik 200). Sprawdź: kształty, sticky, NodeResizer, obraz, sesja facilitacji/role/voting. Dowód = screenshot + Network/WS + logi.

## Testy manualne = Playwright + screenshoty (bramka „Manual N/N")
126 scenariuszy z `TESTY_M09_…` jako **specy Playwright** (`tests/e2e/`). Każdy: **`page.screenshot({ path: 'tests/e2e/screenshots/m09/<id>.png' })`**. Realtime: dwa konteksty/karty w jednym specie (drugi uczestnik widzi patch). Bramka „Manual" = tylko z `.png`.

## Twarde zasady
Tylko M09. NIGDY `git add -A`/`.`. prod=centerbeam: bez zgody. Shared-WRITE = v1.1, NIE forsuj. Sekrety/env = Piotr. UI: live+screenshot. Weryfikuj zanim ogłosisz.

## Co zwracasz
Wiersz M09 w trackerze + raport: bramki z dowodem (L-04 sesja/role, L-06 testy WS), decyzja D-02 obrazy, status **8/8** albo co zostało.

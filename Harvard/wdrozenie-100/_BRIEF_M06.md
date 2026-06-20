# BRIEF AGENTA — M06 Ideas · Mind Map · DOKOŃCZENIE DO ODBIORU 8/8

> Wklej jako pierwszą wiadomość do świeżego czata. Kontekst **tylko M06**. Cel: **MODUŁ ZAMKNIĘTY (8/8)**.

## Rola i cel
Agent-wykonawca **M06 Ideas — Mind Map** (`…/workspace/mindmap` — edytor mapy myśli z węzłami/krawędziami, AI overlays, collab realtime, eksport). Domykasz bramki z [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md): **Kod · DoD 7/7 · Epiki 7/7 · Kod-testy · Manual (Playwright) · UI · →F · →UI**. Dowód, nie deklaracja. Tylko M06.

## ⚡ Równoległość — ODPALAJ SUB-AGENTÓW
Rozdaj na: **edytor węzłów/krawędzi · collab realtime (WS) · AI overlays (sentiment/clustering) · eksport (PNG/PPT) · testy+i18n**. Ty orchestrujesz.

## Kontekst PULI IDEAS (wspólny)
- Ideas = narzędzia My Work, record-based binding (`my_idea_maps`). Wspólna infra: blob-sync `useIdeaMapSync`, **WS gateway `ideaCollabWs.gateway.ts` (wspólny z M07/M09)**, migracja snapshotów `20260611` (wspólna z M05).
- **Realtime model:** org-scope broadcast `graph_patch` (`/ws/collab/:ideaId`); per-user `/map` persystencja. Beta `MYWORK_IDEAS` **closed** → live może wymagać admina. **R6 live pending.**

## Źródła prawdy
- Repo: `…/consultify` · branch **Londyn** · **Tabela (wiersz M06):** `_STAN_PRACY_ODBIORY.md` · **Teczka:** `M06-ideas-mind-map.md` · **Spec (121 scenariuszy):** `../Testy manualne/TESTY_M06_IDEAS_MIND_MAP.md`

## Stan wejściowy M06 (zweryfikowany 2026-06-19)
**Zamknięte:** L-01 WS org-scope (`ideaCollabWs.gateway.ts:237` → 403+destroy, test istnieje), L-03 korupcja „rose" (0), L-05 flush (sendBeacon).
**Otwarte / do domknięcia:**
- **L-04** ExportPPT myląca etykieta; sidekick w próżnię; **AI overlays — potwierdź czy realny LLM** (`Api.getMyIdeaAISuggestions`) czy fabrykowane; WebhookSettings przez localStorage (do backendu lub ukryć).
- **L-06** dwa drawery ~2400l (`mindmap/NodeDetailDrawer.tsx` + `IdeaNodeDetailDrawer.tsx`) — **ODROCZONE D-01** (obie powierzchnie żywe, różni konsumenci); brak align/distribute/snap (P2 enhancement); React dup-key (napraw).
- **L-07** brak testów BE map/sync + WS + snapshot; E2E poza tier0; CI bez Londyn — dopisz.
- **L-02** snapshots migracja (wspólne M05) — staging verify.
- i18n **872×** — wg decyzji puli Faza 4.

## Procedura → 8/8
1. **Kod** — L-04 (AI overlays prawda/ukrycie, webhook, export label), L-06 React dup-key. 2. **DoD 7/7**. 3. **Epiki 7/7**. 4. **Kod-testy** + L-07. 5. **Manual (Playwright)**. 6. **UI/UX** + a11y/dark live. 7. **→UI** 16 ekranów.

## Weryfikacja LIVE
`preview_start` `frontend-dev`+`backend-dev` (staging). Chrome MCP zalogowany: `navigate http://localhost:3000/my-work/ideas` → wejdź w mapę myśli. **Realtime testuj 2 kartami** (`tabs_create_mcp`) — patch z jednej widoczny w drugiej. Dowód = screenshot + Network/WS + logi.

## Testy manualne = Playwright + screenshoty (bramka „Manual N/N")
121 scenariuszy z `TESTY_M06_…` jako **specy Playwright** (`tests/e2e/`), wzór `tests/e2e/smoke/*`. Każdy: **`page.screenshot({ path: 'tests/e2e/screenshots/m06/<id>.png' })`**. Realtime: dwa konteksty/karty w jednym specie. Bramka „Manual" = tylko z `.png`.

## Twarde zasady
Tylko M06. NIGDY `git add -A`/`.`. prod=centerbeam: bez zgody. Sekrety/env = Piotr. UI: live+screenshot. Weryfikuj zanim ogłosisz.

## Co zwracasz
Wiersz M06 w trackerze + raport: bramki z dowodem, blokery dla Piotra, status **8/8** albo co zostało.

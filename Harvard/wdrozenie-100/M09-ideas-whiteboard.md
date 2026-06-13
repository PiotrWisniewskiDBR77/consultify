# TECZKA M09 — Ideas · Whiteboard (pełna teczka wg wzorca, pogłębiona do poziomu M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + `MODULE_02E_whiteboard.md` + kod realtime) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami grepem · **docelowy model multiplayer DP-3**). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).
> **Pula Ideas — uwaga R6:** NIE testowana na żywo 2026-06-13 (brak wpisu Ideas w `UWAGI_TESTY_2026-06-13.md`) → wejścia dziedziczone z karty + reconciliation w kodzie. Sesja żywa = warunek domknięcia 9/9.

## 00 · Nagłówek
- **Moduł:** M09 Ideas-Whiteboard (tablica warsztatowa: node'y, rysowanie, frames, sceny, facilitation) · **Pula:** ideas (najlepiej wykonane narzędzie canvas, najgłębszy bloker strukturalny puli)
- **Ocena audytu:** 49/100 (najniższa w puli) · **Status:** FAZA 1 (shared board) → FAZA 3 · **Rozmiar:** **L (3–5 dni — najcięższy)** · **Żywy bloker:** **P0-struct — per-user dokument `my_idea_maps` → multiplayer strukturalnie niemożliwy**
- **Decyzja kierunkowa:** **DP-3 ZATWIERDZONA (2026-06-13) = per-resource multiplayer** (przebudowa `my_idea_maps` na model współdzielony + membership/share; koordynacja z M05). Patrz [`_DECYZJE.md`](_DECYZJE.md).
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13 (pogłębiona)
- **Karta:** `Harvard/modules/M09-ideas-whiteboard/KARTA_AUDYTU.md` (§1e · §1g · §5 · §6 · §7) · **Analiza:** `Harvard/podzial/ideas/MODULE_02E_whiteboard.md` · **Evidence:** `…/evidence/`
- **Kod:** `src/components/MyWork/IdeaWhiteboardTool.tsx` · `src/components/MyWork/whiteboard/` (nodes/toolbar/quick-actions) · `src/components/MyWork/IdeaDrawingLayer.tsx` · `src/components/MyWork/IdeaMapWorkspace.tsx` (workspace + emisja `graph_patch`) · `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map`) · `server/src/routes/realtime-platform.routes.ts` (facilitation 12 endp.) · `server/src/services/realtimePlatformService.ts` · `server/src/gateways/ideaCollabWs.gateway.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta §0 + werdykt | job-to-be-done + zakres + **shared-board jako sedno wartości** (niżej) |
| B UX docelowe | 🟢 | karta §5 (§27 N.D.) | stany ekranu + delty (kształty/resize/presence) (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e + facilitation API + WS | **docelowy model multiplayer DP-3** + kontrakt `/map` + WS sync (niżej) |
| D AI/Teresa | 🟢 | karta §1a (5+ generatorów) | granice persony + delta governance BE (niżej) |
| E Integracje | 🟢 | karta §1g | WS wspólny M06/M07 + blob-sync M05/M06/M07/M08 (niżej) |
| F Epiki | 🟢 | karta §7 (3 fale) | epiki→stories Gherkin→L-xx (niżej) |
| G DoD/jakość | 🟢 (dołożone) | karta §0/§2 | **liczby grepem 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + R3** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** prowadzić **warsztaty na wspólnej tablicy** — od burzy mózgów (11 typów node, rysowanie pen/highlighter, frames), przez głosowanie i role facylitatora, po sceny + tryb prezentacji i eksport. Sedno wartości = **wielu uczestników na JEDNEJ tablicy w czasie rzeczywistym.**
- **Persony/role:** **facilitator** (tworzy tablicę, prowadzi sesję, zarządza fazami/timerem/rolami) + **uczestnicy** tej samej org (dodają node'y, głosują, rysują). Docelowo role egzekwowane serwerowo (dziś samonadawane klikaniem).
- **Zakres v1:** edytor whiteboardu (single-player solidny) · facilitation API (12 endpointów DB-backed) · realny LLM (5+ generatorów whiteboard-specific, propose→accept/reject) · eksport PNG/SVG/MD/JSON · i18n wzorcowy (149 kluczy `myWork.whiteboard.*` PL/EN). **+ DP-3: shared-board (per-resource multiplayer).** **POZA v1:** object storage obrazów (delta P2, dziś base64 z limitem 10 MB), CRDT pełny merge konfliktów (dziś last-write z wersjonowaniem 409).
- **Metryka wartości:** (1) 2. uczestnik org ładuje tę samą tablicę (nie 404); (2) zmiana node'a u user A widoczna u user B < 1 s (realtime); (3) facylitator uruchamia głosowanie → uczestnicy widzą wynik bez reloadu.

## B · UI/UX — STAN DOCELOWY *(karta §5 + delty)*
- **Layout:** canvas pełnoekranowy + toolbar (node-types, draw, align/distribute, frames, scenes) + slash-menu + prawy panel facilitation (timer/faza/role/voting/outcomes). **§27 N.D.** (canvas, nie tabela). i18n **wzorcowy** — najlepszy w puli (149 kluczy).
- **Stany ekranu (docelowo, każdy z komunikatem):**
  - *pusty* — pusta tablica + quick-start („Burza mózgów", „Mapa", import outline).
  - *ładowanie* — skeleton canvas, presence-bar pusta.
  - *błąd* — fetch `/map` 404/500 → jawny baner „Nie udało się załadować tablicy" (**nie cicha pustka**); WS down → baner „Tryb offline, zmiany lokalne".
  - *pełny* — tablica + presence-awatary + locki.
  - *brak-uprawnień* — nie-członek share → 403 + baner „Brak dostępu do tej tablicy" (dziś: cudza idea = **404**, P0-struct).
- **Interakcje / mikro-flow:** undo/redo (stos 25), align/distribute/lock/group, frames collapse/expand, sceny + tryb prezentacji, paste/drag-drop obrazów, slash-menu. **Brak baneru** dla zablokowanego locka (PG crash naprawiony, ale degradacja niema).
- **Delty docelowe (do zbudowania):**
  - **Kształty** circle/diamond/hexagon — handlery istnieją (`useWhiteboardQuickActions.ts:45-47`), UI emituje **tylko rectangle** (`WhiteboardToolbar.tsx:127-129`) → odblokować w toolbarze.
  - **Resize node'ów** (NodeResizer) — brak.
  - **Auto-parentowanie** do frames przy drop wewnątrz ramki — brak.
  - **Presence/cursors** — kursory/locki przez WS istnieją, ale bez wspólnego dokumentu są bezużyteczne (P0-struct je odblokowuje).
- **Zgodność z systemem:** Visual Standard (hex → tokeny, delta niżej); `EntityStatusChip` N.D. (brak status-encji); a11y/dark mode — dziedziczy z canvas shell.

## C · DANE + API + REGUŁY *(link + DOCELOWY model multiplayer DP-3)*

### C0 · Kontrakt persystencji tablicy (stan obecny — prawda kodu)
- **`/api/my-work/my-ideas/:id/map` GET/PUT** (`my-work.routes.ts`): persyst nodes/edges + wersjonowanie optymistyczne (`baseVersion` wymagane, 409 przy konflikcie, `:3757-3762`). Realny, solidny single-player. Blob-sync klienta: `useIdeaMapSync.ts:198-401` (draft localStorage, autosave 60 s, offline-queue).
- **P0-STRUKTURALNY (ŻYWY, sedno bloku):** `my_idea_maps` keyed `WHERE idea_id = ? AND user_id = ? AND organization_id = ?` (`my-work.routes.ts:3752,3897,4175`) → **klucz zawiera `user_id`** → cudza tablica = 0 wierszy = 404 → 2. uczestnik nie załaduje tej samej tablicy → **multiplayer = teatr jednoosobowy niezależnie od jakości API facilitation.**

### C1 · DOCELOWY MODEL MULTIPLAYER (DP-3 — ZATWIERDZONY 2026-06-13)
**Kierunek: `my_idea_maps` per-user → per-resource + membership/share.** To zmienia **kontrakt dostępu dla CAŁEJ puli Ideas** (M05/M06/M07/M08 współdzielą `useIdeaMapSync`/blob-sync) → **koordynacja z M05 obowiązkowa.**

| Element | Stan obecny (per-user) | Docelowy (per-resource, DP-3) |
|---|---|---|
| Klucz dokumentu | `(idea_id, user_id, org_id)` — kopia per user | `(idea_id, org_id)` — **jeden dokument na ideę** |
| Dostęp do `/map` GET | tylko właściciel (cudza → 404) | **każdy członek org z membership/share** → 200 |
| Membership | brak | nowa tabela `idea_map_members` (`idea_id`, `user_id`, `role` ∈ owner/editor/viewer) lub reuse share-model M05 |
| Zapis konkurencyjny | last-write + `baseVersion` 409 | per-resource wersjonowanie + realtime patch (niżej) |
| Migracja danych | — | scalić istniejące per-user kopie → wybrać kanoniczną (właściciel) lub merge; **ostrożnie, ryzyko regresu single-player całej puli** |

**Reguła dostępu docelowa:** `GET/PUT /map` sprawdza `idea_map_members` (lub share M05) zamiast `user_id = ?`. Brak membership → **403 z banerem** (nie 404 milczące). Owner zarządza share (dodaj/usuń członka, rola).

### C2 · Realtime sync treści (P1 — docelowy)
- **Stan obecny:** kanał WS `graph_patch` **konsumowany przez mind-mapę i workspace map** (`IdeaRecommendationMap.tsx:1957`, `IdeaMapWorkspace.tsx:2361,2381,3122`, odbiór `mindmap/CollaborationOverlay.tsx:175`), ale **whiteboard sam nie nadaje/nie odbiera** patchy node'ów tablicy.
- **Docelowo:** podpiąć whiteboard pod istniejący kanał `graph_patch` (gotowy WS + wzorzec w workspace) → zmiana node'a u A emituje patch → B odbiera i merge'uje < 1 s. Reuse `ideaSelectionTypes.ts:132` (`'graph_patch' | 'view_patch'`).

### C3 · WS collab + facilitation (FAZA 1 — częściowo naprawione)
- **WS resource-auth = REALNY (zweryf. R3):** `ideaCollabWs.gateway.ts:237-242` DB org-check `WHERE id=? AND organization_id=?` + 403 (**WSPÓLNY z M06/M07** — jeden fix dla trzech modułów, claim `b9f2dee9d2` potwierdzony).
- **PG datetime = NAPRAWIONE (zweryf. R3):** `realtimePlatformService.ts:138 cleanStalePresence` + `:500 acquireEditLock` używają `NOW() ± ($N * INTERVAL '1 minute')` zamiast string-concat `datetime()` (claim `1b67579d7a` potwierdzony w kodzie 2026-06-13). [Smoke na PG do domknięcia.]
- **Facilitation API — 12 endpointów** (`realtime-platform.routes.ts:457-1060`, mount `Gateway.ts:903`, serwis `realtimePlatformService.ts:231-541`, tabele w baseline prod): `createFacilitationSession(orgId,…)`/`getFacilitationSession(orgId,sessionId)`/timer/phase/votes/voteSummary/roles/outcomes/exportOutcome/tool-presence/locks. **Org-scope:** serwis przyjmuje `orgId` w `createFacilitationSession`/`getFacilitationSession`/`getOutcomeWithSession` — [do weryfikacji w kodzie czy WSZYSTKIE 5 GET-ów facilitation (votes/voteSummary/roles/outcomes) przechodzą przez org-check; karta zgłaszała je jako P0 przed `b9f2dee9d2`].
- **Pułapki PG:** bigint=string, jsonb=object (`nodes_json`/`edges_json`) — helpery `pgFlags.ts` (`parseMaybeJson`).

### C4 · Reguły biznesowe (docelowe)
- **Maszyna stanów sesji facilitation:** brak twardej state-machine; faza (`updatePhase`) + timer (`updateTimerState`) + end (`endFacilitationSession`) — luźne. Docelowo: uczestnicy **odczytują** stan (timer/faza) przez polling `getFacilitationSession` — dziś `facilitationGetSession` (`api.ts:18483`) ma **0 call-sites** → uczestnik nie widzi timera/fazy.
- **Role:** `cycleSessionRole` = samonadawanie klikaniem (`api.ts:1101-1125`); serwer zapisuje `permissions`, **żaden endpoint ich nie egzekwuje** → docelowo enforcement serwerowy.
- **Voting:** upsert 1-głos/node/user (`realtimePlatformService.ts:293-296`) vs UI sugerujące 5-dot (`IdeaMapWorkspace.tsx:2741`) → uspójnić semantykę.

## D · AI / TERESA *(link + delty)*
- **Co generuje:** 5+ generatorów whiteboard-specific — brainstorm / find-themes / name-clusters / extract-actions / to-map-branches; realny LLM, przepływ **propose→accept/reject** z `IdeaProposalReview` (nie auto-apply). Granica persony: AI **proponuje** node'y/klastry, człowiek akceptuje.
- **Wejścia kontekstu:** zawartość tablicy (node'y/edges) jako kontekst generacji.
- **Delta (P2):** governance/klasyfikacja + watermark **FE-only** (`IdeaExportMenu.tsx:177` blokuje eksport w UI) → docelowo **BE enforcement** `classification_level` przy `/map` PUT (serwer nie weryfikuje governance).

## E · INTEGRACJE — mapa połączeń *(karta §1g + zależności)*
- **Wejścia ←** lista idei (`my_ideas`). **Wyjścia →** eksport PNG/SVG (html-to-image) + Markdown + JSON; `/api/realtime-v4/tool-sessions` presence.
- **Wspólna warstwa (kręgosłup):**
  - **WS gateway `ideaCollabWs.gateway.ts` WSPÓLNY z M06 (mind-map) i M07 (process-flow)** — jeden fix resource-auth naprawia trzy moduły (zweryfikowany).
  - **Blob-sync `useIdeaMapSync` WSPÓLNY z M05/M06/M07/M08** → **DP-3 (shared board) zmienia kontrakt `my_idea_maps` dla CAŁEJ puli** → ryzyko regresu single-player wszystkich czterech narzędzi.
- **Zależności blokujące:** **shared-board (P0, DP-3) → koordynacja z M05** (wspólny model wersjonowania/share, M05-D02). Bez tego facilitation/multiplayer pozostaje fasadą.

## F · EPIKI → STORIES → ZADANIA *(z karty §7, forma epików, kierowane DP-3)*

- **EPIK 1 — Shared board model (P0-struct, DP-3, najcięższy L):**
  - *Story 1.1:* jako uczestnik org chcę otworzyć tablicę kolegi, aby współpracować.
    - *Gherkin:* dane idea X należąca do user A (org O) · gdy user B (org O, z membership) woła `GET /map` · wtedy 200 z node'ami (nie 404).
    - *Zadania:* [Z-01 → L-01] `my_idea_maps` per-resource (klucz `idea_id+org_id`); [Z-02 → L-01] tabela `idea_map_members` + share API; [Z-03 → L-01] migracja per-user→kanoniczna kopia; koordynacja M05.
- **EPIK 2 — Realtime sync treści tablicy (P1):**
  - *Story 2.1:* jako uczestnik chcę widzieć zmiany kolegi na żywo.
    - *Gherkin:* dane wspólna tablica otwarta u A i B · gdy A przesuwa node · wtedy B widzi zmianę < 1 s.
    - *Zadania:* [Z-04 → L-02] whiteboard nadaje/odbiera `graph_patch` (reuse wzorca workspace).
- **EPIK 3 — WS + facilitation + PG (FAZA 1, częściowo done):**
  - *Story 3.1:* jako system odrzucam dostęp obcej org do WS/sesji.
    - *Gherkin:* dane token org B · gdy WS upgrade na ideę org A · wtedy 403. (**kod OK — zweryf.**)
    - *Zadania:* [Z-05 → L-03] 5 facilitation GET-ów org-scope (weryfikacja w kodzie); [Z-06 → L-03] PG datetime smoke na staging.
- **EPIK 4 — Fasady facilitation (P1/P2):**
  - *Story 4.1:* jako uczestnik widzę timer/fazę facylitatora.
    - *Gherkin:* dane facylitator ustawił fazę · gdy uczestnik pollu­je sesję · wtedy widzi fazę/timer.
    - *Zadania:* [Z-07 → L-04] konsumpcja `getFacilitationSession`; [Z-08 → L-04] enforcement ról serwerowo; [Z-09 → L-04] governance BE; [Z-10 → L-04] dot-voting spójny.
- **EPIK 5 — Szlif Miro-grade (P2):**
  - *Zadania:* [Z-11 → L-05] object storage obrazów (zamiast base64); [Z-12 → L-05] odblokować kształty circle/diamond/hexagon; [Z-13 → L-05] NodeResizer + auto-parentowanie; [Z-14 → L-05] usunąć martwy `useIdeasTeresaBridge.ts`.
- **EPIK 6 — Testy (P0-test):**
  - *Zadania:* [Z-15 → L-06] WS org-scope + facilitation DB (realna DB) + shared board E2E + CI na `Londyn`.

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13, R4)*
| # | Kryterium | Miara M09 |
|---|-----------|-----------|
| 1 | Front↔back | shared board (2. uczestnik ładuje tablicę, 200 nie 404); realtime sync (A→B < 1 s); stan sesji czytany przez uczestników; 0 fasad multiplayer |
| 2 | Bezpieczeństwo | WS org-scope (Org B → 403) — **kod OK (zweryf.)**; 5 facilitation GET-ów org-scope (weryfikacja); PG lock/clean-stale bez crash — **kod OK (zweryf.)**; governance BE enforced; membership/share egzekwowane (DP-3) |
| 3 | i18n | **0 z ~30** `isPolish`/`i18n.language` (grep 2026-06-13: `whiteboard/` 23 + `IdeaWhiteboardTool.tsx` 7) — **najmniejszy dług puli**; i18n wzorcowy 149 kluczy PL/EN |
| 4 | Tokeny | **0 z 33** hex inline (`whiteboard/`+`IdeaWhiteboardTool.tsx`) → Visual Standard (część = palety canvas → DP-8: palety zostają legalne, reszta → token) |
| 5 | §27 | N.D. (canvas); **0** surowych `<table>` (potwierdzone grepem) |
| 6 | E2E w PR-gate | WS org-scope + facilitation DB + **shared board (DP-3)** zielone na `Londyn` |

**Telemetria sukcesu:** liczba unikalnych użytkowników/tablicę (>1 = multiplayer żyje); latencja patch A→B; 404-rate na `/map` (→0 po DP-3).
Scenariusze S1–S5 + testy: karta §0/§2. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 + `MODULE_02E_whiteboard.md` | 2026-06-11 | rdzeń realny; P0-struct per-user; długi facilitation | L-01..L-06 |
| W-02 | **Uwagi żywe 2026-06-13** | 2026-06-13 | **BRAK wpisu Ideas — pula nietestowana żywo; dziedzicz z karty (R6 do domknięcia)** | — |
| W-03 | Re-audit karty (`b9f2dee9d2`/`1b67579d7a`/`0b81310448`) | 2026-06-11/12 | WS resource-auth + PG datetime + presence-TTL naprawione | L-03 (R3) |
| W-04 | **`_DECYZJE.md` DP-3 (ZATWIERDZONA)** | 2026-06-13 | per-resource multiplayer + membership/share; koord. M05 | L-01 (D-01 ROZSTRZYGNIĘTA) |
| W-05 | Kod (`my-work.routes.ts`, `realtimePlatformService.ts`, `ideaCollabWs.gateway.ts`, `IdeaMapWorkspace.tsx`) | 2026-06-13 | weryfikacja R3 + enumeracja endpointów/`graph_patch` | weryfikacja |

### 02 · Stan obecny (prawda kodu, R3 zweryfikowane 2026-06-13)
- **WS resource-auth = REALNY:** `ideaCollabWs.gateway.ts:237-242` (wspólny M06/M07) — **POTWIERDZONY** (claim `b9f2dee9d2`).
- **PG datetime = NAPRAWIONE:** `realtimePlatformService.ts:138` + `:500` parametryzowane interwały — **POTWIERDZONE w kodzie** (claim `1b67579d7a`). [Smoke na PG do domknięcia.]
- **`graph_patch` = nadawany przez workspace/mindmap, NIE przez whiteboard** — zweryfikowane grepem (`IdeaMapWorkspace.tsx:2361,2381,3122`; whiteboard 0 trafień). L-02 realna.
- **Per-user dokument = ŻYWY P0-struct:** `my-work.routes.ts:3752,3897,4175` keyed `user_id` — niezmieniony; **najcięższy żywy bloker puli, żaden commit go nie adresuje** (to zmiana data-modelu, nie patch). **DP-3 zatwierdza kierunek naprawy.**

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | Per-user dokument blokuje multiplayer (→ per-resource + membership/share) | W-01,W-04,W-05 | `my-work.routes.ts:3752,3897,4175` | P0-struct | 1 | **otwarta (żywa); kierunek = DP-3 ZATWIERDZONY; brak commitu** |
| L-02 | Whiteboard nie nadaje/odbiera realtime `graph_patch` | W-01,W-05 | `IdeaMapWorkspace.tsx:2361` (workspace ma; whiteboard nie) | P1 | 1 | otwarta |
| L-03 | WS resource-auth + facilitation org-scope + PG datetime | W-01,W-03,W-05 | `ideaCollabWs.gateway.ts:237-242`, `realtimePlatformService.ts:138,500` | P0/P1 | 1 | **WS+PG NAPRAWIONE (zweryf. 2026-06-13)**; 5 facilitation GET-ów [do weryfikacji]; smoke PG do domknięcia |
| L-04 | Stan sesji nieczytany (0 call-sites); role samonadawane; governance FE-only; voting niespójny | W-01 | `api.ts:18483`,`:1101`, `IdeaExportMenu.tsx:177`, `realtimePlatformService.ts:293` | P1/P2 | 3 | otwarta |
| L-05 | Martwy kod (`useIdeasTeresaBridge.ts`); kształty zablokowane; brak NodeResizer; obrazy base64 (limit 10MB) | W-01 | `useWhiteboardQuickActions.ts:45`, `WhiteboardToolbar.tsx:127`, `index.ts:923` | P2 | 3 | otwarta |
| L-06 | Brak testów WS/facilitation DB/shared board + E2E + CI bez `Londyn` | W-01 | `tests/*` (73 = spec+mock+smoke) | P0-test | 1+4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Shared board model (kontrakt `my_idea_maps` całej puli) | per-resource + membership/share / single-player solo | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTA = DP-3 per-resource + membership/share** (koord. M05) |
| D-02 | Obrazy base64 (limit body 10MB) | object storage / cap rozmiaru | Piotr | TBD | otwarta |

### 05 · Flagi / rollout / beta-gating
`MYWORK_IDEAS: 'closed'` (`BETA_ADMINS_EXEMPT: false`) — wszyscy non-admin za zamkniętą betą. Facilitation aktywne w UI, ale multiplayer zablokowany P0-struct do czasu DP-3.

### 06 · Ryzyka i założenia
- **DP-3 = zmiana klucza dostępu `my_idea_maps` per-user→per-resource → ryzyko regresu single-player dla CAŁEJ puli Ideas (M05/M06/M07/M08)**; migracja danych ostrożna (scalanie per-user kopii). **Koordynacja z M05 (M05-D02 wersjonowanie) obowiązkowa.**
- PG datetime smoke na staging do domknięcia (kod naprawiony, runtime niezweryfikowany).
- Dev `.env` → Railway PROD; whiteboard na prod ~2026-05-18 (`feedback_prod_caution` — ostrożność z migracją).

### 07 · Log wdrożenia + re-ocena
- 2026-06-13: pogłębienie teczki; **D-01 rozstrzygnięta DP-3 (per-resource)**; zweryfikowano L-03 (WS org-scope + PG datetime naprawione w kodzie); zweryfikowano L-02 (`graph_patch` w workspace, nie whiteboard); DoD przeliczone grepem (i18n ~30, hex 33, table 0).
- Audyt 2026-06-11: 49/100 (najniższa w puli). Re-ocena po FAZA 1 (shared board — najcięższy L) + sesji żywej (R6).

---

## Bramka teczki: 8/9 dokumentacyjnie
R1 wejścia pełne (karta + `MODULE_02E` + DP-3 + kod) ✅ · R2 zero sierot (wejście→luka→DoD) ✅ · R3 statusy z dowodem (L-03 WS+PG zweryfikowane; L-01 żywy bez commitu, DP-3 zatwierdza kierunek — jawnie) ✅ · R4 DoD z liczbami (i18n ~30 · hex 33 · table 0) ✅ · R5 decyzje z właścicielem (**D-01 ROZSTRZYGNIĘTA = DP-3**; D-02 TBD) ✅ · A–E docelowy zlinkowany (+ docelowy model multiplayer) ✅ · F epiki↔stories Gherkin↔luki ✅ · G DoD+S+sec ✅ · **R6 sesja żywa NIEZALICZONA (pula Ideas nietestowana żywo) — W-02 puste.** **8/9 (R6 = warunek domknięcia).**

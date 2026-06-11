# M09 — Ideas — Whiteboard — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `f8fec59536`) · **Audytor:** Claude (osobiście — agents stalled, źródło: `Harvard/podzial/ideas/MODULE_02E_whiteboard.md`)
**Wejścia:** `MODULE_02E_whiteboard.md` (pełna analiza kodu 2026-06-11) · `INV_B_my-work.md` §Whiteboard · Protokół V1
**Evidence:** plik:linia zgodnie z MODULE_02E — wszystkie pozycje zweryfikowane w kodzie

## OCENA: 43/100 — Tier: Alpha · status 🟦 NIEPEŁNY (bez Fazy 4)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 18 | Rdzeń single-player (11 typów node'ów, rysowanie, undo/redo, AI generate/accept/reject, sceny, eksport PNG/SVG/MD) — solidny i realny; facilitation API DB-backed (12 endpointów, realne tabele); ale multiplayer strukturalnie niemożliwy — `my_idea_maps` per-user, drugi uczestnik nie może załadować tej samej tablicy. |
| B. Wiring i dane | 15 | 9 | Blob-sync (PUT/GET `/api/my-work/my-ideas/:id/map`) solidny z optimistic-lock; facilitation: migracje w baseline prod; ale PG `datetime()` concat crashuje na prodzie (`realtimePlatformService.ts:141,511`); per-user document kills multiplayer; presenza bez TTL → duchy. |
| C. Testy automatyczne | 15 | 5 | 73 testów PASS: `p13-whiteboard-canon.test.ts` (57, testuje spec-stałe nie runtime), `facilitation.contracts.test.ts` (8, serwis zmockowany), `ideaMapSyncPersistence.smoke.test.ts` (8); zero testów komponentu whiteboardu, zero testów WS gateway, zero integracyjnych na realnej DB. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana — deferred. |
| E. Kanony/UI | 10 | 7 | i18n 149 kluczy `myWork.whiteboard.*` PL/EN kompletne (0 braków); beta-gating SSOT; §27 nie dotyczy canvas; UX bogaty (skróty, sceny, align/distribute, frames, slash-menu). |
| F. Bezpieczeństwo/dostęp | 10 | 4 | **[P0]** WS `/ws/collab/:ideaId` — JWT verify bez org-membership check na resource (kursory/locki/patche dla obcej org znając ideaId); **[P0]** facilitation: `PUT /outcomes/:id/export` `:816-849` + inne endpointy GET bez org-scope → cross-org odczyt/zapis po sessionId; governance (classification/watermark) — FE-only, brak BE enforcement. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana — deferred; PG datetime crash nienaprawiony = lock/clean-stale pada na prodzie. |
| **Hard cap zastosowany?** | — | — | Cross-org WRITE: `PUT /outcomes/:id/export` (`:816`) bez org-scope → hard cap max 50 + P0; wynik 43 < 50 — cap niewiążący; P0 flag obligatory. Faza 4 deferred → max 70. |

**Werdykt jednym akapitem:** Whiteboard jest najlepiej wykonanym narzędziem canvas w pakiecie Ideas — solidny single-player z 11 typami node'ów, rysowaniem pen/highlighter, scenami prezentacyjnymi, realnym LLM AI (propose→accept/reject), pełnym i18n PL/EN i kompletnym API facilitation (12 endpointów DB-backed z migracjami w baseline prod). Dwa fundamentalne problemy blokują wyższy tier: (1) strukturalny P0 — `my_idea_maps` per-user sprawia, że drugi uczestnik nie może załadować tej samej tablicy, więc cała warstwa facilitation/multiplayer jest teatrem jednoosobowym niezależnie od jakości kodu; (2) WS `/ws/collab/:ideaId` oraz 5 facilitation endpointów (roles, votes, outcomes, export) nie sprawdzają org-membership — cross-org odczyt/zapis po zgadniętym sessionId/ideaId. Na prodzie dodatkowy crash: `datetime()` string-concat w PG nie tłumaczony przez DB adapter → lock/clean-stale crashuje. Fala 1 (shared board model) to blocker całej wartości workshopowej modułu.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)

| Scenariusz | Status |
|---|---|
| S1: Single-player whiteboard (rysowanie, sticky, AI, eksport) | DZIAŁA — solidny |
| S2: Facilitation + voting (multiplayer) | FASADA — per-user document, drugi uczestnik nie może załadować tablicy |
| S3: Realtime presence/cursors | CZĘŚCIOWO — kursory/locki przez WS, ale bez wspólnego dokumentu |
| S4: WS resource authorization | ZEPSUTE — P0 (JWT bez org-membership) |
| S5: Postgres acquireLock / clean-stale | ZEPSUTE — P1 (datetime crash na PG) |

## 1. Prawda kodu (FAZA 1)

### 1a. REALNE
- Rdzeń canvas: 11 typów node'ów (`whiteboard/nodes/nodeTypes.ts:16-31`), rysowanie pen/highlighter/gumka (`IdeaDrawingLayer.tsx:76-145`), undo/redo (stos 25), alignment/distribute/lock/group, frames (collapse/expand), sceny + tryb prezentacji, paste/drag-drop obrazów, import outline, quick-starty
- Blob-sync: `useIdeaMapSync.ts:198-401` — draft localStorage, autosave 60s, offline-queue, wersjonowanie z 409
- Facilitation API: 12 endpointów `realtime-platform.routes.ts:457-849`, mount `Gateway.ts:903`, serwis DB-backed (`realtimePlatformService.ts:231-398`), tabele w baseline prod (`migrations-v2/001_baseline_20260413.sql:29196-29260`)
- AI: 5+ generatorów whiteboard-specific (brainstorm/find-themes/name-clusters/extract-actions/to-map-branches), propose→accept/reject z `IdeaProposalReview`
- i18n: 149 kluczy `myWork.whiteboard.*` PL/EN identyczne

### 1b. MOCK / STUB / LOKALNE-UDAJĄCE-WSPÓLNE
- **Stan sesji facilitation** (timer, faza, rola, follow-me): zapisywany na serwer, `facilitationGetSession` (`api.ts:18483`) — 0 call-sites w komponentach → uczestnik nigdy nie widzi timera/fazy facylitatora
- **Role**: `cycleSessionRole` = samonadawanie sobie roli klikaniem (`:1101-1125`); serwer zapisuje `permissions`, ale żaden endpoint ich nie egzekwuje
- **Governance/klasyfikacja + watermark**: czysto kliencki cykl (`:1370-1390`); blokada eksportu FE-only (`IdeaExportMenu.tsx:177`)
- **Emoji-reakcje w głosowaniu**: lokalny stan, nie persystowane (`IdeaVotingMode.tsx:53,147-153`)
- **Activity log / history / library**: lokalne, capowane (40/20/12); wstaw z biblioteki = `libraryItems[0]` (`:1302-1351`)
- **`useIdeasTeresaBridge.ts`**: hook bez ani jednego importera = dead code
- **`whiteboardCanon.ts`**: plik-spec (stałe P13), testowany, ale nie runtime

### 1c. ZEPSUTE

**[P0-strukturalne] Per-user document blokuje multiplayer:**
`my_idea_maps`: `WHERE idea_id AND user_id AND organization_id` (`my-work.routes.ts:3677,3656-3660`) — cudzy pomysł → 404. Facilitation celuje w tablicę, której drugi użytkownik nie może załadować. Multiplayer niemożliwy niezależnie od jakości API facilitation.

**[P0] WS bez resource-auth:**
`/ws/collab/:ideaId` (`ideaCollabWs.gateway.ts:201-239`) — weryfikacja JWT przy upgrade, brak sprawdzenia DB czy `organizationId` pasuje do właściciela idei → kursory/locki/graph_patch dostępne dla obcej org znającej ideaId.

**[P0] Cross-org facilitation writes:**
`facilitationGetVotes` (`:686`), `facilitationGetVoteSummary` (`:696`), `facilitationGetRoles` (`:750`), `facilitationGetOutcomes` (`:807`), `PUT outcomes/export` (`:816-849`) — brak sprawdzenia org → cross-org odczyt i zapis po zgadniętym sessionId.

**[P1] Postgres datetime crash:**
`cleanStalePresence` (`realtimePlatformService.ts:141`): `datetime('now','-'||$1||' minutes')` i `acquireEditLock` (`:511`): `CURRENT_TIMESTAMP - ($1 || ' seconds')::INTERVAL` — nie tłumaczone przez `PostgresDatabase.ts:385-407` → crashują na prodzie. `listToolPresence` bez TTL-filtru → duchy-awatary permanentne.

**[P1] Whiteboard nie ma realtime syncu treści:**
`graph_patch` z WS konsumowany wyłącznie przez mind-mapę (`IdeaRecommendationMap.tsx:2811`); whiteboard nie nadaje i nie odbiera patchy.

**[P2] Semantyka głosów niespójna:** upsert 1-głos/node/user (`realtimePlatformService.ts:293-296`) vs UI sugerujące 5-dot-voting (`IdeaMapWorkspace.tsx:2741`).

**[P2] Obrazy jako base64 w nodes_json** + limit body 10 MB (`server/src/index.ts:923`) → kilka zrzutów = trwały fail zapisu całej mapy.

### 1d. MARTWY KOD
- `useIdeasTeresaBridge.ts` — 0 importerów
- `cleanStalePresence` endpoint (`:263`) — nikt nie woła; pada na PG
- Kształty circle/diamond/hexagon: handlery istnieją (`useWhiteboardQuickActions.ts:45-47`), UI emituje tylko rectangle (`WhiteboardToolbar.tsx:127-129`)

### 1e. Wiring facilitation

| Client (`api.ts`) | Endpoint | Org-scope | Status |
|---|---|---|---|
| `facilitationCreateSession` :18475 | POST `/sessions` | ✅ | OK |
| `facilitationGetSession` :18483 | GET `/sessions/:id` | ✅ | OK, **0 call-sites** |
| `facilitationUpdateTimer` :18489 | PUT `/:id/timer` | ✅ | OK, brak roli-gate |
| `facilitationCastVote` :18512 | POST `/:id/votes` | ✅ | OK |
| `facilitationGetVotes` :18523 | GET `/:id/votes` | ❌ | P0 |
| `facilitationGetVoteSummary` :18531 | GET `/votes/summary` | ❌ | P0 |
| `facilitationAssignRole` :18538 | POST `/:id/roles` | ✅ | OK |
| `facilitationGetRoles` :18549 | GET `/:id/roles` | ❌ | P0, nieużywany |
| `facilitationCreateOutcome` :18555 | POST `/:id/outcomes` | ✅ | OK, nieużywany |
| `facilitationGetOutcomes` :18573 | GET `/:id/outcomes` | ❌ | P0 |
| `facilitationExportOutcome` :18579 | PUT `/outcomes/:id/export` | ❌ | **P0 WRITE** — hard cap |
| `toolSessionJoinPresence` :18593 | POST `/presence` | ✅ | OK |
| `toolSessionAcquireLock` :18631 | POST `/locks` | ✅ | **pada na PG** (datetime) |

### 1f. Flagi
| Flaga | Default | Wpływ |
|---|---|---|
| `MYWORK_IDEAS` | `'closed'` | beta gating — blokuje wszystkich non-admin |

### 1g. Połączenia
- Blob-sync wspólny z mindmap/flow/table przez `useIdeaMapSync`
- WS `/ws/collab/:ideaId` + presence polling `/api/realtime-v4/tool-sessions`
- Eksport do PNG/SVG (html-to-image) + Markdown + JSON

## 2. Testy automatyczne (FAZA 2)

| Test | Pokrycie | Luka |
|---|---|---|
| `p13-whiteboard-canon.test.ts` (57) | spec-stałe P13 | NIE testuje runtime whiteboardu |
| `facilitation.contracts.test.ts` (8) | zod walidacja (serwis zmockowany) | NIE testuje DB, brak integracji |
| `ideaMapSyncPersistence.smoke.test.ts` (8) | hook syncu | NIE testuje wieloosobowego scenariusza |

Brak: testów komponentów (node'y, undo, grupowanie, drawing), testów WS gateway (resource-auth), testów integracyjnych facilitation na realnej DB, testów E2E.

## 3. Środowiska / Railway (FAZA 3) — PENDING

PG datetime crash w `acquireEditLock` i `cleanStalePresence` = prod crashes do naprawienia przed Fazą 3. Weryfikacja zbiorczo.

## 4. Żywa weryfikacja frontu (FAZA 4) — PENDING (deferred)

## 5. Kanony i standardy (FAZA 5)

- **§27**: nie dotyczy — canvas tool
- **i18n**: 149 kluczy `myWork.whiteboard.*` PL/EN — wzorcowy ✅ (najlepszy w pakiecie Ideas)
- **Beta gating**: `MYWORK_IDEAS: 'closed'`, `BETA_ADMINS_EXEMPT: false` — wszyscy za zamkniętą betą ✅
- **Degradacja**: brak baneru dla zablokowanego lock (PG crash), governance FE-only bez BE enforcement

## 6. Bezpieczeństwo i dostęp (FAZA 6)

**[P0] WS resource-auth gap** (`ideaCollabWs.gateway.ts:201-239`): JWT verify przy upgrade, brak DB-check org-membership dla ideaId. Obca org znająca ideaId dołącza do pokoju WS.

**[P0] Cross-org WRITE facilitation** (`PUT /outcomes/:id/export` `:816-849`): brak org-scope. Uruchamia hard cap max 50. Dodatkowe cross-org GET: votes, summary, roles, outcomes (`:686,696,750,807`).

**[P2] Governance FE-only**: classification/watermark — blokada eksportu tylko w UI (`IdeaExportMenu.tsx:177`); BE nie weryfikuje governance przy `/api/my-work/my-ideas/:id/map` PUT.

Blob-sync: org+user-scope poprawny. Facilitation CREATE operations: org-scoped. WS JWT auth: tylko token, nie resource.

## 7. PLAN DOKOŃCZENIA (FAZA 8)

### Fala 1 — Fundament multiplayer (P0-strukturalne, blocker wartości workshopowej)
1. **Shared board model**: zmienić `my_idea_maps` z per-user na per-resource (idea jako shared document + membership/share model) — Weryfikacja: `GET /api/my-work/my-ideas/:id/map` zwraca tablicę dla każdego członka org z dostępem.
2. **Realtime sync treści**: podpiąć whiteboard pod kanał `graph_patch` (gotowy WS + wzorzec w mindmapie) — Weryfikacja: zmiana węzła u user A natychmiast widoczna u user B.
3. **WS resource-auth**: sprawdzenie org-membership w `ideaCollabWs.gateway.ts` przy upgrade — Weryfikacja: WS upgrade z tokenem obcej org zwraca 403.

### Fala 2 — Niezawodność prod (P1)
4. **Naprawić PG datetime**: przepisać `datetime(... || $n ...)` na parametryzowane interwały PG w `realtimePlatformService.ts:141,511` — Weryfikacja: `acquireEditLock` i `cleanStalePresence` kończą się bez błędu na PG.
5. **TTL w listPresence + cron clean-stale**: filtr heartbeat_at < now - 30s + scheduled cleanup — Weryfikacja: duchy-awatary znikają po 30s.
6. **Odczyt stanu sesji przez uczestników**: pollować `facilitationGetSession` (timer, faza) — kod serwera istnieje, brakuje konsumpcji.
7. **Org-scope w 5 facilitation endpointach**: dodać membership check w routes `:686,696,750,807,816` — Weryfikacja: GET votes/roles dla obcego sessionId zwraca 403.

### Fala 3 — Miro-grade (P2)
8. **Object storage dla obrazów** zamiast base64 w nodes_json
9. **Domknięcie narzędziowe**: resize node'ów (NodeResizer), odblokowanie circle/diamond/hexagon, auto-parentowanie do frames, dot-voting spójna semantyka
10. **Governance BE enforcement**: `/api/my-work/my-ideas/:id/map` PUT weryfikuje classification_level przed eksportem

### Definition of Done
- [ ] P0-WS: resource-auth — obca org dostaje 403 przy WS upgrade
- [ ] P0-cross-org: facilitation writes org-scoped
- [ ] P1-PG: acquireLock/clean-stale bez crash na Postgres
- [ ] Fala 1 shared board model (warunek wejścia do wartości workshopowej)
- [ ] Faza 4 live (Railway access)

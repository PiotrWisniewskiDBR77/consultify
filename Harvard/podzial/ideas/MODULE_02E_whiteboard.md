# Moduł 02E — Ideas: Whiteboard — Karta audytu + plan rozwoju

**Data audytu:** 2026-06-11 (branch `feat/deliverables-light`) · **Metoda:** weryfikacja realnego kodu, dowody `plik:linia`
**Gotowość: 58/100 — Beta (solidny single-player, multiplayer to fasada)**

**Werdykt:** Jako osobisty whiteboard z AI i trwałym zapisem jest realny i kompletny; cała warstwa facylitacji/multiplayer jest end-to-end okablowana (frontend → REST → DB → WS), ale stoi na **dokumencie per-user**, więc drugi uczestnik nie ma jak otworzyć tej samej tablicy — sesje, głosy i follow-me nie mają wspólnego płótna, na którym mogłyby działać.

**Zmiana vs audyt 2026-06-02:** facilitation **ROZSTRZYGNIĘTE** — serwer istnieje, jest kompletny i przetestowany kontraktowo (§4/§5); status podniesiony z Alpha do Beta.

---

## 1. CO JEST REALNE

**Rdzeń canvas (single-player) — klasa solidna:**
- Komponent 2922 linie, zamontowany żywo: `IdeaMapWorkspace.tsx:2891-2912` (error boundary).
- 11 typów node'ów + krawędź z etykietą: `whiteboard/nodes/nodeTypes.ts:16-31` (sticky, text, frame, group, shape, image, link, summaryCard, kpiBadge, scoreNode, progressNode). StickyNote: edycja dblclick, badge komentarzy, linki artefaktów, badge „converted", autor (`nodes/StickyNoteNode.tsx:30-130`).
- Interakcja Miro-style współdzielona (pan PPM/środkowy, lasso LPM, Space=pan, zoom scroll): `canvas/useIdeasToolDefaults.ts:30-58`.
- Undo/redo (stos 25), Cmd+Z/Shift+Z/S/G/A, Del, `/` slash-menu, `?` skróty, Shift+1/Cmd+0 fit (`IdeaWhiteboardTool.tsx:680-702, 2484-2586, 186-204`).
- Wyrównanie 6 kierunków + distribute + lock + duplicate + group/ungroup (`IdeaWhiteboardTool.tsx:2215-2309`, `whiteboard/useWhiteboardNodes.ts:106-260`).
- Paste/drag-drop obrazów (base64), URL→linkNode, tekst→sticky (:213-330); import outline (:1641-1669); quick-starty brainstorm/affinity/workshop (:1711-1834).
- Frames: childCount, collapse/expand z ukrywaniem dzieci (:777-809, `nodes/FrameNode.tsx`).
- Rysowanie: pen/highlighter/gumka, kolory, grubość, undo/redo, współrzędne przez viewport (`IdeaDrawingLayer.tsx:76-145`) — persystowane w `extensions.whiteboard.drawingPaths`.
- Sceny + tryb prezentacji (à la Freeform): `IdeaScenesManager.tsx` — persystowane.

**Persystencja — realna i dojrzała:**
- `canvas/useIdeaMapSync.ts:198-401`: draft localStorage, kolejka offline, autosave (60 s idle + flush na visibilitychange/online/beforeunload), wersjonowanie z 409.
- Serwer `PUT /api/my-work/my-ideas/:id/map` (`my-work.routes.ts:3612-3866`): optimistic lock (3689-3710), guard `IDEA_MAP_EMPTY_RESET_BLOCKED` (3750-3758), walidacja schematu (3641-3652), merge extensions między narzędziami (3712-3730), audit events.

**Facilitation API — istnieje, kompletne (rozstrzygnięcie z 2026-06-02):**
- 12 endpointów REST w `realtime-platform.routes.ts:457-849`, mount `/api/realtime-v4` (`Gateway.ts:903`).
- Serwis DB-backed (nie mock): `realtimePlatformService.ts:231-398` — INSERT/UPDATE na realnych tabelach.
- Tabele w baseline produkcyjnym: `migrations-v2/001_baseline_20260413.sql:29196-29260` (+ unique constraint głosów: 53013-53017).
- Kontrakty klient↔serwer zgodne (sprawdzone pole po polu): `api.ts:18475-18589` vs zod w routes.

**Presence + WebSocket — realne:**
- REST presence pollowane co 5 s (`IdeaWhiteboardTool.tsx:2012-2058`) → `/tool-sessions/:id/presence|heartbeat|disconnect` (routes 856-973).
- Natywny WS `/ws/collab/:ideaId` z auth JWT, kursorami, lockami, graph_patch, persystencją do `collab_sessions` (`ideaCollabWs.gateway.ts:195-443`, `index.ts:1786`). `CollaborationOverlay` zamontowany (`IdeaWhiteboardTool.tsx:2862-2867`).

**Głosowanie — realne E2E (w granicach §3.1):**
- Event `idea-whiteboard-cast-vote` → `facilitationCastVote` → re-sync summary (:1873-1910); polling wyników co 5 s (:1999-2010); overlay `IdeaVotingMode` w trybie `persistent` (`IdeaMapWorkspace.tsx:2738-2761`).

**AI — realne, LLM po stronie serwera:**
- `POST /my-ideas/:id/ai-generate` (`my-work.routes.ts:4954-5002`) z dedykowanymi generatorami whiteboardu (`whiteboard_brainstorm`, `wb_find_themes`, `wb_name_clusters`, `wb_extract_actions`, `wb_to_map_branches`...): 4891-4931. Frontend: propose→accept/reject z `IdeaProposalReview` (:2368-2480), nudge strip, ghost cards.

**Eksport:** PNG/SVG (html-to-image), Markdown, JSON + watermark i blokada governance (`IdeaExportMenu.tsx:222-330, 166-178, 689-690`).

**i18n:** PL/EN kompletne — 149 kluczy `myWork.whiteboard.*` zweryfikowane, 0 braków.

## 2. CO JEST MOCK / STUB / LOKALNE-UDAJĄCE-WSPÓLNE

- **Stan sesji facylitacji (timer, faza, rola, follow-me, spotlight)** — zapisywany na serwer, ale **nigdy nie odczytywany**: `facilitationGetSession` istnieje w kliencie (`api.ts:18483`) i nie ma ani jednego wywołania w komponentach. Stan żyje w `extensions.whiteboard.sessionState` prywatnej mapy usera (:907-915). Uczestnik nigdy nie zobaczy timera/fazy facylitatora.
- **Role** — `cycleSessionRole` to samonadawanie sobie roli klikaniem (:1101-1125); serwer zapisuje `permissions`, ale **żaden endpoint ich nie egzekwuje** (PUT timer/phase wymaga tylko członkostwa w org: routes 524-604).
- **Governance/klasyfikacja + watermark** — czysto kliencki cykl etykiety (:1370-1390); blokada eksportu tylko w UI (`IdeaExportMenu.tsx:177`).
- **Emoji-reakcje w głosowaniu** — lokalny stan, nie persystowane (`IdeaVotingMode.tsx:53, 147-153`).
- **Activity log / history log / library** — lokalne, capowane (40/20/12); „wstaw z biblioteki" wstawia tylko `libraryItems[0]` (:1302-1351).
- **`whiteboardCanon.ts`** — plik-spec (stałe P13), nie runtime; test p13 testuje spec, nie wdrożenie.
- **`canvas/useIdeasTeresaBridge.ts`** — hook bez ani jednego importera = dead code.
- **`myVoteCounts`** nie odtwarzane przy hydracji (:928-930) — licznik zeruje się po reloadzie do re-syncu.

## 3. CO JEST ZEPSUTE / BRAKUJĄCE

1. **[STRUKTURALNE] Dokument tablicy per-user.** `my_idea_maps` czytane/pisane `WHERE idea_id AND user_id AND organization_id` (`my-work.routes.ts:3677, 3656-3660` — cudzy pomysł → 404). Cała facylitacja celuje w tablicę, której drugi użytkownik **nie może nawet załadować**. Multiplayer niemożliwy niezależnie od jakości warstwy realtime.
2. **Whiteboard nie ma realtime syncu treści.** `graph_patch` z WS konsumuje wyłącznie mind-mapa (`IdeaRecommendationMap.tsx:2811`); whiteboard nie nadaje i nie odbiera patchy.
3. **WS bez autoryzacji zasobu.** `/ws/collab/:ideaId` weryfikuje tylko JWT (`ideaCollabWs.gateway.ts:201-239`); pokoje kluczowane samym `ideaId` — użytkownik innej organizacji znający ideaId dołącza do pokoju (kursory, locki, patche).
4. **Awaria na Postgresie (prod):** `datetime('now','-'||$1||' minutes')` w `cleanStalePresence` (`realtimePlatformService.ts:141`) i `acquireEditLock` (:511) **nie tłumaczone** przez adapter (`PostgresDatabase.ts:385-407` pokrywa tylko literały i `' days'`) → padają na prodzie. `listToolPresence` nie filtruje po świeżości heartbeatu (485-489), clean-stale bez crona → **awatary-duchy na zawsze**.
5. **Dziury org-scope w facilitation:** GET votes (686-694), votes/summary (696-703), roles (750-757), outcomes (807-814), PUT outcomes/export (816-849) nie sprawdzają org → cross-org odczyt/zapis po zgadniętym sessionId.
6. **3 z 4 kształtów martwe:** handler `wb_add_shape_circle/diamond/hexagon` istnieje (`useWhiteboardQuickActions.ts:45-47`), ale UI emituje tylko rectangle (`WhiteboardToolbar.tsx:127-129`, `CanvasLeftToolbar.tsx:138`). Brak **resize** node'ów (zero `NodeResizer` w module).
7. **Semantyka głosów niespójna:** upsert `ON CONFLICT ... DO UPDATE` (`realtimePlatformService.ts:293-296`) = 1 głos/node/user, a UI sugeruje pulę 5 głosów dot-voting (`IdeaMapWorkspace.tsx:2741`).
8. **Moduł zamknięty betą dla wszystkich:** `MYWORK_IDEAS: 'closed'` + `BETA_ADMINS_EXEMPT = false` (`betaAccess.ts:31, 58`).
9. **Obrazy jako base64 w nodes_json** (:226-241) przy limicie body 10 MB (`server/src/index.ts:923`) — kilka zrzutów = trwały fail zapisu całej mapy.
10. **Flush beforeunload** bez `keepalive`/`sendBeacon` (`useIdeaMapSync.ts:350-353`) — loteryjny (łagodzone draftem localStorage).

## 4. Wiring backendu — pełna mapa facilitation client→server

Mount: `app.use('/api/realtime-v4', realtimePlatformRoutes)` (`Gateway.ts:903`); `verifyToken` na całym routerze.

| Klient (`api.ts`) | Endpoint | Routes | DB (service) | Org-scope | Status |
|---|---|---|---|---|---|
| `facilitationCreateSession` :18475 | POST `/facilitation/sessions` | :457 | `tool_facilitation_sessions` :241 | ✅ | OK |
| `facilitationGetSession` :18483 | GET `/sessions/:id` | :493 | :249 | ✅ | OK, **nieużywany przez UI** |
| `facilitationUpdateTimer` :18489 | PUT `/sessions/:id/timer` | :524 | :256 | ✅ | OK, brak roli-gate |
| `facilitationUpdatePhase` :18497 | PUT `/sessions/:id/phase` | :566 | :264 | ✅ | OK, brak roli-gate |
| `facilitationEndSession` :18505 | POST `/sessions/:id/end` | :606 | :272 | ✅ | OK, nieużywany |
| `facilitationCastVote` :18512 | POST `/sessions/:id/votes` | :637 | upsert :280 | ✅ | OK |
| `facilitationGetVotes` :18523 | GET `/sessions/:id/votes` | :686 | :311 | ❌ | luka |
| `facilitationGetVoteSummary` :18531 | GET `/votes/summary` | :696 | :319 | ❌ | luka |
| `facilitationAssignRole` :18538 | POST `/sessions/:id/roles` | :705 | upsert :328 | ✅ | OK |
| `facilitationGetRoles` :18549 | GET `/sessions/:id/roles` | :750 | :348 | ❌ | luka, nieużywany |
| `facilitationCreateOutcome` :18555 | POST `/sessions/:id/outcomes` | :759 | :355 | ✅ | OK, nieużywany |
| `facilitationGetOutcomes` :18573 | GET `/sessions/:id/outcomes` | :807 | :385 | ❌ | luka |
| `facilitationExportOutcome` :18579 | PUT `/outcomes/:id/export` | :816 | :392 | ❌ | luka |
| `toolSessionJoinPresence` :18593 | POST `/tool-sessions/:id/presence` | :855 | `tool_session_presence` :402 | ✅ | OK, używany |
| `toolSessionListPresence` :18610 | GET `/presence` | :895 | :484 | ✅ | OK (bez TTL) |
| `toolSessionHeartbeat` :18616 | POST `/heartbeat` | :920 | :458 | ✅ | OK |
| `toolSessionDisconnect` :18624 | POST `/disconnect` | :948 | :475 | ✅ | OK |
| `toolSessionAcquireLock` :18631 | POST `/locks` | :974 | :491 | ✅ | **pada na PG** (datetime concat) |
| — | POST `/presence/clean-stale` | :263 | :138 | n/d | **pada na PG**, nikt nie woła |

Persystencja map: `Api.getMyIdeaMap`/`syncMyIdeaMap` (`api.ts:4511, 4542`) → GET/PUT `/api/my-work/my-ideas/:id/map`. WS: `/ws/collab/:ideaId`.

## 5. Testy

- `realtime-platform.facilitation.contracts.test.ts` — **8 testów PASS**, ale serwis zmockowany (7-41) — tylko walidacja zod / 404 / 503; zero integracji DB.
- `p13-whiteboard-canon.test.ts` — **57 testów PASS**, ale testuje stałe spec-u, **nie runtime whiteboardu**.
- `ideaMapSyncPersistence.smoke.test.ts` — **8 testów PASS** (hook syncu).
- **Zero testów komponentów whiteboardu** (node'y, undo, grupowanie, drawing, hydracja extensions), zero testów `realtimePlatformService` na realnej bazie, zero testów WS gateway, zero E2E.

## 6. UX vs Miro/FigJam

| Obszar | Ocena | Uwagi |
|---|---|---|
| Rysowanie | 7/10 | Pen/highlighter/gumka, viewport-aware; brak: smoothing, kształty z odręcznego, gumka częściowa; rysowanie blokuje edycję tablicy (`locked={... || whiteboardMode==='draw'}` :2748) |
| Sticky notes | 8/10 | Kolory, inline edit, semantic labels, autor, komentarze; brak resize |
| Shapes | 3/10 | Tylko prostokąt osiągalny z UI; circle/diamond/hexagon martwe; brak resize, strzałek odręcznych, stylowania obrysu |
| Frames | 7/10 | Collapse/expand, childCount; brak auto-przechwytywania node'ów upuszczonych na frame |
| Głosowanie | 6/10 | Realne E2E z DB + summary + timer; semantyka 1-głos vs UI 5 głosów; reakcje lokalne; tylko na własnej tablicy |
| Kursor multiplayer | 5/10 | Infrastruktura pełna (WS, kursory, locki, ładne stany degradacji), ale bez wspólnego dokumentu nikt drugi się nie pojawi |
| Zoom/pan/skróty | 9/10 | Pełna gramatyka Miro + `?` + minimapa + sceny/prezentacja |
| AI (Teresa) | 7/10 | Propose→accept, generatory tematyczne, nudge, ghost cards — ponad Miro AI w koncepcie; brak streamingu i podglądu pozycji propozycji na canvas |

---

## 7. PLAN ROZWOJU — Whiteboard

*Uwaga operacyjna: moduł za zamkniętą betą dla wszystkich ról — plan może iść agresywnie bez ryzyka regresji u klientów.*

### Fala 1 — Fundament multiplayer (P0, współdzielona z 02A)
1. **Wspólny dokument tablicy (shared board model)** — bez zmiany `my_idea_maps` z per-user na per-resource (+ membership/share) cała facylitacja jest teatrem jednoosobowym; blocker każdej funkcji warsztatowej.
2. **Realtime sync treści** — podpiąć whiteboard pod istniejący kanał `graph_patch` (gotowy WS + wzorzec w mindmapie) albo CRDT store.
3. **Bezpieczeństwo realtime**: autoryzacja zasobu w WS upgrade (org/idea membership) + org-scope w 5 dziurawych endpointach facilitation.

### Fala 2 — Niezawodność prod (P1)
4. **Naprawa Postgres**: przepisać `datetime(... || $n ...)` na parametryzowane interwały PG (`realtimePlatformService.ts:141, 511`) + TTL-filtr w `listToolPresence` + cron clean-stale.
5. **Odczyt stanu sesji przez uczestników**: pollować/streamować `facilitationGetSession` (timer, faza, follow-me) — kod serwera istnieje, brakuje konsumpcji.
6. **Obrazy do object storage** zamiast base64 w nodes_json — kilka wklejonych zrzutów ubija zapis całej mapy.

### Fala 3 — Miro-grade warsztat (P2)
7. **Domknięcie narzędziowe**: resize node'ów (NodeResizer), odblokowanie circle/diamond/hexagon w UI, auto-parentowanie do frame'ów, multi-dot-voting (spójna semantyka głosów).
8. **Testy runtime**: integracyjne facilitation na realnej DB, testy WS gateway, testy komponentu (hydracja extensions, undo, grupowanie) — dziś 73 zielone testy nie dotykają ani jednej linii faktycznego zachowania tablicy.

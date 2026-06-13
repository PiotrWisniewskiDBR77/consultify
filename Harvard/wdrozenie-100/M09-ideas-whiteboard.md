# WP M09 — Ideas — Whiteboard · dokończenie do 100%

**Pula:** ideas · **Karta:** `Harvard/modules/M09-ideas-whiteboard/KARTA_AUDYTU.md` (ocena 49/100) · **Rozmiar:** L (3–5 dni) · **Żywy bloker:** P0 struct (per-user dokument → multiplayer niemożliwy)
**Faza programu:** FAZA 1 (blokery) → FAZA 3 (szlif) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Najlepiej wykonane narzędzie canvas w pakiecie Ideas — solidny single-player: 11 typów node'ów (`whiteboard/nodes/nodeTypes.ts:16–31`), rysowanie pen/highlighter/gumka (`IdeaDrawingLayer.tsx:76–145`), undo/redo (25), align/distribute/lock/group, frames, sceny+tryb prezentacji, paste/drag obrazów, realny LLM (5+ generatorów, propose→accept/reject), kompletne API facilitation (12 endpointów DB-backed, `realtime-platform.routes.ts:457–849`, tabele w baseline prod), **i18n wzorcowy 149 kluczy PL/EN (najlepszy w pakiecie)**, 73 testy PASS. **Dwa fundamentalne problemy:** (1) **strukturalny P0** — `my_idea_maps` per-user (`WHERE idea_id AND user_id AND organization_id`, `my-work.routes.ts:3677`) → drugi uczestnik nie załaduje tej samej tablicy (404), więc cała warstwa facilitation/multiplayer to teatr jednoosobowy; (2) **brak realtime syncu treści** — whiteboard nie nadaje/odbiera `graph_patch` (konsumuje go tylko mindmapa). Karta zgłasza WS resource-auth + cross-org facilitation + PG datetime jako naprawione (`b9f2dee9d2`/`1b67579d7a`/`0b81310448`) — zweryfikować.

## 2. Luki do DoD

### (a) STRUKTURA / BACKEND — **P0 bloker struct (FAZA 1) — blocker całej wartości workshopowej**
- **[P0-struct] Per-user dokument blokuje multiplayer.** `my_idea_maps` keyed `WHERE idea_id=? AND user_id=? AND organization_id=?` (`my-work.routes.ts:3677,3656–3660`) — cudza idea → 404. Facilitation celuje w tablicę, której 2. użytkownik nie może załadować → multiplayer niemożliwy niezależnie od jakości API. Fix: shared board model — `my_idea_maps` z per-user na per-resource (idea jako shared document + membership/share model). Weryfikacja: `GET /map` zwraca tablicę dla każdego członka org z dostępem. **Najcięższy element pakietu (rozmiar L).**
- **[P1] Brak realtime syncu treści whiteboardu.** `graph_patch` z WS konsumowany wyłącznie przez mind-mapę (`IdeaRecommendationMap.tsx:2811`); whiteboard nie nadaje/odbiera patchy. Fix: podpiąć whiteboard pod kanał `graph_patch` (gotowy WS + wzorzec mindmapy). Weryfikacja: zmiana węzła u A natychmiast u B.

### (b) BEZPIECZEŃSTWO / WS — P0/P1 (FAZA 1, zweryfikować)
- **[P0→zweryfikować] WS resource-auth + cross-org facilitation.** Karta: NAPRAWIONE (`b9f2dee9d2`) — `ideaCollabWs.gateway.ts:235–252` DB-check `WHERE id=? AND organization_id=?`; 5 facilitation GET/PUT (`:686,696,750,807,816`) wołają `getFacilitationSession(orgId,...)`. **Zweryfikować w kodzie**, bo karta wcześniej listowała `facilitationGetVotes/GetRoles/GetOutcomes/ExportOutcome` bez org-scope (P0 WRITE @ `api.ts:18579`). Jeśli żywe: membership check w routes. **WS gateway WSPÓLNY z M06/M07.**

### (c) NIEZAWODNOŚĆ PROD — P1 (FAZA 1, zweryfikować)
- **[P1→zweryfikować] PG datetime crash.** `realtimePlatformService.ts:141 (cleanStalePresence)` + `:511 (acquireEditLock)` — `datetime(... || $n)` string-concat nieprzetłumaczalne przez PG adapter → lock/clean-stale crashuje na prodzie. Karta: NAPRAWIONE (`1b67579d7a`, `NOW() ± ($N * INTERVAL '1 minute')`) + TTL-filter presence (`0b81310448`). **Zweryfikować + smoke na PG.**

### (d) FRONTEND / fasady (FAZA 3)
- **[P1] Stan sesji facilitation nieczytany przez uczestników** — `facilitationGetSession` (`api.ts:18483`) 0 call-sites → uczestnik nigdy nie widzi timera/fazy/follow-me. Fix: polling stanu sesji.
- **[P2] Role = samonadawanie** (`cycleSessionRole` `:1101–1125`) — serwer zapisuje `permissions`, żaden endpoint nie egzekwuje. Fix: enforcement ról.
- **[P2] Governance/klasyfikacja+watermark FE-only** — blokada eksportu tylko w UI (`IdeaExportMenu.tsx:177`); BE nie weryfikuje przy `/map` PUT. Fix: BE enforcement classification_level.
- **[P2] Emoji-reakcje / activity log / library lokalne** (nie persystowane); wstaw z biblioteki = `libraryItems[0]` (`:1302–1351`).
- **[P2] Obrazy base64 w nodes_json** + limit body 10 MB (`server/src/index.ts:923`) → kilka zrzutów = trwały fail zapisu mapy. Fix: object storage.
- **[P2] Semantyka głosów niespójna** — upsert 1-głos/node (`realtimePlatformService.ts:293–296`) vs UI 5-dot-voting (`IdeaMapWorkspace.tsx:2741`).

### (e) MARTWY KOD / domknięcie narzędziowe (FAZA 3)
- `useIdeasTeresaBridge.ts` (0 importerów) → wytnij; `whiteboardCanon.ts` spec-only.
- Kształty circle/diamond/hexagon: handlery istnieją (`useWhiteboardQuickActions.ts:45–47`), UI emituje tylko rectangle (`WhiteboardToolbar.tsx:127–129`) → odblokować.
- Resize node'ów (NodeResizer), auto-parentowanie do frames.

### (f) TESTY / E2E (FAZA 1 + 4)
- 73 testy = spec-stałe + serwis zmockowany + smoke sync; **zero testów komponentu whiteboardu, zero WS gateway (resource-auth), zero integracyjnych facilitation na realnej DB, zero E2E.** Dodać: test WS org-scope, integracja facilitation na DB, test shared board model (po Fala 1). CI gate `Londyn` (FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 1, P0-struct)** Shared board model: `my_idea_maps` per-resource + membership/share; `GET /map` dla każdego członka org. Najcięższy krok (L).
2. **(FAZA 1, P1)** Podpiąć whiteboard pod `graph_patch` (realtime sync treści).
3. **(FAZA 1)** Zweryfikować/dodać WS resource-auth (wspólny z M06/M07) + org-scope 5 facilitation endpointów + naprawę PG datetime (smoke na PG).
4. **(FAZA 3)** Odczyt stanu sesji przez uczestników (polling); enforcement ról; governance BE; dot-voting spójny.
5. **(FAZA 3)** Object storage obrazów; odblokowanie kształtów; NodeResizer; sprzątanie martwego kodu.
6. **(FAZA 4)** Testy WS/integracja facilitation/shared board + E2E; CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** shared board model (2. uczestnik ładuje tablicę); realtime sync treści (A→B); stan sesji czytany; zero fasad multiplayer.
2. **Bezpieczeństwo:** WS resource-auth (Org B → 403); facilitation org-scope na 5 endpointach; PG lock/clean-stale bez crash; governance BE enforced.
3. **i18n:** `t()` pełne (już wzorcowy 149 kluczy).
4. **Tokeny:** Visual Standard.
5. **§27:** N.D. (canvas).
6. **E2E w PR-gate:** WS org-scope + facilitation DB + shared board zielone na `Londyn`.

## 5. Weryfikacja
- Shared board: user A tworzy tablicę → user B (ta sama org, dostęp) → `GET /map` 200, ładuje tę samą tablicę (nie 404).
- Realtime: A przesuwa węzeł → B widzi natychmiast.
- WS: token Org B na `ideaId` Org A → upgrade 403.
- PG: `acquireEditLock`/`cleanStalePresence` na Postgres bez błędu (smoke staging).
- Facilitation: GET votes/roles/outcomes dla obcego sessionId → 403.
- Uwaga DB: prod = commit ~2026-05-18; dev `.env` → Railway zdalna; OSTROŻNIE przy migracji per-resource (zmiana klucza dostępu = ryzyko regresu single-player).

## 6. Zależności
- **WS org-scope WSPÓLNY z M06 i M07** (`ideaCollabWs.gateway.ts`) — jeden fix zamyka 3 moduły.
- Blob-sync/`useIdeaMapSync` wspólny z M05/M06/M07/M08 — **shared board model zmienia kontrakt `my_idea_maps` dla CAŁEJ puli Ideas** (per-user→per-resource) → koordynować z M05 (zarządzanie) i pozostałymi narzędziami; ryzyko regresu single-player.
- Eksport PNG/SVG/MD/JSON oraz `/api/realtime-v4/tool-sessions` presence — wspólne z facilitation.

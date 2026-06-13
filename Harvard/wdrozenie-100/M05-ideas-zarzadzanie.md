# WP M05 — Ideas — Zarządzanie · dokończenie do 100%

**Pula:** ideas · **Karta:** `Harvard/modules/M05-ideas-zarzadzanie/KARTA_AUDYTU.md` (ocena 60/100) · **Rozmiar:** M-L (2–4 dni) · **Żywy bloker:** P0 struct
**Faza programu:** FAZA 1 (blokery) → FAZA 3 (szlif) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Najdojrzalszy obszar My Work: realny CRUD per-user+org (`my-work.routes.ts:2413/2553/2750/3020`), mapa z optimistic-concurrency `baseVersion` i 409 (`my-work.routes.ts:3874,3949–3970`), autosave FE z debounce+flush na visibility/online/Cmd+S (`useIdeaMapSync.ts:338–373`), foldery/ulubione/recents, 3 widoki listy (table/grid/garden, ResizableTable/§27), bogate AI (LLM realny), konwersja idea→6 outputów z INSERT-ami i krawędziami link-graph (`my-work.routes.ts:5888`), 96 testów FE PASS. Org-scope `WHERE user_id=? AND organization_id=?` konsekwentny — **zero cross-org IDOR**. Karta zgłasza re-audit (commity `0b81310448`/`0fc53cd9f1`) twierdzący, że oba P0 naprawione — **należy to zweryfikować w kodzie i na DB, bo prompt programu klasyfikuje je jako żywe blokery FAZY 1** (rozjazd karta↔plan). Blokuje tier: integracja persystencji 4 narzędzi, snapshoty, testy serwerowe.

## 2. Luki do DoD

### (a) BACKEND / INTEGRACJA — **P0 blokery struct (FAZA 1)**
- **[P0] Conflict-handler silent overwrite (409 bez merge).** `handleGraphConflict` (`IdeaMapWorkspace.tsx:451–461`) pokazuje toast „Odświeżam mapę z serwera", ale nie woła refresh; `useIdeaMapSync.ts:264–268` po 409 podbija `serverVersionRef` do wersji serwera → następny flush przechodzi i nadpisuje równoległe zmiany (last-write-wins, bez merge). **Karta:** re-audit twierdzi NAPRAWIONY (`0b81310448` dodał `conflictRefreshRef.current?.()` @ `:463`) — **zweryfikować, że refresh faktycznie rehydruje graf z serwera, nie tylko podbija wersję.** Fix (jeśli żywy): realny `graphRuntime.refresh()` po 409 + decyzja merge/odrzucenie zamiast cichego podbicia.
- **[P0] `my_idea_map_snapshots` bez migracji → wieczne 503.** `requireTables(res, ['my_idea_map_snapshots'])` blokuje 3 endpointy (`my-work.routes.ts:4515,4563,4626`); klient połyka cicho (`IdeaExportMenu.tsx:498–509`). **Karta:** re-audit twierdzi migracja istnieje (`20260611_my_idea_map_snapshots_and_activity.sql`, commit `0fc53cd9f1`) — **zweryfikować plik w `server/migrations*/` + status na staging.** Tabela WSPÓLNA z M06 (snapshots+activity). Fix (jeśli brak): `CREATE TABLE IF NOT EXISTS` snapshots+activity, smoke 201.

### (b) BACKEND / INTEGRACJA — P1 (FAZA 3)
- **[P1] Wielu writerów do jednego wiersza mapy.** table/process_flow/whiteboard tworzą niezależne instancje `useIdeaMapSync` z własnym licznikiem wersji (`useTablePersistence.ts:111`, `IdeaProcessFlowTool.tsx:531`, `IdeaWhiteboardTool.tsx:645`) → samowywołane 409; tylko mindmap dostaje współdzielony `externalRuntime` (`IdeaMapWorkspace.tsx:2828–2840`). Fix: jeden runtime dla 4 narzędzi.
- **[P1] Brak flusha przy odmontowaniu/przełączeniu narzędzia.** Cleanup czyści timery bez flusha (`useIdeaMapSync.ts:375–381`) → utrata zmian <800 ms. Fix: flush synchroniczny / `sendBeacon` w cleanup.
- **[INTEGRACJA] Eksport serwerowy = rejestr bez pliku (STUB).** `POST /api/v4-final/ideas/:id/export` (`final-batch.routes.ts:32`) tylko INSERT do `idea_exports`, żaden worker nie tworzy pliku; FE `catch(()=>undefined)` (`IdeaExportMenu.tsx:498–509`). Decyzja: worker generujący plik ALBO ukryć przycisk.

### (c) FRONTEND / UX (FAZA 3)
- **[P2] Szablon nadpisuje graf bez potwierdzenia** (`IdeaTemplateGallery.tsx:1886–1908`) — dodać confirm gdy `nodes.length>0`.
- **[P2] Notatki w IdeaContextPanel efemeryczne** (`useState`, reset po unmount, `IdeaContextPanel.tsx:141,895–905`) — endpoint `PATCH /my-ideas/:id/context-notes` + kolumna.
- **[P2] `canvasLocked=false` hardcode** (`IdeaMapWorkspace.tsx:373`) + **4× `console.log`** (`:433,719,1172,1809`) — sprzątnąć.
- Brak komunikatu UI przy 503 snapshot — zamiast cichej pustki.

### (d) MARTWY KOD / decyzje (FAZA 3)
- `IdeaCanvasToolSelector.tsx` (158 l., niemontowany) → wytnij.
- `my_idea_edges` API+migracja bez FE → oznaczyć `RESERVED` (zostaw świadomie).
- **`my_idea_map_versions` (mig. 622) vs `my_idea_map_snapshots`** — split-brain: jedna tabela ma kod bez tabeli, druga tabelę bez kodu. Rozstrzygnąć kanon wersjonowania, wepnij jedną, wytnij drugą.

### (e) TESTY / E2E (FAZA 1 + 4)
- **[P0 testowy]** zero testów ścieżki 409→refresh→merge (S3) — największa luka. Dodać `tests/integration/ideas/map-sync-conflict.test.ts`.
- Brak BE round-trip create→sync→reload (S2), konwersji→INSERT (S5), snapshotów (S6).
- E2E `qa-idea-mindmap-checklist.spec.ts` w nightly, nie w tier0 — dodać; CI gate tylko `[main,develop]` → dodać `Londyn` (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 1, P0)** Zweryfikować w kodzie+DB stan obu P0 z karty (`0b81310448`/`0fc53cd9f1`). Jeśli żywe: realny refresh po 409 (rehydracja, nie podbicie wersji) + migracja snapshots/activity. Test integracyjny 409 + smoke snapshot 201.
2. **(FAZA 3)** Jeden `externalRuntime` persystencji dla 4 narzędzi (wzorzec mindmap) — koniec samowywołanych 409.
3. **(FAZA 3)** Flush w cleanup (`sendBeacon`); confirm przed szablonem; notatki context-panel trwałe; sprzątanie martwego kodu/logów/`canvasLocked`.
4. **(FAZA 3)** Rozstrzygnąć `versions` vs `snapshots` (kanon wersjonowania) — wepnij jedno, wytnij drugie.
5. **(FAZA 3, INTEGRACJA)** Eksport serwerowy: worker pliku ALBO ukrycie przycisku + czyszczenie telemetrii.
6. **(FAZA 4)** Testy BE/integration S2/S3/S5/S6 + E2E checklist do tier0 + trigger CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** conflict rehydruje (nie nadpisuje cicho); snapshoty 201; 4 narzędzia jeden runtime bez 409; eksport tworzy plik LUB przycisk schowany; zero martwych przycisków.
2. **Bezpieczeństwo:** org-scope utrzymany (już bez IDOR); presence channelId org-scope rozważony (P2).
3. **i18n:** `t()` pełne.
4. **Tokeny:** Visual Standard; brak `console.log`/`canvasLocked` vestigial.
5. **§27:** lista idei przez FilterableTable/ResizableTable + Menu 1/2/3.
6. **E2E w PR-gate:** S2/S3/S5 + checklist zielone na `Londyn`.

## 5. Weryfikacja
- Conflict: dwa taby równoległa edycja → sync → UI rehydruje z serwera, brak cichego nadpisania (test + screenshot po wymuszonym 409).
- Snapshot: `POST /:id/map/snapshots` → 201 (po migracji); reload → snapshot trwały.
- Przełącznik: mindmap→table→whiteboard bez 409 w network tab.
- Konwersja: idea→initiative → INSERT do `initiatives` + `link_graph_edges`.
- Uwaga DB: dev `.env` może wskazywać Railway PROD (centerbeam) — ostrożnie z zapisami na żywo.

## 6. Zależności
- **Migracja `my_idea_map_snapshots`/`my_idea_activity` WSPÓLNA z M06** — jedna migracja zamyka oba moduły; koordynować.
- Conflict-handler i `useIdeaMapSync` współdzielone z M06/M07/M08/M09 (`canvas/useIdeaMapSync.ts`) — fix promieniuje na całą pulę Ideas.
- Rozstrzygnięcie `versions` vs `snapshots` wpływa na M06 (oba używają snapshotów).
- §27 listy idei niezależne od kręgosłupa (Faza 0) — można równolegle.

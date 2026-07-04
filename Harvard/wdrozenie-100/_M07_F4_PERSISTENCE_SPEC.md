# M07 F4 — SPEC: Migracja persystencji Process Flow → externalRuntime
**Autor logiki:** Fable 5 (orkiestrator M07) · 2026-07-04 · **Wykonawca:** agent Opus
**Baza:** worktree `.claude/worktrees/agent-a4140c9776c425306`, gałąź `feat/m07-finisz` (po F3 `6060070710`). Wsad: dokument decyzyjny F4-recon (2026-07-04).

## Cel i wartość
Process Flow porzuca własną, drugą instancję `useIdeaMapSync` i konsumuje wspólny `externalRuntime` (`useWorkspaceGraphRuntime`) tak jak Mind Map. Efekt: jeden runtime persystencji/wersjonowania na `ideaId` (koniec split-brain między narzędziami tej samej idei). BEZ zmiany zachowania widocznego dla użytkownika — to refaktor unifikacyjny (P5).

## Wzorzec docelowy (referencja — NIE kopiuj bezmyślnie, dostosuj)
`src/components/MyWork/mindmap/useMindMapPersistence.ts` — **dual-mode adapter**: gdy `externalRuntime` podany → deleguje CAŁĄ persystencję do niego; gdy `undefined` → fallback na dawną lokalną logikę. Kanonicznym właścicielem grafu pozostaje LOKALNY stan ReactFlow w `IdeaProcessFlowTool`, `externalRuntime.graph` to read-only mirror dla paneli.

## Kontrakt externalRuntime (istnieje, NIE zmieniaj)
`IdeaMapWorkspace.tsx:2897-2909` buduje z `graphRuntime.*`:
`{ version, loading, saving, lastSavedAt, syncState, nodes, edges, extensions, captureGraph(graph,{reason,immediate}), flushGraph({reason,createSnapshot,snapshotLabel}), refresh() }`.
Typ jest inline'owany (brak eksportowanego wspólnego typu) — zduplikuj interfejs w PF tak jak Mind Map (dec.: NIE eksportuj nowego typu z `workspaceGraphRuntime.ts`, żeby nie dotykać wspólnego pliku).

## Zadania (kolejność minimalizująca czas „in progress" wspólnego pliku)

### Z1 — Nowy adapter PF-only `src/components/MyWork/processflow/useProcessFlowPersistence.ts`
Strukturalnie skopiowany z `useMindMapPersistence.ts`. Odpowiedzialności:
- Hydratacja: gdy `externalRuntime` → czytaj z jego `nodes/edges/extensions/version` (NIE własny `Api.getMyIdeaMap`); fallback (brak runtime) → dawna ścieżka (`Api.getMyIdeaMap` + `resolveIdeaMapHydration`).
- Zapis draft/manual: `externalRuntime.captureGraph(payload,{reason:'draft'})` / `flushGraph({reason:'manual',createSnapshot:true})`; fallback → `queueSync`/`flushNow`.
- Re-hydratacja na conflict (`syncState==='conflict'` → `externalRuntime.refresh()`) i na skok wersji >1 (peer change; NIE na własny +1 — unikaj „skoku do lewego-górnego rogu").
- Zwróć API zbliżone do dziś używanego przez host (`saving, syncState, lastSavedAt, save(), scheduleSave(payload)`), by zmiany w `IdeaProcessFlowTool` były punktowe.

### Z2 — `IdeaProcessFlowTool.tsx`: przepięcie
- Dodaj `externalRuntime?: <interfejs>` do `IdeaProcessFlowToolProps`.
- Usuń bezpośrednie `useIdeaMapSync` (357-363), własny `hydrate()`/`Api.getMyIdeaMap` (~843-856), wszystkie `primeServerVersion` (parent `graphRuntime.refresh` robi to sam — martwy kod po migracji).
- `handleSave` (Ctrl+S) → adapter `save()`.
- **KRYTYCZNE — autosave effect (~1560-1575): ZACHOWAJ guard F3 CO DO LITERY:**
  ```ts
  if (lastChangeOriginRef.current === 'remote') { lastChangeOriginRef.current = 'local'; return; }
  scheduleSave(buildPersistPayload());   // adapter → captureGraph, NIE bezpośrednio flush
  ```
  Pominięcie tego guarda = regresja: zdalny patch (od kolegi) zapisany ponownie pod własnym baseVersion → last-writer-wins kasuje `extensions.processFlow` drugiego uczestnika. To jest ryzyko #1 tej fali.
- `graph_snapshot` (undo/redo, auto-layout, AI-accept) nadal persystuje przez ten sam autosave effect (zmiana stanu → effect → `captureGraph`); NIE wołaj `flushGraph` bezpośrednio z tych ścieżek — semantyka „1 undo-step = 1 zapis" ma zostać.
- `onGraphChange`/`replaceRuntimeGraph` (mirror „state up") ZOSTAW bez zmian — działa równolegle, nie koliduje.

### Z3 — `IdeaMapWorkspace.tsx`: JEDYNA zmiana wspólnego pliku
W istniejącym bloku `activeTool === 'process_flow'` (~2937-2959) dopisz `externalRuntime={{...}}` — kopia bloku z linii 2897-2909 (ten sam, który dostaje Mind Map). **NIE ruszaj** destrukturyzacji `graphRuntime` na górze pliku, `useWorkspaceGraphRuntime`, ani bloku `whiteboard`. To reguła koordynacji z agentem Whiteboard: obie fale tylko dopisują własny blok `externalRuntime` w swoim JSX — bloki się nie nakładają, merge czysty.

### Z4 — NIE dotykać
`canvas/useIdeaMapSync.ts` (treść), `canvas/workspaceGraphRuntime.ts`, pozostałe `canvas/*`, pliki whiteboard. Fallback-owa ścieżka adaptera nadal importuje `useIdeaMapSync` — hook zostaje żywy (Whiteboard też go jeszcze używa).

## Testy (obowiązkowe, tests/ + git add -f)
- `tests/unit/mywork/processFlowPersistence.test.ts`: tryb podłączony (deleguje do externalRuntime — captureGraph/flushGraph/refresh wołane), tryb fallback (bez runtime → useIdeaMapSync), re-hydratacja na conflict i skok wersji, guard `lastChangeOriginRef` (remote → BRAK save; local → save).
- Zaktualizuj `tests/unit/mywork/processFlowCollab.test.ts` (F3, 16 testów) jeśli mockuje `useIdeaMapSync` bezpośrednio — po migracji mock celuje w adapter/externalRuntime. NIE osłabiaj asercji guarda.
- Uruchom: `npx vitest run tests/unit/mywork/ tests/integration/gateways/ src/components/MyWork/processflow/ 2>&1 | tail -20`. PF zielone. Znane pre-istniejące faile (`myWorkMainContentLayout`, `NotebookContent.manual-gate` — highlight.js) ignoruj, odnotuj.
- `npm run type-check 2>&1 | tail -30` — zero NOWYCH błędów w M07/processflow (8 pre-istniejących poza M07 — odnotuj).

## Weryfikacja żywa
Best-effort; jeśli brak `.env`/DB w worktree — odnotuj UCZCIWIE że niewykonana. NIE udawaj. Undo/redo + auto-layout + AI-accept + współbieżny patch to najważniejsze ścieżki do R6.

## Do bramki R6 (dołącz do checklisty)
- Po migracji: przełączanie narzędzi tej samej idei (Table↔PF↔Mind Map) nie gubi wersji/stanu (jeden runtime).
- Dwukliencki: zdalny patch NIE generuje `PUT /map` u odbiorcy (guard origin remote nadal działa PO migracji).

## Poza zakresem
Zmiany serwera, F5 (Edge UX), egzekucja locków serwerowo, eksport wspólnego typu runtime.

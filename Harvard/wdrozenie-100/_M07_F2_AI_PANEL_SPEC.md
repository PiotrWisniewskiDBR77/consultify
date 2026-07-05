# M07 F2 — SPEC: Realne AI w panelu propozycji Process Flow
**Autor logiki:** Fable 5 (orkiestrator M07) · 2026-07-04 · **Wykonawca:** agent Opus (fala F2)
**Baza:** gałąź `feat/m07-finisz` po F1 (`bbaac1165f`) — walidacja/readback są już client-side (`validateFlow.ts`, `generateReadback.ts`), przycisk „Propozycja AI" w toolbarze za stałą `AI_PROPOSAL_ENABLED=false`.

## Cel
`useProcessFlowAIProposal` + `AIProposalPanel` przestają celować w martwe `/api/v8/process-flow/:id/ai-proposals` i konsumują REALNY backend blobowy. Po F2 użytkownik: wpisuje prompt → dostaje propozycję zmian (podgląd operacji + before/after + ryzyka) → Akceptuj/Odrzuć → zmiany lądują na kanwie i persystują.

## Kontrakt backendu (zweryfikowany zwiadem 2026-07-04 — NIE zmieniać serwera)
- `POST /api/my-work/my-ideas/:id/ai-generate`, body wg `IdeaAIGenerateBodySchema` (my-work.routes.ts:5063-5124): `{ generatorType, tool: 'process_flow', context: { seedText, title, existingNodes, existingEdges, existingLanes, language, selection? } }`.
- Odpowiedź `AIProposalBatch`: `proposals[] = { id, type: 'graph_patch', rationale, confidence, status: 'pending', patch: { addNodes?, addEdges?, updateNodes?, moveNodes?, extensions?: { processFlow?: { lanes?, processBrief?, savingsAnalysis? } } }, citations? }`.
- Generatory istotne dla panelu: `flow_generator` (nowe węzły+krawędzie), `lane_generator` (lanes), `node_expand` (selection.primaryId), `process_savings` (updateNodes). AI Coach/Summary już działają osobno — NIE ruszać ich przepływów.
- Frontendowy klient `generateAIProposal(...)` już istnieje (używany przez savings ~IdeaProcessFlowTool.tsx:1375-1423) — użyj go, nie pisz nowego fetcha.

## Decyzje wiążące (orkiestrator)
1. **Panel zostaje własny** (`AIProposalPanel.tsx` przerabiamy) — wspólny `IdeaAISuggestionsPanel` nie umie mutacji grafu. Zachowaj obecny układ paneli PF.
2. **Wybór generatora automatyczny, nie dropdown:** prompt użytkownika idzie w `seedText` do `flow_generator` gdy brak selekcji; gdy selekcja = 1 węzeł → `node_expand` z `selection.primaryId`. (Lane-generator i savings mają już własne ścieżki — panel ich nie dubluje.)
3. **Bezpieczeństwo lane (ryzyko #1 ze zwiadu):** przed aplikacją patcha najpierw scal `patch.extensions.processFlow.lanes` z istniejącymi lanes (merge po id, nowe dopisz), potem zwaliduj KAŻDE `addNodes[].data.laneId` przeciw scalonemu zbiorowi; nieznane laneId → przypisz pierwszy lane i dodaj ostrzeżenie do listy ryzyk w panelu. Zero osieroconych referencji.
4. **Before/after w panelu z narzędzi F1:** walidacyjna delta = `validateFlow(przed)` vs `validateFlow(po-symulacji)`; readback before/after = `generateReadback(...)`. Symulacja = czysta funkcja `applyProposalPatch(nodes, edges, lanes, patch)` (nowy util, testowalny, używany i do podglądu, i do akceptacji).
5. **Akceptacja:** zastosuj patch do stanu (`setNodes`/`setEdges`/`setLanes`), wypchnij JEDEN krok undo (cała propozycja = 1 cofnięcie), potem `queueSync` (autosave przez `useIdeaMapSync` — sprawdź faktyczną sygnaturę w kodzie). Odrzucenie = nic nie mutuje. Statusy proposal trzymaj lokalnie (nie ma już backendu /resolve — usuń martwe wywołanie).
6. **Ghost-preview na kanwie (jeśli tanio):** dodawane węzły pokaż jako ghost (wzorzec `acceptGhostNode`/`_isGhost` już istnieje) na czas podglądu; jeśli to rozdmuchuje zmianę — wystarczy podgląd listowy w panelu (liczby operacji + etykiety), ghost przenieś do „odłożone".
7. **Włączenie:** `AI_PROPOSAL_ENABLED = true` + `onAIProposal` przekazany z `IdeaProcessFlowTool`. Flaga zostaje w kodzie jako wyłącznik awaryjny.
8. **UI:** wyłącznie tokeny `var(--c-*)`/istniejące klasy; ZERO nowych kolorów i większych przemeblowań wyglądu (protokół akceptacji wizualnej). i18n PL/EN dla wszystkich nowych stringów.

## Testy (obowiązkowe, tests/ + git add -f)
- `tests/unit/mywork/applyProposalPatch.test.ts`: addNodes/addEdges/updateNodes, merge lanes, nieznane laneId → fallback+warning, idempotencja po id.
- `tests/unit/mywork/processFlowAIProposal.test.ts`: hook woła ai-generate z poprawnym body (generatorType wg selekcji), mapuje batch→stan panelu, obsługa błędu HTTP (jasny komunikat, bez crasha).
- Aktualizacja testów panelowych jeśli istnieją. Uruchom pełen pakiet PF jak w F1 i podaj liczby.

## Poza zakresem
Realtime collab (F3), zmiany serwera, AI Coach/Summary/Savings (działają), wspólny IdeaAISuggestionsPanel.

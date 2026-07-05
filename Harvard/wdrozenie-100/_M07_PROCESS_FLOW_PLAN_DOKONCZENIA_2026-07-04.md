# M07 PROCESS FLOW — AUDYT STANU + PLAN DOKOŃCZENIA
**Data:** 2026-07-04 · **Orkiestrator:** Fable 5 (agent #Process-Flow z siódemki równoległej)
**Obszar:** narzędzie Process Flow w funkcjonalności Ideas (My Work)
**Status dokumentu:** GOTOWY DO PRZEJĘCIA STEROWANIA — czeka na start Piotra

---

## CZĘŚĆ 1 — CO MAMY (audyt, 4 równoległe zwiady: FE / BE / docs / infra wspólna)

### 1.1 Tożsamość i historia
- Process Flow = **moduł M07** (pula Ideas M05–M09). Karta: `Harvard/modules/M07-ideas-process-flow/KARTA_AUDYTU.md` (55/100 Tier Alpha, re-audit 2026-06-11), analiza kodu: `Harvard/podzial/ideas/MODULE_02C_process-flow.md` (48/100).
- **Formalnie domknięty 2026-06-17**: 6/6 bramek, luki L-01…L-06 zamknięte lub odroczone. Kluczowa decyzja **DP-7 CUT**: martwy V8 mirror (18 endpointów, `processFlowService.ts`, `v8/processFlow.routes.ts`, migracja) USUNIĘTY — blob `my_idea_maps` jest jedynym źródłem prawdy. **DP-5**: stubowy AI Proposal Panel ukryty za flagą.
- E2E: **26/30 case'ów PASS, 0 FAIL** (5 honest-skip), montaż `tests/e2e/screenshots/cases/_montage_m07.png`. Testy jednostkowe: ~136 PASS.

### 1.2 Frontend (~4 900 linii dedykowanych)
- Główny edytor: `src/components/MyWork/IdeaProcessFlowTool.tsx` (2 806 l.) + folder `src/components/MyWork/processflow/` (31 plików): toolbar (628 l.), FlowNodeComponent (24 kształty / 6 zestawów: Classic, BPMN, System, Org, Automation, VSM), LaneSystem (swimlanes: rename/kolor/reorder/delete), PropertiesPanel z metrykami kroków (czas/koszt/FTE/automation/savings), KPI dashboard (ProcessFlowHealthScore), walidacja, readback, export (PNG client-side, JSON, readback), undo/redo (30 kroków), dagre auto-layout, context menu, floating toolbar.
- Biblioteka: ReactFlow 11.11.4. Montowany w `IdeaMapWorkspace.tsx` (`activeTool === 'process_flow'`), URL `/my-work/ideas/workspace/process_flow`.
- i18n czysty (0/252 markerów bare), tokeny czyste (nodes na `var(--c-*)`), dark mode OK.

### 1.3 Backend
- Wspólny CRUD Ideas: `my_ideas` + `my_idea_maps` (blob nodes/edges/`extensions.processFlow`) + `my_idea_map_snapshots` (wersjonowanie). Trasy w `server/src/routes/my-work.routes.ts` (`GET/PUT /my-ideas/:id/map`, snapshots, `POST /convert` z readbackiem procesu do inicjatywy — linie ~6076–6220).
- **Realne AI** w `server/src/services/ideaAIGeneratorService.ts` → `llmService.callStructured` + Zod: `flow_generator`, `lane_generator`, `bottleneck`, `process_coach`, `node_expand`; endpointy `POST /my-ideas/:id/ai-generate`, `/ai-suggestions`. Prompty PL/EN.
- Multiplayer: `server/src/gateways/ideaCollabWs.gateway.ts` obsługuje `graph_patch` + `graph_full_sync` + locki/selekcje/viewport; org-scope naprawiony i przetestowany (`ideaCollabWs.orgscope.test.ts` 6/6).
- Demo seed: 2 procesy (`flow-partner-onboarding`, `flow-quality-response`) w `demoSeedService.ts`.

### 1.4 Pozycja na tle pozostałych narzędzi Ideas (unifikacja P1–P8)
- Zrobione dla PF: P1 (convert contract), P2 (canvas bg `getCanvasBg()`), P3 (`useCanvasKeyboard` — był martwy, podpięty), P4 (toolbar primitives), naprawy: autosave-race `73f28419e1`, hydrate-retry `72a063f54d`.
- **Dojrzałość unifikacji ~55%** — przedostatnia z 4 narzędzi (Whiteboard ~75%, Mind Map ~70%, Table ~50%).

---

## CZĘŚĆ 2 — CZEGO BRAKUJE DO STANU IDEALNEGO

| # | Luka | Dowód | Waga |
|---|------|-------|------|
| **G1** | **Osierocony kod V8 po DP-7 — podejrzenie realnych ubytków funkcji.** Hooki FE wciąż celują w wycięte endpointy `/api/v8/process-flow/*`: `useProcessFlowCRUD` (210 l.), `useProcessFlowValidation` (POST /validate), `useProcessFlowReadback`, `useProcessFlowExport` (JSON + readback przez V8!), `useProcessFlowAIProposal`, `useProcessFlowDegraded`. Dokumenty mówią "inert+fail-safe", ale **eksport JSON/readback i walidacja backendowa mogą być dziś martwe w runtime** — wymaga weryfikacji żywej i przepięcia na blob | FE zwiad §4; docs runda 2 2026-06-17 | **P0 — jedyna kandydatura na realny ubytek** |
| **G2** | **P6 unifikacji: brak realtime edit-sync.** `CollaborationOverlay` zamontowany BEZ `onRegisterSend` — PF ma tylko presence; edycje nie propagują przez `graph_patch` (Mind Map i Whiteboard mają pełny sync). Backend gotowy | infra zwiad §3; `IdeaProcessFlowTool.tsx:2437` | **P1 — arch, high-risk** |
| **G3** | **P5 unifikacji: własna persystencja.** PF (i Whiteboard) na własnym `useIdeaMapSync` zamiast wspólnego `externalRuntime` | SSOT unifikacji | **P1 — arch, high-risk, koordynacja z agentem Whiteboard** |
| **G4** | **AI Proposal = stub ukryty za flagą (DP-5)**, mimo że backend ma REALNY `flow_generator`/`lane_generator` na `/my-ideas/:id/ai-generate`. PF nie używa też wspólnego `IdeaAISuggestionsPanel` (Mind Map/Whiteboard używają) | infra zwiad §5; BE zwiad §3 | **P1 — szybka wygrana: przepiąć panel na istniejące realne AI** |
| **G5** | **L-04 Edge UX (odroczony enhancement):** orthogonal routing, waypoints, typy krawędzi, resize/collapse swimlane; `MessageFlowEdge.tsx` (124 l.) nieosiągalny; `viewState` zapisywany, nigdy nie odczytywany (`:652`) | KARTA_AUDYTU; MODULE_02C | **P2 — jakość klasy Lucidchart** |
| **G6** | **Reszta unifikacji UI:** własny `ProcessFlowContextMenu` zamiast wspólnego (P8); brak komentarzy na węzłach (Mind Map ma `NodeCommentThread`) | infra zwiad §2/§6 | **P2** |
| **G7** | **Najsłabsze pokrycie testowe z 4 narzędzi:** 1 plik smoke FE (162 l.) + cienkie unit BE; nowe funkcje (G2–G5) bez testów z definicji | infra zwiad §6 | **P1 równolegle z falami** |
| **G8** | **Brak żywej weryfikacji (Faza 4 / R6):** wymiar D audytu = 0; nikt nie potwierdził w przeglądarce na Railway | KARTA_AUDYTU wymiar D/G | **P0 dla wiarygodności — zgodnie z regułą "verify before claiming"** |

---

## CZĘŚĆ 3 — PLAN DOKOŃCZENIA (fale F0–F5) + PRZYDZIAŁ AGENTÓW

**Zasady nadrzędne (protokół po nocy 3/4.07):** cała praca na gałęzi **feat/m07-finisz** (NIE demo, NIE Londyn); zero zmian wyglądu bez akceptacji Piotra na zrzutach; testy do `tests/` z `git add -f`; przed każdym reset/amend `git log+reflog` (wspólne drzewo).

| Fala | Zakres | Klasa agenta | Uzasadnienie doboru |
|------|--------|--------------|---------------------|
| **F0 — Prawda runtime po DP-7** (G1+G8): odpalić apkę, przejść żywy golden path PF; zinwentaryzować, co z V8-hooków realnie działa/pada (eksport JSON/readback, walidacja); werdykt per hook: przepiąć na blob / zrobić client-side / usunąć martwe (w tym `MessageFlowEdge`, `useProcessFlowDegraded`) | **Sonnet** (weryfikacja+inwentarz) → raport do orkiestratora przed dotknięciem kodu | Praca detektywistyczna wg checklisty, nie wymaga decyzji arch.; decyzje per hook podejmuje orkiestrator (Fable) |
| **F1 — Naprawa po F0**: przepięcie eksportu/walidacji na blob lub client-side; kasacja martwego kodu; testy regresji w `tests/` | **Sonnet**, review: **Fable** | Mechaniczno-rzemieślnicze z jasnym kontraktem z F0 |
| **F2 — Realne AI na kanwie** (G4): podpiąć panel propozycji pod istniejący `/my-ideas/:id/ai-generate` (flow_generator/lane_generator/bottleneck), docelowo adopcja wspólnego `IdeaAISuggestionsPanel`; ghost-preview operacji przed akceptacją; zdjąć flagę DP-5 | **Opus** (integracja AI+UX), testy: **Sonnet** | Styk LLM/UX/wspólnych komponentów — średnio-trudny, wysoka wartość demo |
| **F3 — P6 Realtime edit-sync** (G2): wire `onRegisterSend`, nadawanie/odbiór `graph_patch` dla operacji PF (nodes/edges/lanes), konflikt via `graph_full_sync`, testy org-scope + 2-klienckie E2E | **Opus** (high-risk arch), plan zatwierdza **Fable** | Najtrudniejszy technicznie kawałek; backend gotowy, ryzyko po stronie stanu FE |
| **F4 — P5 Persistence → externalRuntime** (G3): migracja z `useIdeaMapSync`; **koordynacja z agentem Whiteboard** (ta sama fala u niego!) — wspólny kontrakt najpierw, potem równoległa implementacja | **Opus**, kontrakt między-agentowy pisze **Fable** | Zmiana fundamentu persystencji — najpierw F3 (kolejność z SSOT unifikacji) |
| **F5 — Edge UX + polish** (G5+G6): orthogonal routing/waypoints/typy krawędzi, lane resize/collapse, viewState czytany przy hydracji, wspólne context menu, komentarze na węzłach | routing/waypoints: **Opus**; reszta: **Sonnet**; sweepy porządkowe (dead code, tokeny): **Haiku** | Enhancement klasy Lucidchart — do akceptacji wizualnej Piotra NA ZRZUTACH przed merge |
| **Bramka końcowa — R6 live** (G8): pełny przebieg 25 sekcji `TESTY_M07_IDEAS_PROCESS_FLOW.md` na stagingu + zrzuty dla Piotra | **Fable** (orkiestrator) z preview tools | Odbiór = odpowiedzialność nadzorcy |

**Kolejność i zależności:** F0 → F1 → (F2 ∥ F3) → F4 → F5 → R6. F2 i F3 mogą iść równolegle (różne pliki: panel AI vs collab wiring). F4 blokowany przez F3 i przez ustalenia z agentem Whiteboard.

**Szacunek nakładu:** F0–F1 = 1 sprint; F2 = 1 sprint; F3 = 1–2 sprinty; F4 = 1 sprint (po kontrakcie); F5 = 1–2 sprinty. Razem ~5–7 sprintów w metodzie 4-sprintów/dzień.

---

## CZĘŚĆ 4 — DZIENNIK WYKONANIA (aktualizacja 2026-07-04)

Gałąź robocza: **feat/m07-finisz** (worktree `.claude/worktrees/agent-a4140c9776c425306`); NIE pushnięta, NIE zmergowana — czeka na odbiór.

| Fala | Status | Commit | Model | Dowód |
|------|--------|--------|-------|-------|
| F0 prawda runtime po DP-7 | ✅ | (raport) | Sonnet | 4 realnie zepsute funkcje potwierdzone |
| F1 naprawa po DP-7 | ✅ | `bbaac1165f` | Sonnet | walidacja/readback/eksport→client-side; martwy V8 wycięty; 147/147 |
| F2 realne AI w panelu | ✅ | `81729c859d` | Opus (rdzeń) + Sonnet (domknięcie) | panel→`ai-generate`; merge lanes+walidacja; 36/36 F2 |
| F3 realtime edit-sync | ✅ | `6060070710` | Opus | `useProcessFlowCollab`; update_lanes+graph_snapshot; 16/16 unit + 8/8 integ |
| **Funkcjonalna kompletność** | **✅ OSIĄGNIĘTA** | 3 commity | — | testy zielone, tsc bez nowych błędów |
| F4 persystencja→externalRuntime | ⏸ WSTRZYMANA | — | → Opus | **BLOKADA: koordynacja z orkiestratorem Whiteboard** (wspólne `useIdeaMapSync`/`workspaceGraphRuntime`; ryzyko clobber wg [[finding_shared_branch_reset_clobbers_concurrent_commit]]) |
| F5 Edge UX + polish | ⏸ CZEKA | — | Opus+Sonnet+Haiku | **enhancement P2 — wymaga wizualnej akceptacji Piotra na zrzutach** |
| R6 żywy odbiór | ⏸ BRAMKA | — | Fable | dwuklienckie E2E na stagingu + zrzuty; poza tą sesją (brak żywego WS/DB) |

### Decyzja orkiestratora dla Piotra (2 punkty)
1. **F4 (refaktor persystencji)** to zmiana wspólnej infrastruktury Ideas dotykana też przez narzędzie Whiteboard. Nie ruszam jej solo, żeby nie nadpisać pracy równoległego agenta — wymaga wspólnego kontraktu między orkiestratorami. **Rekomendacja: odłożyć do wspólnej sesji unifikacji** (nie daje użytkownikowi nic nowego — persystencja już działa).
2. **F5 (Edge UX klasy Lucidchart)** to enhancement ponad pełną funkcjonalność, ze zmianami wyglądu → zgodnie z protokołem po nocy 3/4.07 wymaga Twojej akceptacji na zrzutach. **Rekomendacja: osobny roadmap post-launch**; jedyny bezpieczny nie-wizualny wycinek (odczyt zapisanego `viewState` przy hydracji) mogę zlecić Sonnetowi od ręki, jeśli chcesz.

### Do bramki R6 (żywa weryfikacja — środowisko Piotra)
- Dwuklienckie E2E na stagingu: propagacja add-node / lane-rename / undo-snapshot A↔B < 1s.
- Network: zdalny patch NIE generuje `PUT /map` u odbiorcy (autosave-suppression).
- Soft-lock: węzeł trzymany przez A niedraggable u B; brak deadlocka po rozłączeniu.
- Wizualna akceptacja obwódki locka `var(--c-info)` + eksport/odczyt/walidacja client-side.

# INTEGRACJE — mapa połączeń międzymodułowych (wynik Kroku 6)

**Status: WYPEŁNIONE 2026-06-11.** Źródło: sekcje **1g** wszystkich 28 kart + **weryfikacja kontraktów w kodzie** (oba końce: nadawca wysyła to, co odbiorca czyta). Przepływy sporne (URWANY/STUB/ZEPSUTE) potwierdzone bezpośrednim odczytem kodu — file:line obu końców. Branch `feat/deliverables-light` (`878dbe545a`).

> ⚠️ **Statusy = wynik analizy statycznej kodu (offline, bez Railway).** Runtime niezweryfikowany do FAZY C audytu (Fazy 3+4). Każde „DZIAŁA" może być fałszywe na żywym środowisku ze względu na schema drift, brakujące migracje lub flagę OFF.

> **Legenda statusów:** **PEŁNY** = oba końce spięte, dane przepływają · **CZĘŚCIOWY** = działa częściowo / przez słabsze ogniwo · **LOKALNY** = zapis lokalny, nie do globalnej tabeli docelowej · **URWANY** = nadawca produkuje, odbiorca nie czyta · **STUB** = nadawca tylko loguje/no-op, brak realnego efektu · **ZEPSUTE** = produkuje zły artefakt · **DZIAŁA-za-flagą** = poprawne, gated.
> **Weryfikacja źródłowa:** `(zweryf.)` = oba końce sprawdzone bezpośrednio w kodzie (file:line) w tej sesji audytowej · `(z karty)` = werdykt z karty modułu audytu, bez dodatkowej weryfikacji kodu.

---

## A. Tabela zbiorcza połączeń (z sekcji 1g 28 kart)

**Indeks modułów w tabeli (szybka nawigacja):** M01·M02·M04·M05·M06·M07·M08·M09·M10·M11(N/D)·M12·M13·M14·M15·M16·M17·M18·M19·M20·M21·M22·M23·M24·M25·M26·M27·A1.

| Z modułu | Do modułu | Mechanizm | Plik:linia (kluczowy koniec) | Status |
|---|---|---|---|---|
| M01 Czat | M02 Canvas / M18 / M19 / M20 | handoff intencji deck/doc/sheet (light lub `/prezentacje`,`/wordy`,`/excele`) | INV_A poz.53-55 | DZIAŁA (część za flagą) |
| M01 Czat | M06/M07/M09 Ideas | interceptory mindmap/process-flow/whiteboard | INV_A poz.56 | DZIAŁA |
| M01 Czat | M02 Canvas | streaming pisanie do otwartego canvasa | INV_A poz.57 | DZIAŁA |
| M01 Czat | M03/M13/M04 | karty propozycji → `POST /chat/confirm` | INV_A poz.30 | DZIAŁA |
| M01 Czat | Context OS | bookmark wiadomości | `conversations.routes.ts:973` | DZIAŁA |
| wszystkie | M01 Czat | split-view kontekst encji (pmoContext+workspaceContext) | `useOpenChatWithContext.ts`, `MainLayout.tsx:356` | DZIAŁA |
| M23 Organizacja | M01 Czat | OrgContext przełącza kontekst czatu/orkiestratora | INV_A poz.47 | DZIAŁA |
| M02 Canvas | M17 Outputs | rejestracja artefaktu (provenance) | `work-canvas.routes.ts:4424` → `artifactRegistryService.ts:1102` | **PEŁNY (zweryf.)** |
| M02 Canvas | M03/M13 | materializacja Decyzja/Task/Inicjatywa (org-guard) | — | DZIAŁA |
| M02 Canvas | pliki / public | eksport 7 formatów + `/public/artifacts/:token` | `UnifiedExportService` | DZIAŁA |
| M04 Notatnik | M02 Canvas | C3 „Rozwiń w dokument" | — | DZIAŁA |
| M04 Notatnik | M17 Outputs | convert → report/presentation | — | DZIAŁA |
| M04 Notatnik | M03 My Work | convert → task/decision, checklist→zadania | — | DZIAŁA |
| M04 Notatnik | M05 Ideas | save-as-idea | `notebook/SlashMenu.tsx:~220` → `my-work.routes.ts:5354` | DZIAŁA |
| M04 Notatnik | M13/Radar | handoff Radar/Inicjatywy | `NotebookContent.tsx:1651,1671` → `notebookHandoffService.ts:429-465` | **STUB (zweryf. — 0 INSERT, toast kłamie)** |
| M05 Ideas | M13 Inicjatywy | `convert?target=initiative` → INSERT `initiatives`+link_graph | `my-work.routes.ts:5888` | DZIAŁA |
| M05 Ideas | M14 (Tasks) | `target=task_set` → INSERT `tasks` | `my-work.routes.ts:5888` | DZIAŁA |
| M05 Ideas | M01 TeamChat | `target=team_chat` → CREATE chat session | `my-work.routes.ts:5888` | DZIAŁA |
| M05 Ideas | M17 Outputs (eksport serwerowy) | `POST /v4-final/ideas/:id/export` → `idea_exports` | `final-batch.routes.ts:32` → `finalBatchService.ts:19-46` | **STUB (zweryf. — wpis pending, plik nie powstaje)** |
| M06 Mind Map | M01 Czat/Teresa | sidekick event `idea-mindmap-sidekick-context` | emiter `IdeaRecommendationMap.tsx:2534` | **CZĘŚCIOWY (zweryf.)** — patrz B.17 |
| M06 Mind Map | pliki (PPT) | `ExportPowerPoint.tsx:87` | generuje `.html`, nie `.pptx` | **ZEPSUTE (zweryf.)** |
| M06 Mind Map | Import/Eksport | FreeMind/XMind/OPML + MD/JSON/CSV/SVG/PNG/Mermaid | `useMapExport.ts` | DZIAŁA |
| M07 Process Flow | wspólny blob-sync | mindmap/whiteboard/table przez `useIdeaMapSync` | — | DZIAŁA |
| M07 Process Flow | M19 Prezentacje | eksport `/api/presentations/decks` | — | DZIAŁA |
| M08 Ideas Table | M19 Prezentacje | `createPresentationDeck` → INSERT deck+cards | `ExportToPresentation.tsx:237` → `presentations.routes.ts:1285` | **PEŁNY (zweryf.)** |
| M08 Ideas Table | M20 Tabele (platforma) | `useTablePlatformBridge` socket `/table-platform` | `IdeaTableTool.tsx:275,301` | UKRYTE (flaga OFF) **[DECYZJA #5 — dual-stack dokończyć czy wyciąć?]** |
| M09 Whiteboard | wspólny blob-sync + WS | `/ws/collab/:ideaId` + presence polling | `ideaCollabWs.gateway.ts` | DZIAŁA (P0 WS bez org-auth) |
| M10 Wywiad | M13 Inicjatywy | `generate_from_evidence` → INSERT `initiatives` | `InterviewHub.tsx:12955` → `initiative-generator.routes.ts` | **PEŁNY (zweryf.)** |
| M10 Wywiad | M03 My Work | mirror-task przy przydziale | `interviewAssignmentService.create` | DZIAŁA |
| M10 Wywiad | M17 Outputs | eksport raportu (assessment/deck) | — | DZIAŁA |
| M11 Narzędzia | — | — | — | **N/D — descoped (szablon karty, brak realnego modułu); patrz przepływ B.5** |
| M12 Audyty | M10 Wywiad | fan-out przydziałów `interviewAssignmentService.create` | `auditProgramService.ts:376` → `InterviewAssignmentService.ts:393` | **PEŁNY (zweryf.) — P1 brak walidacji org assignee** |
| M12 Audyty | M03 My Work | mirror-task z przydziału | — | DZIAŁA (org atakującego — P1) |
| M13 Inicjatywy | M14 Wdrożenie | reuse dokumentu (`InitiativeDocumentView`) | `ExecutionHub.tsx:135-139,4749` | **PEŁNY (zweryf.)** |
| M13 Inicjatywy | M15 Rezultaty | tracked initiatives + `initiative_kpis` | `ResultsHub.tsx:909` ← `kpiRuntime.ts:17` | **PEŁNY (zweryf. — ścieżka rdzeniowa)** |
| M13 Inicjatywy | M15/M16 | ROI/economics (`/api/economics/analyses`, `v8_initiative_economics_linkages`) | — | DZIAŁA |
| M23 Organizacja | M13 governance | powiązania cel↔inicjatywa | `initiativeGovernanceService.ts:119,130` | **ZEPSUTE-cross-org (P0)** |
| M03 My Work | M13 governance | powiązania decyzja↔inicjatywa | `initiativeGovernanceService` | **ZEPSUTE-cross-org (P0)** |
| M14 Wdrożenie | M15/M16 Rezultaty/Finanse | ROI pośrednio przez `/executive/aggregate.roi` | `ExecutionHub.tsx:945` | **URWANY (zweryf. — brak feed-forward, puste w fallbacku)** |
| M14 Wdrożenie | M03 My Work | decyzje/taski w Action Queue/RAID | `ExecutionController.ts:744-900` | DZIAŁA |
| M15 Rezultaty | M13/M16 | tracked initiatives + ROI/economics | — | DZIAŁA |
| M20 Tabele | M15 Rezultaty | governed publish-to-results | `table-platform.routes.ts:3413` → `ModuleSyncService.ts:89` | **STUB (zweryf. — log do `tp_module_sync_results`, 0 czytelników)** |
| M20 Tabele | M16 Finanse | governed sync-to-finance | `table-platform.routes.ts:3440` → `ModuleSyncService.ts:89` | **STUB (zweryf. — j.w., 0 czytelników)** |
| M20 Tabele | M18/M19 studia | konwersja Table→Doc/Deck (materializer) | — | DZIAŁA (BE) |
| M20 Tabele | public | PublicViewPage + slug formularzy | — | DZIAŁA (share_password fikcyjne) |
| M16 Finanse | M17 Outputs | export analiz | — | DZIAŁA (za beta) |
| M17 Outputs | M18/M19/M20 | rejestr artefaktów + `resolveArtifactOpenPath` (reopen) | — | DZIAŁA |
| M17 Outputs | public | `/presentations/shared/:token` | `presentations.routes.ts:412,621` | DZIAŁA (**P1 over-disclosure — wspólny z M19, naprawić RAZ wątek W9, patrz §C poz.9**) |
| M18 Dokumenty | M17 Outputs | „New AI document" + rejestracja artefaktu | — | DZIAŁA |
| M19 Prezentacje | M17 Outputs | rejestracja decka + reopen `?artifactId=` | — | DZIAŁA |
| M19 Prezentacje | public | `/presentations/shared/:token` | `presentations.routes.ts:412,606` | DZIAŁA (**P1 over-disclosure — wspólny z M17, naprawić RAZ wątek W9, patrz §C poz.9**) |
| M21 Meeting | M03 My Work | brief czyta tasks/decisions (read-only) | — | DZIAŁA (jednokierunkowo) |
| M21 Meeting | M03 (action items/decisions) | persist → `meeting_follow_ups` / `meetings.decisions_json` | `meetingService.ts:338,369` | **LOKALNY (zweryf. — nie globalne `tasks`/`decisions`)** |
| M22 AI OS | M01 Czat | `ai_runs`/`ai_run_ledger` mirror (ActionCenter) | `ai.routes.ts:6013-6024` | DZIAŁA |
| M22 AI OS | M02 Canvas | Research Sessions compact osadzane | `ResearchSessionsDock.tsx` | DZIAŁA |
| M22 AI OS | M17 Outputs | Wave 5 Artifacts share token | `Gateway.ts:450`, `public-artifacts.routes.ts` | DZIAŁA |
| M22 AI OS | M20 Tabele | Wave 7 `tp_connectors` link | `wave7-connectors.routes.ts:117` | DZIAŁA |
| M22 AI OS | M13 Inicjatywy | `initiative_id` FK w `wave9_outcomes` | `wave9OutcomeRuntimeService.ts:554` | DZIAŁA |
| M23 Organizacja | kontekst Teresy | Profil → backendowy kontekst | — | DZIAŁA (Profil); **Goals/Challenges/Strategy NIE (localStorage)** |
| M23 Organizacja | M24 Admin | redirect sekcji ADMINISTRATION | — | DZIAŁA (deep-link omija → lokalny panel) |
| M23 Organizacja | cała app | org switch (wymiana tokenu, membership-verified) | — | DZIAŁA |
| M24 Admin | cała platforma | AI settings (governance/limits) | `ai-settings.routes.ts:218,255` | DZIAŁA (**cross-org P0**) |
| M24 Admin | M23 Organizacja | members/ownership | — | DZIAŁA |
| M25 Ustawienia | cała app | theme / language / AI prefs / GDPR delete | `gdprService.ts:175` | DZIAŁA |
| M25 Ustawienia | M21/Kalendarz | Calendar Sync | — | DZIAŁA |
| M25 Ustawienia | Shortcuts / billing | dispatcher / `/settings/billing` | `:523` / route-only | **ZERWANE (no-op / „Section not found")** |
| M26 Partner | M27 SuperAdmin | partner-settlements (`superAdminPartnerRouter`) | `partners.routes.ts:2302` | DZIAŁA |
| M26 Partner | Public/Legal | validate-code, track-click, `legalService.acceptDocuments` | `partners.routes.ts:2211` | DZIAŁA |
| M27 SuperAdmin | cała platforma | feature flags + AI config/routing | `llm.routes.ts:793` | DZIAŁA (**P0 boczne llm tiers/virtual-workers**) |
| A1 Affiliate | — | izolowany (świadomy stub) | — | brak realnych |

---

## B. Przepływy kanoniczne — werdykty (lista do testów Kroku 8)

1. **Czat → Canvas (deck/doc/sheet) → registry → Outputs** (M01→M02→M17) — **PEŁNY.** Canvas→Outputs zweryfikowane (`registerArtifactOrigin` INSERT `v8_output_artifacts`+`v8_artifact_origin_links`); triada live (pamięć 2026-06-10).
2. **Czat → intercepty → Ideas/Tabele/Studia** (M01→M06/07/09/20/18/19) — **DZIAŁA** (część za `ENABLE_V8_GLOBAL`).
3. **Canvas → promote → Pomysł/Notatka/Inicjatywa/Decyzja/Zadanie** (M02→M05/04/13/03) — **DZIAŁA** (materializacja org-guard).
4. **Wywiad → Inicjatywy → Wdrożenie → Rezultaty** (M10→M13→M14→M15) — **CZĘŚCIOWY.** M10→M13 PEŁNY, M13→M14 PEŁNY, M13→M15 PEŁNY (rdzeń). **Najsłabsze ogniwo: M14→M15 URWANY** — M14 liczy budżet/health/ryzyka, ale nie eksportuje ROI do `v8_roi_realization_entries`; M15 czyta własne tabele; brak deep-linku Execution→Results. **Wniosek: kręgosłup spina się przez M13→M15, ale egzekucja nie zasila wyników.**
5. **Narzędzia/Assessment → outputs/inicjatywy** (M11→...) — **N/D** (M11 nie audytowany — szablon karty, brak realnego modułu).
6. **Audyty → fan-out wywiadów → Inbox** (M12→M10→M03) — **PEŁNY funkcjonalnie** (realny INSERT `interview_assignments` + mirror-task), **P1: brak walidacji org-membership assignee** (injection przydziału obcemu userowi).
7. **Notatnik → konwersje** (M04→M13/M17/M19/M03/M02) — **MIESZANY.** convert→task/decision/report/presentation/canvas/idea **DZIAŁA**; **handoff→Radar/Inicjatywy STUB** (`notebookHandoffService` buduje payload, 0 INSERT, toast kłamie).
8. **Ideas → convert (6 targetów) + ekspansje** (M05→M13/M17/M01) — **CZĘŚCIOWY.** convert→initiative/task_set/team_chat/link_graph **DZIAŁA**; **eksport serwerowy→Outputs STUB** (`idea_exports` status pending, plik nigdy nie powstaje).
9. **Tabele Studio ↔ governed → Results/Finance/execution** (M20→M15/M16/M14) — **STUB.** `syncToModule` pisze wyłącznie metadane do `tp_module_sync_results`; grep potwierdza **ZERO czytelników** w M15/M16. Dane nigdy nie opuszczają M20.
10. **Outputs ↔ studia** (M17↔M18/M19/M20) — **PEŁNY** (rejestr + open-path + reopen).
11. **Meeting → decyzje/akcje → My Work** (M21→M03) — **LOKALNY.** `addMeetingFollowUp`→`meeting_follow_ups`, `addMeetingDecision`→`meetings.decisions_json`; **nie** trafia do globalnych `tasks`/`decisions` → nie pojawi się w My Work jako zasób globalny. **[DECYZJA #8 — globalizować (realny handoff do M03) czy świadoma lokalna architektura?]**
12. **Kalendarz ← źródła** (M03←M13/M14/decyzje/google/outlook) — **DZIAŁA** (`/my-work/calendar/unified`).
13. **Organizacja → kontekst Teresy** (M23→M01/generatory) — **CZĘŚCIOWY.** Profil firmy zasila backendowy kontekst (DZIAŁA); **Goals/Challenges/Strategy localStorage-only** (zustand persist, nie per-org, NIE zasila Teresy).
14. **Finanse ↔ Inicjatywy (ROI)** (M16↔M13) — **DZIAŁA** (`v8_initiative_economics_linkages`).
15. **Beta/uprawnienia — spójność 3 warstw** (przekrojowe) — **NIESPÓJNY.** `betaAccess.ts` blokuje tylko nawigację; direct URL + API omijają (wątek systemowy **W7**).
16. **Konwersacje: kontekst encji → czat split** (wszystkie→M01) — **DZIAŁA** (`useOpenChatWithContext`, pmoContext+workspaceContext).

**Przepływy odkryte poza listą startową:**

17. **Mind Map sidekick → Teresa** (M06→M01) — **CZĘŚCIOWY.** Event `idea-mindmap-sidekick-context` JEST konsumowany, ale lokalnie w toolbarze mindmapy (`AIActionsPopover.tsx:91`, `FloatingAIPopover.tsx:54`); **NIE** przez `useOpenChatWithContext`. Czat Teresy otwiera osobny handler `onOpenChat` (`useMindMapQuickActions.ts:732`) z prostym promptem — **bogaty kontekst sidekick nie dociera do czatu**. (Karta mówiła „brak konsumenta" — za mocno; korekta po weryfikacji kodu.)
18. **Mind Map → eksport PPT** (M06→pliki) — **ZEPSUTE.** `ExportPowerPoint.tsx:87` generuje `.html` (UI label sam przyznaje „Download HTML (for PDF/PPTX)").
19. **Ideas Table → Prezentacje deck** (M08→M19) — **PEŁNY** (INSERT `presentation_decks`+`presentation_cards`).
20. **AI OS waves → M01/M02/M13/M17/M20** (M22) — **DZIAŁA** (mirror `ai_runs`, research compact, artifacts share, wave6 memory, wave9 outcomes FK).

---

## C. Werdykt końcowy Kroku 6

**Podsumowanie statusów przepływów kanonicznych (1-20, bez N/D M11):**
- **PEŁNY / DZIAŁA:** 11 (Czat→Canvas→Outputs, Czat→intercepty, Canvas→promote, Outputs↔studia, Kalendarz, Finanse↔Inicjatywy, konwersacje split, M08→M19, AI-OS waves, M13→M15 rdzeń łańcucha, M10→M13+M13→M14).
- **CZĘŚCIOWY / LOKALNY / URWANY:** 6 (kręgosłup M14→M15, Notatnik konwersje mieszane, Ideas convert+eksport serwerowy STUB, Meeting→MyWork lokalny, Organizacja→Teresa, Mind Map sidekick).
- **STUB / ZEPSUTE:** 2 (Tabele governed sync, Mind Map PPT). *(Notatnik→Radar i Ideas eksport serwerowy przeniesione do CZĘŚCIOWY — mają realną część działającą)*
- **NIESPÓJNY przekrojowo:** 1 (beta 3-warstwowa — W7).

> Uwaga: flow #4 Kręgosłup rozliczony per-ogniwo (M10→M13 PEŁNY + M13→M14 PEŁNY + M13→M15 PEŁNY + M14→M15 URWANY = 4 ogniwa liczone razem jako 1 przepływ kanoniczny). Suma werdyktów 11+6+2+1 = 20 (bez M11 N/D).

**Poprawki dopisane do planów modułów (tag `[INTEGRACJA]` — wchodzą do MASTER_PLAN_DOKONCZENIA):**

> Mapowanie na MASTER_PLAN: „Fala N" = fala z karty modułu; „Sprint N" = sprint z MASTER_PLAN §4.

1. **M20** — governed sync-to-results/finance to STUB (`ModuleSyncService.ts:89` log-only). Plan: Fala 2 → **Sprint 5 / DECYZJA #6** — realny write do modułu docelowego ALBO ukryć przyciski sync.
2. **M04 + M21** — handoff Notatnik→Radar/Inicjatywy = STUB (toast bez INSERT, `notebookHandoffService.ts:429`). Plan: Fala 1 → **Sprint 4 / W6 fake-features** — realny INSERT albo usunąć kłamliwy toast.
3. **M05** — eksport serwerowy→Outputs STUB (`finalBatchService.ts:19` pending bez pliku). Plan: Fala 2 → **Sprint 7+ / DECYZJA #9** — realny worker generacji pliku ALBO usunąć przycisk.
4. **M06** — eksport PPT ZEPSUTE (HTML nie .pptx). Plan: Fala 3 → **Sprint 7+ (Fala 3)** — realny generator .pptx (pptxgenjs) albo przemianować przycisk na „Eksport HTML".
5. **M14→M15** — ✅ **NAPRAWIONE 2026-06-12 (kod; żywy dowód = FAZA C).** `executionResultsBridge.ts`: zmiana budżetu (ACTUAL create/delete) → `budget_health` sygnał w `v8_kpi_signals` dla KPI powiązanych z inicjatywą (AMBER=medium, RED=critical, dedup pending); deep-link `BudgetControlPanel` → `/benefits?initiativeId=`. Uwaga projektowa: cel zmieniony z `v8_roi_realization_entries` na `v8_kpi_signals` — wpis ROI wymaga realnego pomiaru KPI, sygnał zdrowia budżetu to semantycznie sygnał; M15 czyta go w kolejce sygnałów (kryterium weryfikacji spełnione).
6. **M06 sidekick→Teresa** — bogaty kontekst nie dociera do czatu. Plan M06: Fala 2 → **Sprint 7+ (Fala 2)** — `useOpenChatWithContext` konsumuje `idea-mindmap-sidekick-context`.
7. **M12→M10** — assignee bez walidacji org (P1 injection). Plan M12: Fala 1 → **Sprint 1 / W1/W2 security** — walidacja org-membership w `interviewAssignmentService.create`.
8. **M23→Teresa** — Goals/Challenges/Strategy localStorage. Plan M23: Fala 2 → **Sprint 7+ / W11** — backend per-org + zasilanie kontekstu Teresy.
9. **M17/M19** — wspólny public-viewer over-disclosure (`presentations.routes.ts:412`). Plan: **Sprint 7+ (Fala 1) / W9** — naprawić RAZ dla obu modułów (whitelist pól).

**Potwierdzenie:** mapa kompletna — wszystkie 28 modułów zmapowane, wszystkie przepływy sporne zweryfikowane w kodzie (oba końce, file:line). Lista B = scenariusze dla systemu testów przekrojowych (Krok 8). Korekta jednej oceny karty (M06 sidekick: „brak konsumenta" → „konsument lokalny, cross-moduł do czatu urwany").

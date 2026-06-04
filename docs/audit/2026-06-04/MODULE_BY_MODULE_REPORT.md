# Consultify — raport po modułach (a/b/c) — 2026-06-04

Stan AKTUALNY (po naprawach Wave 1/2). Szczegóły z file:line: `MODULE_REPORT_PART_1..4.md`.
Legenda: **a)** komponenty graficzne · **b)** kolory (light+dark) · **c)** uwagi (grafiki/kształty/UX/UI).

## Tabela werdyktów
| # | Moduł | Werdykt | Główny dług |
|---|---|---|---|
| 1 | Czat / Teresa | **PASS** | indigo→primary done, hex→token done, modals reclassified (1 converted, rest justified) |
| 2 | My Work | NEEDS-WORK (objętość) | 130 raw overlay, 129 raw select, 200 indigo |
| 3 | Wywiad | MINOR | error card hand-rolled (nie ErrorState), 2 indigo |
| 4 | Decyzje | **PASS** | wzorzec (1 trywialne indigo) |
| 5 | Assessment | NEEDS-WORK | 47 modali, 41 select, 27 indigo |
| 6 | Narzędzia | MINOR | 45 raw select, dark:slate-500 |
| 7 | Inicjatywy | NEEDS-WORK | TimelinePlanner (46 select, raw table), purple/fuchsia |
| 8 | Realizacja | MINOR (SSOT) | raw select, dark:slate-500 |
| 9 | Rezultaty | MINOR | raw table/kebab, fuchsia accent |
| 10 | Finanse | NEEDS-WORK | `bg-purple-600` CTA, fuchsia lanes, martwy EconomicsHub |
| 11 | Spotkania | MINOR | crimson jako hex literal, 5 raw modali |
| 12 | Outputs/Reports | **PASS** | best-in-class |
| 13 | Organizacja | NEEDS-WORK | raw table/select, brand default `#6366f1` (indigo) |
| 14 | Admin | MINOR | szerokość raw form controls (31 select, 26 checkbox) |
| 15 | Ustawienia | NEEDS-WORK | indigo chrome (~16 plików), fragmentacja toggle |
| 16 | Prezentacje | **PASS** (studio) | violet = semantyczna konwencja AI/share |
| 17 | Document Studio | **PASS** | najczystszy |
| 18 | Table Studio (MyWork/table) | NEEDS-WORK | indigo jako accent (13 plików) |
| 19 | Partner | **PASS** | czysty, on-brand |
| 20 | Landing | MINOR | PublicMiniAssessmentView w całości indigo; martwy HeroSection |

## 4 przekrojowe tematy (kolejność napraw)
1. **Indigo → primary/crimson sweep** — przetrwało sweep violet (na borderach/ikonach/cieniach/CTA). Najwięcej: My Work (200), Chat (73), Assessment (27), Settings (~16 plików), Table Studio (13). + punktowe: `FinanceHub.tsx:1180 bg-purple-600`, Organization brand default `#6366f1`, fuchsia accenty (Finanse lanes, Results KPI, Initiatives critical-path). **Bezpieczny, wysoka wartość.**
2. **Fragmentacja form-controls** — raw `<select>`/checkbox/toggle vs `SelectField`/`Switch` (Settings, Admin, Tools steps, Initiatives Timeline, My Work detale). Mechaniczne, behavior-sensitive.
3. **Raw `fixed inset-0` modale** → `Modal`/`Drawer` (My Work, Assessment, Chat, Initiatives; studia/in-canvas akceptowalne).
4. **Sprzątanie**: martwy `EconomicsHub.tsx` + `Landing/HeroSection.tsx`; Meeting crimson-hex→token; Wywiad error card→ErrorState.

---

## Wymiar: budowanie przez Teresę (audyt 2026-06-04)

Trzeci wymiar rozwoju modułu (obok a/b/c UI i funkcjonalności): **czy Teresa potrafi realnie ZBUDOWAĆ/OBSŁUŻYĆ moduł**, a nie tylko o nim rozmawiać. Pełna mapa z dowodami file:line: [`_TERESA_MODULE_INTEGRATION_MAP.md`](./_TERESA_MODULE_INTEGRATION_MAP.md).

Poziomy: `FULL` (twórz/edytuj realne artefakty end-to-end) · `PARTIAL` (część realnych zapisów, luki) · `ADVISORY` (czyta/proponuje) · `NONE`.

**Werdykt ogólny (audyt): ~ADVISORY-plus.** Teresa świetnie czyta i *proponuje*, ale „ostatnia mila" egzekucji była zerwana: `performHandoff` szukał per-moduł funkcji `create*`, których serwisy nie eksportowały → cichy fallback na syntetyczny ref (`real_entity:false`). FULL_BUILD: 0 · PARTIAL: 6 · ADVISORY: 9 · NONE: 8+.

> **STATUS 2026-06-04 — last-mile WDROŻONY (commity `b8219a32`, `af76c5c2`).** Realne tworzenie encji działa teraz dla **Tasks, Decisions, Initiatives, Radar, Interview, Meetings, Notebook** + kroki playbooków (task/decision). Dodane narzędzia LLM `create_task`/`update_task`/`create_decision` (powierzchnia agentów; gotowe do podpięcia do czatu). Odłożone (świadomie): persist report-section/finance (#7/#8 — decyzja produktowa/encja), Table write-lane (#9), pętla function-calling w **streamingowym** czacie (#10 — ryzyko, wymaga testu właściciela), authoring Mind Map/Whiteboard/Process Flow/Ideas/Prezentacje/Document Studio (#13 — nowe powierzchnie). Szczegóły + plan: sekcja 5 w [`_TERESA_MODULE_INTEGRATION_MAP.md`](./_TERESA_MODULE_INTEGRATION_MAP.md).

| # | Moduł | Teresa | Mechanizm (skrót) | Główna luka |
|---|---|---|---|---|
| 1 | Czat / Teresa | host | — | sam czat nie uruchamia `AI_TOOLS`; tylko proposale handoff |
| 2 | My Work — Tasks | **PARTIAL** | slash `/task`→`chat-actions` (realny INSERT); ścieżka LLM = stub | LLM nie tworzy; brak edit/assign/due; `task_type='personal'` |
| 2 | My Work — Decisions | **PARTIAL** | slash `/decision`→`chat-actions` (realny INSERT) | LLM nie tworzy; brak opcji/kryteriów/scoring/resolve |
| 2 | My Work — Mind Map / Process Flow / Whiteboard / Ideas | **NONE** | — | brak jakiejkolwiek ścieżki zapisu |
| 2 | My Work — Notebook | **PARTIAL→FULL** | handoff `notebook`→`createNote` (realny) | tylko przez handoff execute; tool = proposal-only |
| 3 | Wywiad / Interview | **PARTIAL** | handoff `interview` (mismatch nazwy fn) | szuka `generateInsight`/`createInsight`, eksport to `create` → ryzyko synth ref |
| 4 | Decyzje | **PARTIAL** | jak 2-Decisions | jw. |
| 5 | Assessment | **ADVISORY** | `get_assessment_data`, `compare_benchmarks` (read) | brak tworzenia/edycji oceny; nie uruchomi assessmentu |
| 6 | Narzędzia | **NONE** | — | brak generowania/obsługi narzędzi |
| 7 | Inicjatywy | **ADVISORY** | `create_initiative_draft`→proposal; handoff fallback | serwis to klasa, nie `createInitiative` fn → `real_entity:false` |
| 8 | Realizacja | **ADVISORY** | `update_status` istnieje, nieosiągalny z czatu | żadna ścieżka czatu nie woła `executeProposedAction` |
| 9 | Rezultaty | **ADVISORY** | `query_structured_data`, `calculate_financial` | brak tworzenia/edycji KPI/ROI |
| 10 | Finanse | **ADVISORY** | `calculate_financial`, `run_monte_carlo` (compute) | kalkulatory; wyniki nie zapisywane do encji |
| 11 | Spotkania | **PARTIAL** | `schedule_meeting`=proposal; realny `createMeeting` tylko przez adapter | nie podpięty do czatu/handoff; calendar szuka `createEvent` (brak) |
| 12 | Outputs / Reports | **ADVISORY** | `generate_report_section` (treść, bez zapisu) | sekcja nigdy nie utrwalona do encji raportu |
| 13 | Organizacja | **ADVISORY** | read KB/structured | brak create/edit org/competency/profile |
| 14 | Admin | **NONE** | tylko persona emphasis | brak akcji admina |
| 15 | Ustawienia | **NONE** | — | brak mutacji ustawień |
| 16 | Prezentacje | **NONE** | — | Teresa nie tworzy deck/slajdów |
| 17 | Document Studio | **NONE** | — | Teresa nie tworzy dokumentów |
| 18 | Table Studio | **ADVISORY** | read-only text→SQL | brak zapisu tabel/wierszy |
| 19 | Partner | **NONE** | — | brak operacji na katalogu partnerów |
| x | Radar | **PARTIAL** | handoff `radar`→`createSignal` (brak eksportu) | fallback synth ref |

**5 największych luk (last-mile):** (1) Inicjatywy — handoff woła nieistniejące `createInitiative`; (2) Radar — `createSignal` nieeksportowany; (3) Spotkania — realny `createMeeting` niepodpięty do czatu; (4) Tasks — `TaskExecutor.execute` to rzucający stub, choć działający INSERT istnieje w `actionProposalEngine.executeProposedAction`; (5) główny czat ↔ `AI_TOOLS` rozłączone (`AI_TOOLS` tylko przez `/api/ai-agents`). Pełny 13-punktowy backlog w docu mapy.

## Wymiar: Canvas na poziomie czatu (audyt 2026-06-04)

Pełna analiza: [`_CANVAS_CHAT_LEVEL_ANALYSIS.md`](./_CANVAS_CHAT_LEVEL_ANALYSIS.md). **Ocena doskonałości: 62/100** — działający, shipping-grade, ale nie world-class. Realny TipTap v3, markdown-kanon, inline accept/reject diff, streaming pisania Teresy do dokumentu, autosave z 409-retry, wersje serwerowe + restore. Najmocniejsze: persystencja/wersjonowanie (78). Najsłabsze: floating menu (52), streaming UX (48). **Kluczowa asymetria:** „mądra" ścieżka (pełny context packet `canvas-context/v1` przez `/chat/stream`) NIE ma diff/accept-reject, a „bezpieczna" ścieżka (floating menu z accept/reject) jest pozbawiona kontekstu (cheap `/chat/quick`, sam zaznaczony tekst). P0 = ujednolicić obie ścieżki + dodać diff do streamingu.

---

## Szczegóły per moduł

### 1. Czat / Teresa — MINOR
- a) Niska gęstość tabel/EmptyState (poprawne dla czatu). 15 ad-hoc `fixed inset-0` zamiast Modal.
- b) Light/dark: kontrast czysty (text-slate-300 to warianty dark). **73× indigo** leftover (np. ResearchClarification.tsx:122), 4× hex navy `[#15213b]` w WorkCanvasDocumentPanel.
- c) Konwersacyjna powierzchnia OK; indigo→primary i hex→token.

### 2. My Work — NEEDS-WORK (objętość, nie poprawność)
- a) Hub = Golden Standard. Ale 130 raw overlay, 129 raw `<select>` (TaskDetailView/DecisionDetailView po 11), brak adopcji prymitywów w detalach.
- b) 200 indigo leftover; część inline-style legit (CollaborationPresence user.color, CellRenderer); hardcoded `#334155`/`#e0e7ff` fallbacki do poprawy.
- c) Bug empty-on-failure naprawiony (Inbox/Ideas). Detale (modale, selecty) to główny dług.

### 3. Wywiad — MINOR
- a) Hub OK (ModuleHub + Menu3). Empty-vs-error naprawiony, ALE error card hand-rolled amber (InterviewHub:6488), nie kanoniczny ErrorState.
- b) Prawie czysto: 2 indigo (InterviewSummary:246), 3 hex navy.
- c) Drobny polish; ujednolicić error card do ErrorState.

### 4. Decyzje — PASS
- a) Zero raw overlay/table/checkbox. DecisionInbox:288 = referencyjny ErrorState+retry.
- b) 1 trywialne indigo (DecisionCard:81), 2 raw select.
- c) Wzorzec dla innych modułów.

### 5. Assessment — NEEDS-WORK
- a) 47 raw overlay, 41 raw select (mimo folderu modals/).
- b) 27 indigo (AssessmentStageGate:202-205, AssessmentHub:1847-1848).
- c) Empty-vs-error naprawiony (AssessmentHub:1687). Dług: modale+selecty+indigo.

### 6. Narzędzia — MINOR
- a) Nie-ModuleHub (wizard/workspace, N/A). Używa LoadingState/RowActionsMenu. 45+ raw select w tools/steps.
- b) 1 sky gradient (SWOTInputExplorationPhase:812); dark:text-slate-500 do sweepu.
- c) Form-control consistency to główny temat.

### 7. Inicjatywy — NEEDS-WORK
- a) InitiativesHub OK. Dług w sekcjach: TimelinePlanner (hand-rolled Gantt, 46 select, custom kebab), raw table/modale w ~16 plikach.
- b) Off-brand: text-purple-500 (InitiativeCompactPanel:931), bg-fuchsia-400 (InitiativesHub:1703), fuchsia critical-path.
- c) Warstwa sekcji/edytora wymaga najwięcej.

### 8. Realizacja — MINOR (Menu-3 SSOT)
- a) ExecutionHub wzorcowy (ModuleHub, FilterableTable, TableWithPreviewLayout, MENU_3_*). Residual: raw select w timeline/rollout/manager, 1 kebab (ProblemTable).
- b) Zero violet/purple/fuchsia. dark:text-slate-500 do sweepu.
- c) Referencja jakości.

### 9. Rezultaty — MINOR
- a) ResultsHub OK, RowActionsMenu w 4 widokach. ROI/KPI: raw table + custom kebab, kilka realnych modali.
- b) Fuchsia accent (ResultsKpisTableV3:458-459,635).
- c) Drill-downy do dociągnięcia.

### 10. Finanse — NEEDS-WORK
- a) EconomicsView renderuje FinanceHub (EconomicsHub MARTWY, ma stray spinner → usunąć). Hub OK; otoczenie analiz/modali/wykresów = najwięcej długu.
- b) **BLOCKER: bg-purple-600 CTA (FinanceHub:1180)** przetrwał sweep; fuchsia lanes (financeTypes:266,282, FinancePreviewPanel:679). Najgorszy dług dark-contrast (AnalysisCatalog 13, AIRecommendationsPanel 9).
- c) Usunąć EconomicsHub; naprawić CTA i lanes.

### 11. Spotkania — MINOR
- a) Dobra adopcja (FilterableTable, Menu3Row, ErrorState/LoadingState). 5 hand-rolled `fixed inset-0`.
- b) Crimson hardcoded jako `[#A51C30]`/`[#8a1828]` (:932,1036,1188) zamiast tokena `crimson`.
- c) Empty-on-failure naprawiony (:628). Hex→token.

### 12. Outputs / Reports — PASS
- a) ModuleHub+ModuleMenu3, FilterableTable z emptyMessage, LoadingState/ErrorState/StatusChip, RowActionsMenu.
- b) Empty state crimson (potwierdza fix). Nity: indigo w TemplatePreview:43-45, 3× dark:text-slate-500 (10px captions).
- c) Best-in-class empty-vs-error (OutputsAggregate:649-688).

### 13. Organizacja — NEEDS-WORK
- a) Używa LoadingState/ErrorState/EmptyState/MetaChip, ale raw `<table>` (OrganizationAdminPanel:199, CompetencyCatalog:384) i raw select.
- b) **Brand default hardcoded indigo `#6366f1`** (OrganizationAdminPanel:767-816) → powinno crimson; KGE node palette też indigo. Purple chip (CompetencyCatalog:224,236).
- c) Adopcja DataTable/SelectField + brand color fix.

### 14. Admin — MINOR
- a) Crimson-drift NAPRAWIONY (sidebar primary-*). Dług: szerokość raw form-controls (select 31 plików, checkbox 26, table 22), 6 ad-hoc dialogów.
- b) dark:text-slate-600 = 0. Większość violet/indigo to nazwy danych/swatche (legit); 4 realne indigo.
- c) AdminState.tsx = dobry degraded banner. Migracja form-controls.

### 15. Ustawienia — NEEDS-WORK
- a) SettingsSection adoptowany w ~29/150 sekcji. 22 pliki hand-roll toggle vs 19 z canonical Switch; 37 raw select.
- b) dark:text-slate-600 = 0. **Indigo chrome w ~16 plikach** (IntegrationSettings:1742-2067, AvailabilityStatusSection, AppearanceSettings). Accent-picker swatche legit (default crimson).
- c) Największy dług: indigo chrome + fragmentacja toggle/select.

### 16. Prezentacje — PASS (studio)
- a) Gamma/Studio-class spójny. Modale in-canvas akceptowalne. Stray: raw spinner BrandKitSettings:109, raw modal PresentationsHub:678.
- b) Violet = semantyczna konwencja AI/share (nie drift); deck/chart palety legit.
- c) Drobny polish.

### 17. Document Studio — PASS
- a/b/c) Najczystszy moduł: zero off-brand, zero hex, brak raw modali, spinnery małe inline. Nic do zgłoszenia.

### 18. Table Studio (`MyWork/table/**`) — NEEDS-WORK
- a) 33 pliki raw `fixed inset-0` (in-canvas OK, hub-like → Modal).
- b) **Indigo jako primary accent w 13 plikach** (GovernedModelsDashboard 12, ExtensionMarketplace 8, WebhookRelayPanel 8). Warianty dark istnieją → drift, nie kontrast. AiClassificationCell/ColorPalette legit.
- c) Indigo→primary sweep.

### 19. Partner — PASS
- a) Czysty, on-brand, dobra obsługa dark (PartnerPortalView 206 dark:). 2 portal modale raw.
- b) `#0A66C2` LinkedIn + QR hex = legit. Stale komentarz "violet accents" (kod on-brand).
- c) DirectoryView = stub (10 linii).

### 20. Landing — MINOR
- a) Core marketing (EpicHero/ProfitHero/EntryTopBar/MarketingLayout) brand-correct crimson+navy, solid dark.
- b) Off-brand: **PublicMiniAssessmentView w całości indigo+gray** (18 hits, prospect-facing!), VectorPage:163 from-indigo-50 hero, InfoSections:617 blur. Martwy Landing/HeroSection.tsx (indigo, nieimportowany → usunąć).
- c) Naprawić PublicMiniAssessmentView (widzą go klienci) + VectorPage; usunąć martwy HeroSection.

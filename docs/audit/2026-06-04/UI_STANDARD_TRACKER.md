# Consultify — UI Standard Tracker (żywa lista, czyszczenie po module)

> Jeden plik prawdy do wyrównania standardu graficznego. Aktualizowany po każdym wyczyszczonym module.
> Źródła: `MODULE_BY_MODULE_REPORT.md`, `MODULE_REPORT_PART_1..4.md`, `COLOR_USAGE_DETAILED_REPORT.md`.
> Ostatnia aktualizacja: 2026-06-04.

## Legenda statusu
- ✅ **DONE** — spełnia DoD, wyczyszczony
- 🟢 **PASS** — zgodny, kosmetyczne nity (opcjonalne)
- 🟡 **MINOR** — drobne braki, szybkie do domknięcia
- 🔴 **NEEDS-WORK** — istotny dług (modale/selecty/indigo)
- 🔵 **IN-PROGRESS** — aktualnie czyszczony

## Definicja standardu satysfakcjonującego (DoD per moduł)
1. **Shell/Menu**: ModuleHub + ModuleNavBar (Menu 2 bez `+`/Help) + Menu 3 (justify-between, AI w prawym slocie) — lub świadomy wyjątek (studio/wizard/marketing).
2. **Komponenty**: zero przypadkowych elementów — chipy=chip-system, stany=LoadingState/EmptyState/ErrorState, modale=Modal/Drawer, tabele=FilterableTable/DataTable, formularze=SelectField/Switch/Toggle, akcje wierszy=RowActionsMenu, banery=Banner.
3. **Kolory**: akcent = **HBS Crimson `#A41034`** (oficjalny, NIE #A51C30/#C90016) „lekko"; zero off-brand (indigo/violet/fuchsia/purple); zero hardcoded hex poza tokenami; neutrale = navy/slate. Patrz `_DESIGN_STANDARD.md`.
4. **Light + Dark (kontrast WCAG)**: light — body = **slate-700**, secondary = **slate-600** min, muted = slate-500 floor, **slate-400 ZAKAZANY dla tekstu** (~2.5:1 FAIL AA); dark — body ≥ slate-300, secondary ≥ slate-400. Patrz tabela w `_DESIGN_STANDARD.md`.
5. **Empty ≠ Error**: awaria ładowania → ErrorState z retry (nie pusty stan).

---

## Tabela główna (architektura · kolory · braki · status)

| # | Moduł | Architektura (shell + komponenty) | Kolory (Light/Dark) | Braki do przeprowadzenia | Status |
|---|---|---|---|---|---|
| 1 | **Czat / Teresa** | Powierzchnia konwersacyjna (nie ModuleHub — OK). Composer, sidebar historii, Voice overlay. ChatExportModal→Modal primitive | L/D kontrast **OK**. ✅ 146× indigo→primary (chat-core); ✅ 4× hex navy→navy-800 token | ✅ indigo zsweepowane; ✅ hex→token; modale: 1 skonwertowany, reszta świadomy wyjątek (lightbox/viewer/backdrop/drawer/portal-aria/testowane) | 🟢 PASS |
| 2 | **My Work** | Hub = **Golden Standard** (Menu 1/2/3, FilterableTable, ResizableTable, RowActionsMenu, chip-system, Empty/Error naprawione). Detale słabsze | L: OK po contrast-codemod. 200× indigo leftover (część inline-style legit: user.color); hardcoded `#334155`/`#e0e7ff` fallbacki | indigo→primary; 130× `fixed inset-0`→Modal; 129× raw `<select>`→SelectField (TaskDetailView/DecisionDetailView po 11) | 🔴 NEEDS-WORK *(objętość)* |
| 3 | **Wywiad** | ModuleHub + Menu 3 OK; sesje/insights/initiatives z error-flagami | 2× indigo (InterviewSummary:246); 3× hex navy | error card hand-rolled amber (InterviewHub:6488)→ErrorState; indigo→primary; hex→token | 🟡 MINOR |
| 4 | **Decyzje** | **Wzorzec**: ModuleHub-like + kanon. DecisionInbox:288 = referencja ErrorState+retry | Czysto (1× indigo DecisionCard:81) | 1× indigo; 2× raw select (kosmetyka) | 🟢 PASS |
| 5 | **Assessment** | ModuleHub + AssessmentMenu3ActionBar (pełny słownik); Empty/Error naprawione (:1687) | 27× indigo (AssessmentStageGate:202-205, AssessmentHub:1847-1848) | indigo→primary; 47× `fixed inset-0`→Modal; 41× raw select→SelectField | 🔴 NEEDS-WORK |
| 6 | **Narzędzia** | Wizard/workspace shell (nie ModuleHub — OK). LoadingState/RowActionsMenu używane | 1× sky gradient (SWOTInputExplorationPhase:812); dark:text-slate-500 do sweepu | 45× raw select→SelectField; sky→crimson; dark:slate-500→-400 | 🟡 MINOR |
| 7 | **Inicjatywy** | InitiativesHub OK (ModuleHub+Menu3+RowActionsMenu). Sekcje/edytor słabe | purple (InitiativeCompactPanel:931), fuchsia (InitiativesHub:1703 + critical-path) | indigo/purple/fuchsia→primary; TimelinePlanner 46× select; raw table/modale ~16 plików | 🔴 NEEDS-WORK |
| 8 | **Realizacja** | **Menu-3 SSOT** — ExecutionHub wzorcowy (ModuleHub, FilterableTable, TableWithPreviewLayout, MENU_3_*) | Zero violet/purple/fuchsia ✅; dark:text-slate-500 do sweepu | raw select (timeline/rollout/manager); 1× kebab (ProblemTable)→RowActionsMenu; dark:slate-500 | 🟡 MINOR |
| 9 | **Rezultaty** | ResultsHub OK; RowActionsMenu w 4 widokach | fuchsia accent (ResultsKpisTableV3:458-459,635) | fuchsia→crimson/hbs; raw table/kebab w ROI/KPI drill-downach | 🟡 MINOR |
| 10 | **Finanse** | EconomicsView→**FinanceHub** (EconomicsHub MARTWY). Hub OK; otoczenie analiz/modali/wykresów słabe | **🔴 `bg-purple-600` CTA (FinanceHub:1180)**; fuchsia lanes (financeTypes:266,282, FinancePreviewPanel:679); dark-contrast debt (AnalysisCatalog 13, AIRecommendationsPanel 9) | purple CTA→crimson; fuchsia lanes→hbs; usunąć EconomicsHub; dark:slate-500/600 | 🔴 NEEDS-WORK |
| 11 | **Spotkania** | MeetingHub: FilterableTable, Menu3Row, ErrorState/LoadingState; empty-on-failure naprawiony (:628) | crimson jako hex literal `[#A51C30]`/`[#8a1828]` (:932,1036,1188) | crimson-hex→token `crimson`; 5× `fixed inset-0`→Modal | 🟡 MINOR |
| 12 | **Outputs / Reports** | **Best-in-class**: ModuleHub+Menu3, FilterableTable+emptyMessage, LoadingState/ErrorState/StatusChip, RowActionsMenu. Empty-vs-error wzorcowy (:649-688) | Empty state crimson ✅; nity: indigo TemplatePreview:43-45, 3× dark:slate-500 (10px) | nity indigo; dark:slate-500 captions | 🟢 PASS |
| 13 | **Organizacja** | LoadingState/ErrorState/EmptyState/MetaChip; ale raw `<table>` (:199,:384) + raw select | **brand default hardcoded indigo `#6366f1`** (OrganizationAdminPanel:767-816); purple chip (CompetencyCatalog:224,236); KGE node palette indigo | `#6366f1`→crimson; raw table→DataTable; raw select→SelectField; purple chip→chip-system | 🔴 NEEDS-WORK |
| 14 | **Admin** | Layout doc 24; Admin/shared adaptery OK. Crimson-drift **naprawiony**; AdminState=dobry degraded banner | dark:text-slate-600 = 0 ✅; 4× realne indigo (reszta to nazwy danych/swatche legit) | raw form-controls (select 31, checkbox 26, table 22 plików); 6× ad-hoc dialog→Modal; 4× indigo | 🟡 MINOR |
| 15 | **Ustawienia** | SettingsSection w ~29/150 sekcji; fragmentacja kontrolek | dark:slate-600=0 ✅; **indigo chrome ~16 plików** (IntegrationSettings:1742-2067, AvailabilityStatusSection, AppearanceSettings); swatche legit | indigo chrome→primary; 22 hand-roll toggle→Switch; 37 raw select→SelectField; SettingsSection rollout | 🔴 NEEDS-WORK |
| 16 | **Prezentacje** | Studio (Gamma-class, doc 26/27 — własny standard). Modale in-canvas OK | violet = semantyczna konwencja AI/share (nie drift); deck/chart palety legit | raw spinner BrandKitSettings:109→LoadingState; raw modal PresentationsHub:678→Modal | 🟢 PASS (studio) |
| 17 | **Document Studio** | Studio (doc 26/27). **Najczystszy moduł** | Zero off-brand, zero hex ✅ | — (nic) | 🟢 PASS |
| 18 | **Table Studio** (`MyWork/table`) | Studio in-canvas; ~150 plików | **indigo jako primary accent w 13 plikach** (GovernedModelsDashboard 12, ExtensionMarketplace 8, WebhookRelayPanel 8); warianty dark istnieją (drift, nie kontrast) | indigo→primary sweep; 33× `fixed inset-0` (hub-like→Modal) | 🔴 NEEDS-WORK |
| 19 | **Partner** | Marketing/portal; dobra obsługa dark (206 dark:) | on-brand ✅; `#0A66C2` LinkedIn + QR = legit | 2× portal modal→Modal; DirectoryView stub; stale komentarz | 🟢 PASS |
| 20 | **Landing** | Marketing (własny standard). Core (EpicHero/ProfitHero/EntryTopBar/MarketingLayout) brand-correct crimson+navy, solid dark | **PublicMiniAssessmentView w całości indigo+gray (18 hits, prospect-facing!)**; VectorPage:163 from-indigo-50; InfoSections:617 blur | PublicMiniAssessmentView→crimson; VectorPage hero; usunąć martwy Landing/HeroSection.tsx | 🟡 MINOR |

**Przekrojowo:** martwy kod do usunięcia — `Economics/EconomicsHub.tsx`, `Landing/HeroSection.tsx`.

---

## Plan czyszczenia — kolejka modułów (odhaczamy po kolei)

> Kolejność wg wartości/ryzyka. Każdy moduł: gating tsc 0 + `eslint . --quiet` 0 + (kluczowe) build, commit, aktualizacja statusu w tej tabeli.

### Fala 1 — najwyższa wartość, bezpieczne (kolor + punktowe bugi)
- [ ] **10 Finanse** — `bg-purple-600` CTA→crimson; fuchsia lanes→hbs; usunąć martwy EconomicsHub
- [ ] **20 Landing** — PublicMiniAssessmentView indigo→crimson; VectorPage hero; usunąć martwy HeroSection
- [ ] **13 Organizacja** — brand default `#6366f1`→crimson; purple chip→chip-system
- [ ] **11 Spotkania** — crimson-hex→token; (opcj.) 5 modali→Modal
- [ ] **Indigo→primary sweep (globalny, ostrożny)** — Czat 73, Assessment 27, Table Studio 13, Settings ~16, Inicjatywy/Results/Reports nity

### Fala 2 — strukturalne (form-controls)
- [ ] **15 Ustawienia** — toggle→Switch, select→SelectField, SettingsSection rollout
- [ ] **14 Admin** — select/checkbox→prymitywy, dialog→Modal, RowActionsMenu
- [ ] **6 Narzędzia** — select→SelectField (tools/steps)
- [ ] **7 Inicjatywy** — TimelinePlanner select/table/kebab

### Fala 3 — modale → Modal/Drawer (wizualne, z checkpointami)
- [ ] **2 My Work** — 130 overlay (detale: Task/Decision modals)
- [ ] **5 Assessment** — 47 overlay
- [ ] **1 Czat** — 15 overlay
- [ ] **9 Rezultaty / 18 Table Studio** — hub-like overlay

### Fala 4 — polish/domknięcia
- [ ] **3 Wywiad** — error card→ErrorState
- [ ] **8 Realizacja / 12 Reports** — dark:slate-500 sweep + nity
- [ ] **16 Prezentacje** — spinner/modal nity
- [ ] **4 Decyzje** — 1 indigo + 2 select (kosmetyka)

### Już zgodne (monitor)
- [x] **17 Document Studio** — PASS (najczystszy)
- [x] **19 Partner** — PASS

---

## Postęp ogólny
- PASS/DONE: 4/20 (Decyzje, Reports, Document Studio, Partner)
- MINOR: 7/20 · NEEDS-WORK: 7/20 · Studio-PASS: 2/20
- Cel: wszystkie ≥ 🟢 PASS wg DoD.

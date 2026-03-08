# V3 Action Plan (from SSOT) — Change Register → Plan działania
>
> **Status:** Draft (working doc)  
> **Owner:** Piotr + team  
> **Last updated:** 2026-03-07  
>
> **Cel dokumentu:** zamienić SSOT (źródła prawdy + notatki procesowe) na **jeden, kompletny rejestr zmian** (“co trzeba dowieźć”), który następnie można zamienić w **plan sprintów / plan wdrożenia**.
>
> **Zasada:** jeśli coś jest w SSOT, ale **nie ma mapowania do taska** w `docs/product/V3_IMPLEMENTATION_PROGRAM.md` → to jest **GAP** i musi mieć decyzję: *dodajemy do programu V3* albo *świadomie wycinamy z cutline*.

---

## 0) Źródła wejściowe (KANON)

Ten dokument jest zrobiony na podstawie:

- **Proces E2E + backlog + open gaps**: `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
- **Task ledger (V3 program)**: `docs/product/V3_IMPLEMENTATION_PROGRAM.md`
- **SSOT index**: `docs/product/REQUIREMENTS_V3_SSOT.md`
- **UI standards (kanon komponentów i modułów)**: `docs/ui-standards/README.md` + `docs/ui-standards/UI_UX_CANON_V3.md`

SSOTy “kluczowe dla braków” (duże zakresy):
- `docs/product/NOTEBOOK_V3.md`
- `docs/product/FINANCIAL_ANALYSIS_V3.md`
- `docs/product/REPORT_GENERATOR_V3.md`
- `docs/product/PRESENTATION_GENERATOR_V3.md`
- `docs/product/EXECUTION_V3.md`
- `docs/product/MEETING_TOOL_V3.md`

---

## 1) Jak używać tego dokumentu (operacyjnie)

### 1.1 Definicje statusu pokrycia

- **COVERED**: zmiana ma mapowanie do istniejących tasków `V3-*` i jest realnie dowożona (impl/QA wg ledgera).
- **PARTIAL**: mapowanie istnieje, ale zakres SSOT jest szerszy niż obecne taski (albo task jest `todo/not_tested`).
- **MISSING**: SSOT wymaga zmiany, ale w ledgerze nie ma taska/epika, który to obejmuje.

### 1.2 Co jest “Definition of Done” dla zmiany

Zmiana jest domknięta dopiero, gdy:
- jest zgodna z `docs/ui-standards/**` (bez nowych “wymyślonych” komponentów),
- respektuje `i18n PL+EN` oraz `locked/read-only` tam, gdzie dotyczy artefaktów,
- jest traceable (`source_type/source_id`) jeśli tworzy outputy,
- ma odhaczenie w Verification Matrix / smoke/demoscript (w `V3_IMPLEMENTATION_PROGRAM.md`).

---

## 2) Master Change Register (jedna kompletna lista zmian)

> Format wpisu: **CR-ID** → *Change* → *SSOT refs* → *V3 task mapping* → *Coverage*.

### 2.1 Cross‑cutting / Platform (wszędzie)

- **CR-001 — Traceability enforcement + “Open source”**
  - **SSOT refs**: `docs/product/SOURCE_TRACEABILITY_SPEC.md`, `docs/product/OPERATING_MODEL_V3.md`, `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
  - **V3 task mapping**: `V3-A01`, `V3-C03`, `V3-C02`, `V3-J01`, `V3-J02`, `V3-I01`
  - **Coverage**: COVERED *(wg ledgera: done/smoke_passed)*  

- **CR-002 — Dynamic menu everywhere (hub → openDocuments → detail/wizard/workspace)**
  - **SSOT refs**: `docs/ui-standards/03-modules/module-hub-standard.md`, `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
  - **V3 task mapping**: `V3-A02`
  - **Coverage**: COVERED

- **CR-003 — Route/menu coherence (Tools/Reports/Presentations naming + entry points)**
  - **SSOT refs**: `docs/product/OPERATING_MODEL_V3.md`, `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
  - **V3 task mapping**: `V3-A04`
  - **Coverage**: COVERED

- **CR-004 — i18n PL+EN + locked/read-only jako standard**
  - **SSOT refs**: `docs/ui-standards/README.md`, `docs/ui-standards/UI_UX_CANON_V3.md`, `docs/product/REQUIREMENTS_V3_SSOT.md`
  - **V3 task mapping**: *rozproszone (reguła globalna, brak jednego epika w ledgerze)*
  - **Coverage**: COVERED *(po finalnym compliance sweep: locked/read-only propagation, i18n cleanup i `smoke:v3:global-standards`)*

- **CR-005 — Program-level gates (Demo Script + Verification Matrix jako prawda operacyjna)**
  - **SSOT refs**: `docs/product/V3_IMPLEMENTATION_PROGRAM.md`
  - **V3 task mapping**: *meta — gate dotyczy wszystkich tasków*
  - **Coverage**: COVERED *(procesowo; nie jest feature’em)*

### 2.2 UI/UX (kanon)

- **CR-010 — “Nie wymyślamy komponentów”: adopcja `docs/ui-standards/**`**
  - **SSOT refs**: `docs/ui-standards/README.md`
  - **V3 task mapping**: `V3-A03` *(compliance sweep)* + stała zasada PR
  - **Coverage**: COVERED

- **CR-011 — Command Row zamiast wielu pasków**
  - **SSOT refs**: `docs/ui-standards/UI_UX_CANON_V3.md`, `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
  - **V3 task mapping**: `V3-A03` *(oraz modułowe poprawki)*
  - **Coverage**: COVERED *(po finalnym closure audit i module-hub sweep)*

- **CR-012 — App Table Standard w każdym hubie tabelarycznym**
  - **SSOT refs**: `docs/ui-standards/03-modules/app-table-standard.md`
  - **V3 task mapping**: `V3-A03`, `V3-D03` + modułowe taski
  - **Coverage**: COVERED *(huby V3 objęte finalnym audit sweepem)*

- **CR-013 — Table + Preview Pane Standard (Outlook-style)**
  - **SSOT refs**: `docs/ui-standards/03-modules/table-preview-pane-standard.md`
  - **V3 task mapping**: `V3-A07`, `V3-C01`, `V3-D03` *(Insights preview)*, `EXECUTION_V3.md` (preview MUST)
  - **Coverage**: COVERED *(w zakresie V3 acceptance)*

- **CR-014 — N‑mode D/N/C + required sections + completeness + AI assist**
  - **SSOT refs**: `docs/ui-standards/01-shell-layout/presentation-modes.md`, `docs/product/NMODE_MANAGEMENT_V3.md`
  - **V3 task mapping**: `V3-K01`, `V3-F01`
  - **Coverage**: COVERED *(core + representative artifact sweep zamknięty na potrzeby V3 acceptance)*

### 2.3 MyWork (personal hub)

- **CR-020 — MyWork “pill tabs” + kanoniczna kolejność + spójność**
  - **SSOT refs**: `docs/ui-standards/UI_UX_CANON_V3.md`, `docs/product/OPERATING_MODEL_V3.md`
  - **V3 task mapping**: `V3-A03` *(compliance sweep)* + `V3-C01..C06`
  - **Coverage**: COVERED *(po finalnym compliance sweep)*

- **CR-021 — MyWork huby tabelaryczne: AppTable + PreviewPane + CommandRow**
  - **SSOT refs**: `docs/ui-standards/03-modules/app-table-standard.md`, `docs/ui-standards/03-modules/table-preview-pane-standard.md`
  - **V3 task mapping**: `V3-C01`, `V3-A07`, `V3-A03`
  - **Coverage**: COVERED

- **CR-022 — MyWork Focus = “lekki cockpit” (lanes + DnD + quick add)**
  - **SSOT refs**: `docs/MYWORK_MODULE_SPECIFICATION.md` (Focus MUST), `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
  - **V3 task mapping**: `V3-C04`
  - **Coverage**: COVERED

- **CR-023 — MyWork Decisions: timeline (bez “queue” jako view-mode) + preview parity**
  - **SSOT refs**: `docs/ui-standards/UI_UX_CANON_V3.md`, `docs/ui-standards/03-modules/table-preview-pane-standard.md`
  - **V3 task mapping**: `V3-C05`
  - **Coverage**: COVERED

- **CR-024 — Ideas: canvas tools selector + shared core model (no data loss)**
  - **SSOT refs**: `docs/MYWORK_MODULE_SPECIFICATION.md` (Ideas core), `docs/ui-standards/03-modules/interactive-board-standard.md` (workspaces/boards)
  - **V3 task mapping**: `V3-C06`
  - **Coverage**: COVERED

- **CR-025 — Convert to… zawsze traceable (MyWork seed → MYWORK ToolSession → outputs)**
  - **SSOT refs**: `docs/product/SOURCE_TRACEABILITY_SPEC.md`, `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
  - **V3 task mapping**: `V3-C02`, `V3-C03`, `V3-A01`
  - **Coverage**: COVERED

### 2.4 Notebook (living knowledge engine)

- **CR-030 — Notebook v3 jako workspace: create-from-note + panel 3-tools strip**
  - **SSOT refs**: `docs/product/NOTEBOOK_V3.md`, `docs/ui-standards/02-components/workspace-3-tools-strip.md`
  - **V3 task mapping**: `V3-C07` *(outline-first modal + assessment/report/presentation create-from-note domknięte po finalnym smoke pack)*
  - **Coverage**: COVERED

- **CR-031 — Embedded references (chips → expand preview) + live metadata**
  - **SSOT refs**: `docs/product/NOTEBOOK_V3.md`, `docs/product/LINK_GRAPH_V3.md`
  - **V3 task mapping**: `V3-A09` *(inline chips + expand preview + live metadata resolver domknięte po finalnym smoke pack)*
  - **Coverage**: COVERED

- **CR-032 — Backlinks “Used in” (platform-wide)**
  - **SSOT refs**: `docs/product/NOTEBOOK_V3.md`, `docs/product/LINK_GRAPH_V3.md`
  - **V3 task mapping**: `V3-A09` *(platform backlinks API + consumers istnieją; status skorygowany po końcowym auditcie)*
  - **Coverage**: COVERED

- **CR-033 — Notebook AI: command blocks + research/voice (propose→accept)**
  - **SSOT refs**: `docs/product/NOTEBOOK_V3.md`, `docs/product/modules/ai/*`
  - **V3 task mapping**: `V3-C07`, `V3-A09` *(Notebook AI zapisuje reviewable proposals i akceptuje je dopiero po user review)*
  - **Coverage**: COVERED

### 2.5 Interview (Form Engine)

- **CR-040 — Interview UX: ModuleHub/AppTable compliance + preview for Insights**
  - **SSOT refs**: `docs/product/INTERVIEW_FORM_ENGINE_V3.md`, `docs/ui-standards/03-modules/app-table-standard.md`
  - **V3 task mapping**: `V3-D03`
  - **Coverage**: COVERED

- **CR-041 — Approval loop: submit → approve/send-back + missing_items_json + respondent feedback**
  - **SSOT refs**: `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
  - **V3 task mapping**: `V3-D01`
  - **Coverage**: COVERED

- **CR-042 — Runtime mode decision: one-question vs task-list**
  - **SSOT refs**: `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
  - **V3 task mapping**: `V3-D02`
  - **Coverage**: COVERED

- **CR-043 — Supporting materials (attachments/links/comments/object links) + Link Graph refs**
  - **SSOT refs**: `docs/product/INTERVIEW_FORM_ENGINE_V3.md`, `docs/product/LINK_GRAPH_V3.md`
  - **V3 task mapping**: `V3-A09`, `V3-D03` *(supporting materials comments + persisted object links do interview session domknięte po finalnym smoke pack)*
  - **Coverage**: COVERED

### 2.6 Tools (Discovery + Licensed) + ToolSessions

- **CR-050 — Jeden mental model Tools (Library → Sessions → Outputs → Initiatives)**
  - **SSOT refs**: `docs/product/CONSULTING_TOOLS_V3.md`, `docs/product/TOOLS_CATALOG_V3.md`, `docs/product/OPERATING_MODEL_V3.md`
  - **V3 task mapping**: `V3-E01`
  - **Coverage**: COVERED

- **CR-051 — Universal Tool Wizard (shell konfigurowany per toolType)**
  - **SSOT refs**: `docs/product/CONSULTING_TOOLS_V3.md`
  - **V3 task mapping**: `V3-E03`
  - **Coverage**: COVERED

- **CR-052 — Tools outputs jako artefakty (Reports/Presentations/Initiatives)**
  - **SSOT refs**: `docs/product/SOURCE_TRACEABILITY_SPEC.md`
  - **V3 task mapping**: `V3-E02`
  - **Coverage**: COVERED

- **CR-053 — Process Automation (hybrid workspace + table + economics + outputs)**
  - **SSOT refs**: `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md` (reference tool), `docs/product/CONSULTING_TOOLS_V3.md`
  - **V3 task mapping**: `V3-E05`
  - **Coverage**: COVERED

- **CR-054 — Licensed assessments parity (DRD/SIRI/ADMA) jako Methodology Packs**
  - **SSOT refs**: `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`, `docs/product/TOOLS_SSOT_SOURCES_V3.md`
  - **V3 task mapping**: `V3-E06`
  - **Coverage**: COVERED *(parity baseline), ale patrz CR-055..057 (hardening)*

- **CR-055 — SIRI canon 16D (data contract + mapping + export)**
  - **SSOT refs**: `docs/product/SIRI_ASSESSMENT_PACK_V3.md`, `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
  - **V3 task mapping**: `V3-E08` *(implemented/smoke_passed)*
  - **Coverage**: COVERED

- **CR-056 — ADMA T1–T7 + FoF overlay w eksportach + initiatives binding**
  - **SSOT refs**: `docs/product/ADMA_ASSESSMENT_PACK_V3.md`, `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
  - **V3 task mapping**: `V3-E09` *(implemented/smoke_passed)*
  - **Coverage**: COVERED

- **CR-057 — Assessment Workbench hardening (evidence + coach)**
  - **SSOT refs**: `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`, `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
  - **V3 task mapping**: `V3-E10` *(implemented/smoke_passed)*
  - **Coverage**: COVERED

- **CR-058 — Tool assets baseline (thumbnails + micro-video) + quality gate**
  - **SSOT refs**: `docs/product/VIDEO_ENABLEMENT_V3.md`, `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md`
  - **V3 task mapping**: `V3-E11` *(implemented/smoke_passed)*
  - **Coverage**: COVERED

- **CR-059 — Consulting Templates library (60) — registry + runtime integration**
  - **SSOT refs**: `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md`, `docs/product/CONSULTING_TOOLS_V3.md`
  - **V3 task mapping**: `V3-E12` *(implemented/smoke_passed)*
  - **Coverage**: COVERED

- **CR-060 — Outputs scaffolding (deterministic): tool/template/assessment → report sections + deck slides + initiatives**
  - **SSOT refs**: `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md`, `docs/product/REPORT_GENERATOR_V3.md`, `docs/product/PRESENTATION_GENERATOR_V3.md`
  - **V3 task mapping**: `V3-E13` *(implemented/smoke_passed)*
  - **Coverage**: COVERED *(to jest “kręgosłup jakości generatorów”)*

- **CR-061 — Tool-scoped RAG auto-pass context (toolSlug/packType/lang)**
  - **SSOT refs**: `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
  - **V3 task mapping**: `V3-N05` *(implemented/smoke_passed)*
  - **Coverage**: COVERED

### 2.7 Initiatives + Execution

- **CR-070 — Initiatives template-driven per InitiativeLevel + N-mode completeness**
  - **SSOT refs**: `docs/product/INITIATIVE_LEVEL_TEMPLATES_V3.md`, `docs/product/NMODE_MANAGEMENT_V3.md`
  - **V3 task mapping**: `V3-F01`, `V3-K01`
  - **Coverage**: COVERED

- **CR-071 — Portfolio analysis (resources/feasibility/logic/timeline/completeness)**
  - **SSOT refs**: `docs/product/INITIATIVES_PORTFOLIO_ANALYSIS_V3.md`
  - **V3 task mapping**: `V3-F02`
  - **Coverage**: COVERED

- **CR-072 — Execution module v3 (operational delivery hub + signals + preview + quick actions)**
  - **SSOT refs**: `docs/product/EXECUTION_V3.md`
  - **V3 task mapping**: `V3-G01`, `V3-G02` *(implemented/smoke_passed po execution-knowledge smoke pack)*
  - **Coverage**: COVERED

### 2.8 Results (KPI/ROI = proof of value)

- **CR-080 — KPI table core + mapping KPI↔initiative**
  - **SSOT refs**: `docs/product/RESULTS_V3.md`
  - **V3 task mapping**: `V3-H01`
  - **Coverage**: COVERED

- **CR-081 — ROI plan vs realized**
  - **SSOT refs**: `docs/product/ROI_TRACKING_CONTRACT_V3.md`, `docs/product/RESULTS_V3.md`
  - **V3 task mapping**: `V3-H02`
  - **Coverage**: COVERED

- **CR-082 — Results surfaces UX (Operational vs ROI + drilldown)**
  - **SSOT refs**: `docs/product/RESULTS_SURFACES_UX_V3.md`, `docs/product/RESULTS_V3.md`
  - **V3 task mapping**: `V3-H03`
  - **Coverage**: COVERED

- **CR-083 — KPI deviation management (thresholds + cases + notifications)**
  - **SSOT refs**: `docs/product/RESULTS_KPI_DEVIATION_MANAGEMENT_V3.md`
  - **V3 task mapping**: `V3-H04` *(implemented/smoke_passed po smoke kontrakcie + testach)*
  - **Coverage**: COVERED

- **CR-084 — KPI time-series contract alignment (API + FE/BE types)**
  - **SSOT refs**: `docs/product/RESULTS_V3.md`
  - **V3 task mapping**: `V3-H05` *(implemented/smoke_passed)*
  - **Coverage**: COVERED

- **CR-085 — KPI attribution policy + minimal finance mapping decision**
  - **SSOT refs**: `docs/product/RESULTS_V3.md`, `docs/product/FINANCIAL_ANALYSIS_V3.md`
  - **V3 task mapping**: `V3-H06` *(implemented/smoke_passed po smoke kontrakcie + testach)*
  - **Coverage**: COVERED

### 2.9 Finance / Financial Analysis

- **CR-090 — Finance export: Exportuj → Report/Presentation/Initiatives (traceable)**
  - **SSOT refs**: `docs/product/FINANCE_EXPORT_V3.md`
  - **V3 task mapping**: `V3-I01`
  - **Coverage**: COVERED

- **CR-091 — Financial Analysis v3 (5 tabs) jako system pracy (modeling/analysis/scenarios/valuation/investment)**
  - **SSOT refs**: `docs/product/FINANCIAL_ANALYSIS_V3.md`, `docs/ui-standards/03-modules/interactive-board-standard.md`
  - **V3 task mapping**: `V3-I02` *(investment_case + finance gap closure smoke pack)*
  - **Coverage**: COVERED

### 2.10 Reports & Presentations (deliverables / management layer)

- **CR-100 — Reports: hub + generator (3 ścieżki) + online jako primary + exporty**
  - **SSOT refs**: `docs/product/REPORT_GENERATOR_V3.md`, `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`
  - **V3 task mapping**: `V3-J01`, `V3-J03`, `V3-J04` *(quality gates/export contract domknięte po reports-quality smoke pack)*
  - **Coverage**: COVERED

- **CR-101 — Presentations: deck library + generator “Gamma-like” + exporty**
  - **SSOT refs**: `docs/product/PRESENTATION_GENERATOR_V3.md`, `docs/product/PRESENTATION_GENERATOR_VISUALS_IMPLEMENTATION_PLAN_V3.md`
  - **V3 task mapping**: `V3-J02`, `V3-J05` *(agent-edit + export parity domknięte po presentations-runtime smoke pack)*
  - **Coverage**: COVERED

### 2.11 Meeting tool (w SSOT, dziś jako local-only MVP)

- **CR-110 — Meeting tool v3 (event + agenda + pre-read + decyzje + follow-ups)**
  - **SSOT refs**: `docs/product/MEETING_TOOL_V3.md`
  - **V3 task mapping**: `V3-P01` *(backend persistence + shared workspace + decision/follow-up runtime domknięte po smoke pack)*
  - **Coverage**: COVERED

### 2.12 Integrations / Sync / MCP + AI/LLM/Knowledge

- **CR-119 — Communication sync: Slack + Teams notifications + channel mappings**
  - **SSOT refs**: `docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`
  - **V3 task mapping**: `V3-M02` *(implemented/smoke_passed po communication-sync smoke pack)*
  - **Coverage**: COVERED

- **CR-120 — Integrations: scope labels (read-only vs bidirectional) + expectation management UX**
  - **SSOT refs**: `docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`, `docs/ui-standards/UI_UX_CANON_V3.md`
  - **V3 task mapping**: `V3-M14` *(implemented/smoke_passed po smoke kontrakcie)*
  - **Coverage**: COVERED

- **CR-121 — External RAG provider adapter + case knowledge capture pipeline**
  - **SSOT refs**: `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
  - **V3 task mapping**: `V3-N04` *(implemented/smoke_passed po execution-knowledge smoke pack)*
  - **Coverage**: COVERED

- **CR-122 — Deep Research Evidence Ledger + intent classifier + coverage report + smoke**
  - **SSOT refs**: `docs/product/modules/ai/*`, `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
  - **V3 task mapping**: `V3-N08`, `V3-N09`, `V3-N10`, `V3-N11` *(implemented/smoke_passed po research-viewer + ledger smoke pack)*
  - **Coverage**: COVERED

---

## 3) SSOT Coverage Audit vs `PROCESS_MYWORK_TO_DELIVERABLES_V3.md`

> Cel tej sekcji: odpowiedzieć “czy na pewno mamy wszystko” — tj. czy *każdy kanoniczny SSOT wskazany w procesie* ma mapowanie na taski w programie V3.

### 3.1 Pokrycie — wysoki poziom

- **Tools core (Library/Sessions/Wizard/Outputs)**: COVERED (E01/E02/E03)  
- **Licensed assessments parity baseline**: COVERED (E06)  
- **Initiatives template-driven + portfolio analysis**: COVERED (F01/F02)  
- **Results KPI/ROI core + analysis**: COVERED (H01/H02/H03)  
- **Finance export**: COVERED (I01)  
- **Financial Analysis v3 core**: COVERED (I02 po investment/valuation/import hardening)  
- **Reports/Presentations surfaces + upload chaos**: COVERED (`J01/J02/J03/J04/J05` po reports-quality + presentations-runtime smoke)  
- **Execution**: COVERED (`G01/G02` po smoke pack i runtime hardening)  
- **Notebook**: COVERED (`V3-C07` + `V3-A09` po outline-first, chips preview i propose→accept closure)  
- **Meeting tool**: COVERED (`V3-P01` po backend persistence + shared workspace + smoke)  

### 3.2 Największe “dziury” (SSOT w procesie, brak tasków/epików)

1) **Execution v3 breadth** (`EXECUTION_V3.md`) — runtime i smoke są zamknięte, ale szeroki SSOT execution pozostaje największym obszarem do dalszego rozwoju po V3 acceptance.  

---

## 4) Co dalej (po closure audit)

Kolejny krok dla tego dokumentu nie polega już na dopisywaniu brakujących sekcji, tylko na utrzymywaniu zgodności z rzeczywistym stanem kodu:

1) aktualizować coverage po każdym większym wdrożeniu albo audycie,
2) nie zostawiać w nim historycznych `MISSING/todo/not_tested`, jeśli runtime i smoke już istnieją,
3) traktować sekcje 5-8 jako living contract do oceny, czy coverage jest naprawdę `COVERED`, czy tylko `PARTIAL`.

---

## 5) Gap-closure epics (dodane po pierwotnym audycie)

> Te epiki zostały dodane po pierwotnym audycie, żeby zamknąć SSOT gaps.
> Poniżej utrzymujemy ich kontrakt i zakres jako punkt odniesienia do oceny coverage, nawet jeśli implementacja już istnieje.

### 5.1 Epiki (ID dodane po pierwotnym audycie)

| Epic ID | Epic | Priorytet | Target | Dlaczego teraz | Zamyka CR |
| --- | --- | --- | --- | --- | --- |
| **V3-A09** | **Link Graph + Backlinks system** (embedded refs + “Used in”) | P0 | R1 | Notebook/Interview/Workspaces potrzebują kanonicznego “kontekstu i śladów”; epik dodany po pierwotnym audycie | CR-031, CR-032, CR-043 |
| **V3-C07** | **Notebook v3 core** (create-from-note + outline-first + right panel contract) | P0 | R1 | Notebook jest SSOT-em flow (MyWork→Deliverables) i źródłem konwersji; epik dodany po pierwotnym audycie | CR-030, CR-033 |
| **V3-I02** | **Financial Analysis v3 core** (5 tabs + interactive boards + library of runs) | P0 | R1/R2 | `V3-I01` to export; SSOT FA jest systemem pracy (model/analysis/scenarios/valuation/investment) | CR-091 |
| **V3-J04** | **Report Generator core** (R1–R4 templates + online artifact + quality gates) | P0 | R1/R2 | `J01/J03` to surfaces/3rd path; SSOT RG wymaga “enterprise report system” | CR-100 |
| **V3-J05** | **Presentation Generator core** (Deck Builder + BrandKit + Smart Diagrams + animations) | P0 | R2 | `J02` to biblioteka; SSOT PG to produkt klasy Gamma | CR-101 |
| **V3-P01** | **Meeting tool v3** (shared workspace runtime) — event + agenda + decisions + follow-ups | P2 | R2 | SSOT wymienia Meeting; po hardeningu moduł ma backend persistence, executor i smoke kontrakt | CR-110 |

### 5.2 Zakres epików (kontrakty, nie implementacja)

#### V3-A09 — Link Graph + Backlinks system (P0 / R1)
- **SSOT**: `docs/product/LINK_GRAPH_V3.md`, `docs/product/NOTEBOOK_V3.md`, `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- **Zakres (MUST)**:
  - **Embedded references**: w treści notatki/edytorów powstaje **inline chip** → “Expand to preview” → mini-card.
  - **Backlinks “Used in”**: platform-wide “Used in” dla Notebook/Workspace (i docelowo artefaktów) w prawym panelu.
  - **Live metadata** zawsze; **live content** opcjonalne (MVP selector: nagłówki H1/H2/H3).
  - **Wspólny kontrakt renderowania preview** (to samo UX w Notebook/Interview/Results/Execution, jeśli używają preview).
- **Zakres (OUT na v3 MVP)**:
  - pełny “graph explorer UI” (wizualny graf) — tylko jeśli osobno zdecydujemy.
- **AC / DoD (minimal)**:
  - z Notebooka można wstawić link do Initiative/Task/Decision/Report/Deck/Assessment/Workspace i zobaczyć mini-preview,
  - w Notebook “Used in” pokazuje min. 3 typy backlinków (Notes + Initiatives + Reports),
  - w Interview supporting materials linkowanie działa jak kontrakt (links/attachments + referencje).

#### V3-C07 — Notebook v3 core (P0 / R1)
- **SSOT**: `docs/product/NOTEBOOK_V3.md`, `docs/ui-standards/02-components/workspace-3-tools-strip.md`
- **Zakres (MUST)**:
  - **Create from note**: Create Initiative/Task/Decision/Report/Presentation/Assessment.
  - **Outline-first** dla Report/Presentation/Assessment: user akceptuje/edytuje outline zanim powstanie artefakt.
  - **Right panel contract**: 3-tools strip (Tools/Context/AI Suggestions) z przewidywalną zawartością.
  - **Long note navigation**: mini outline (H1/H2/H3) + szybkie skoki.
  - **AI in notebook**: command block + voice dictation + AI command mode (propose→accept).
- **Zależności**:
  - `V3-A01` traceability (outputy muszą mieć źródło; jeśli seed z Notebooka → MYWORK ToolSession),
  - `V3-A09` (Link Graph/backlinks).
- **AC / DoD (minimal)**:
  - “Create Report from note” generuje outline, user akceptuje i trafia do report buildera z ustawionym source,
  - “Create Presentation from note” generuje outline, user akceptuje i trafia do Presentation Wizard/Builder,
  - prawy panel Notebook jest spójny z kanonem workspace tools strip.

#### V3-I02 — Financial Analysis v3 core (P0 / R1/R2)
- **SSOT**: `docs/product/FINANCIAL_ANALYSIS_V3.md`, `docs/ui-standards/03-modules/interactive-board-standard.md`
- **Zakres (MUST)**:
  - 5 tabs: **Modeling / Analysis / Forecasting / Valuation / Investment (CAPEX)**.
  - “Zero-change model” baseline autopilot (P&L/BS/CF loop).
  - Import pipeline (MVP): PDF extract → normalize → map → validate → baseline.
  - **Library of runs**: Analysis saved runs + scenarios library + valuation runs (min. metadata + re-run).
  - Powiązanie z Initiatives (financial effects) jako traceable input do scenariuszy.
  - UI surface: interactive boards/tables + panel walidacji (bez wymyślania nowych UI poza standardem).
- **Zależności**:
  - `V3-I01` export (wykorzystuje artefakty z I02),
  - Results (`V3-H01..H06`) dla KPI/attribution finansowej (min. decyzja w H06).
- **AC / DoD (minimal na R1)**:
  - user tworzy baseline model, uruchamia 1 analizę i zapisuje run,
  - z zapisanego run robi “Export → Report” i “Export → Presentation” (source wraca do FA).

#### V3-J04 — Report Generator core (P0 / R1/R2)
- **SSOT**: `docs/product/REPORT_GENERATOR_V3.md`, `docs/product/REPORTING_CANONICAL_TEMPLATES.md`, `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`
- **Zakres (MUST)**:
  - Report types R1–R4 jako kanoniczne template’y (sekcje, źródła danych, escalation rules).
  - 3 ścieżki: Template / Free / Upload chaos → zawsze kończą w tym samym builderze.
  - Online report jako **primary artifact** + exporty PDF/DOCX (PPTX secondary).
  - Quality gate “sponsor-ready” (minimalne checki: brak luk logicznych, spójne źródła, język/ton).
  - Traceability per report/section/block (source refs).
- **Zależności**:
  - `V3-E13` outputs scaffolding (żeby narzędzia dawały deterministyczne sekcje),
  - `V3-A01` traceability.

#### V3-J05 — Presentation Generator core (P0 / R2)
- **SSOT**: `docs/product/PRESENTATION_GENERATOR_V3.md`, `docs/product/PRESENTATION_GENERATOR_VISUALS_IMPLEMENTATION_PLAN_V3.md`
- **Zakres (MUST/SHOULD wg SSOT)**:
  - Deck Builder (Gamma-like) + block-level editing.
  - Brand Kit / theme engine (organization-first) + curated color sets.
  - Smart diagrams + layout library + “żywe” online cards (subtle animations).
  - Agent/chat edits (“zmień slajdy 2–4…”) w modelu propose→accept.
  - Data blocks: semi-live KPI/finance charts (refresh).
- **Zależności**:
  - `V3-J02` biblioteka decków (hub) jako surface,
  - `V3-E13` scaffolding + `V3-I02` (finance source) jeśli w deckach mają być wykresy.

#### V3-P01 — Meeting tool (P2 / R2, obecnie local-first MVP)
- **SSOT**: `docs/product/MEETING_TOOL_V3.md`
- **Uwaga**: po closure audit ten epik jest już `IN`, ale obecna implementacja pozostaje lokalnym MVP/prototype i nie domyka pełnego backendowego scope Meeting SSOT.

---

## 6) Sprint Plan (R1/R2) — plan działania z checkpointami

> Plan jest zbudowany tak, żeby: (a) zamknąć wszystkie `todo/not_tested` z ledgera, (b) domknąć SSOT GAPy epikami z sekcji 5.

### Sprint R1‑S1 (2 tyg.) — “GAP closure foundations”
**Cel:** odblokować Notebook/Interview/Tools jako spójny system kontekstu i źródeł.

- **In (must)**:
  - `V3-E08` (SIRI 16D canon)
  - `V3-E09` (ADMA T1–T7 + FoF overlay)
  - `V3-E10` (Assessment Workbench hardening)
  - `V3-N05` (Tool-scoped RAG auto-pass context)
  - `V3-A09` (Link Graph + Backlinks system) — MVP embedded refs + Used in
  - `V3-C07` (Notebook v3 core) — create-from-note + outline-first + right panel contract
- **Demo checkpoint (15 min)**:
  - Notebook → wstaw embedded link do Initiative + expand preview,
  - Notebook → Create Report from note (outline → accept → builder; source ustawione),
  - Assessment (SIRI/ADMA) → wygeneruj outputs (min. initiative draft + report/deck placeholder) z poprawną traceability.
- **QA**:
  - dopisać wiersze do Verification Matrix: Notebook create-from-note, Embedded refs, Assessment export parity.

### Sprint R1‑S2 (2 tyg.) — “Results proof system + Integrations honesty”
**Cel:** dowieźć “dowozimy po wdrożeniu” i uczciwie pokazać sync scope.

- **In (must)**:
  - `V3-H04` KPI deviation management
  - `V3-H05` KPI time-series contract
  - `V3-M14` integrations scope labels (read-only vs bidirectional) + UX expectation management
  - `V3-E11` tool assets baseline (thumbnails + micro-video) — minimal gate
- **Demo checkpoint**:
  - KPI spada poniżej threshold → deviation case + plan naprawczy + link do initiative/task,
  - Integrations: widoczne “read-only/bidirectional” i nie generuje false expectations.

### Sprint R1‑S3 (2 tyg.) — “Financial Analysis MVP (real, not export-only)”
**Cel:** uruchomić Financial Analysis jako system pracy, nie tylko “Exportuj”.

- **In (must)**:
  - `V3-I02` Financial Analysis core (R1 MVP subset):
    - baseline modeling + 1 analiza + zapis run + re-run
    - 1 scenariusz (forecast) baseline vs scenario
    - traceable binding do initiative effects (minimal)
  - `V3-I01` (export) — wykorzystane end-to-end na realnych runach
- **Demo checkpoint**:
  - baseline model → analiza → Save run → Export report → Open source wraca do FA.

### Sprint R2‑S1 (2 tyg.) — “Tools scale: templates library 60 + scaffolding”
**Cel:** narzędzia (31 + 60) mają deterministyczny output mapping do deliverables.

- **In (must)**:
  - `V3-E12` templates library 60 — registry + runtime integration
  - `V3-E13` outputs scaffolding (tool/template/assessment → report sections + deck slides mapping)
  - `V3-N04` external RAG provider adapter + case knowledge capture (jeśli wchodzi do R2)
- **Demo checkpoint**:
  - wybierz 1 toolTemplate z “60” → wizard → outputs: report outline + deck outline + 2 initiative drafts (deterministycznie).

### Sprint R2‑S2 (2 tyg.) — “Report/Presentation Generator core”
**Cel:** dowieźć SSOT generatorów, nie tylko “hub surfaces”.

- **In (must)**:
  - `V3-J04` Report Generator core (R1–R4 templates + online artifact + quality gate + exports)
  - `V3-J05` Presentation Generator core (deck builder + brand kit + smart diagrams + animations baseline)
  - `V3-N08..V3-N11` evidence ledger + smoke (jeśli wchodzi do “quality story”)
- **Demo checkpoint**:
  - Z Initiative + Financial Analysis run + 1 ToolSession: wygeneruj R2 Steering report online → eksport PDF/DOCX,
  - Z tych samych źródeł: wygeneruj deck “executive update” z 1 smart diagramem + 1 live KPI widgetem.

### Sprint R2‑S3 (opcjonalny) — “Execution hardening + Meeting decision”
**Cel:** zamknąć Execution SSOT albo go przyciąć; podjąć decyzję o Meeting.

- **In**:
  - doprecyzowanie i domknięcie Execution ponad `V3-G01` (jeśli nie wystarcza)
  - `V3-P01` Meeting tool — domknąć albo utrzymać świadomie jako local-only MVP

---

## 7) Decisions status (po closure audit)

> Decyzje z pierwotnego planu zostały już w praktyce podjęte. Poniżej zostaje ich aktualny stan, żeby plan był prawdziwy po wdrożeniach.

1) **Meeting tool (`MEETING_TOOL_V3.md`)**: `IN` (`V3-P01`).  
   - Wniosek: backend persistence, shared workspace i executor są już domknięte; zakres V3 jest COVERED.

2) **Notebook v3**: `IN` (`V3-C07` + `V3-A09`).  
   - Wniosek: outline-first, embedded refs/chips i Notebook AI propose→accept są domknięte; zakres V3 jest COVERED.

3) **Financial Analysis core**: `IN` (`V3-I02`).  
   - Wniosek: investment/runtime/valuation/import są domknięte; zakres V3 jest COVERED.

4) **Generators scope**: `IN` (`V3-J04` + `V3-J05`).  
   - Wniosek: report/deck generators mają zamknięty runtime, quality gates i export parity; zakres V3 jest COVERED.

5) **Link Graph scope**: `IN` jako MVP (`V3-A09`).  
   - Wniosek: embedded refs + backlinks + interview object links są domknięte dla V3; `Graph Explorer UI` pozostaje świadomie poza zakresem V3.

---

## 8) Epic specs (V2-style) — gotowe do dopięcia do `V3_IMPLEMENTATION_PROGRAM.md`

> Te specy są pisane w stylu “Task specs jak V2” z programu V3, żeby dało się je skopiować 1:1.

### V3-A09 — [Platform] Link Graph + Backlinks system (embedded refs + “Used in”)

- **Status spec:** draft  
- **Priorytet:** P0  
- **Target:** R1  
- **Zamyka CR:** CR-031, CR-032, CR-043  
- **SSOT:** `docs/product/LINK_GRAPH_V3.md`, `docs/product/NOTEBOOK_V3.md`, `docs/product/INTERVIEW_FORM_ENGINE_V3.md`, `docs/ui-standards/03-modules/table-preview-pane-standard.md`

**Business challenge (problem):**  
Bez kanonicznego linkowania i backlinksów Notebook/Interview/Workspaces nie tworzą “pamięci organizacji”. Kontekst jest rozsypany, a user nie widzi gdzie dana informacja jest używana ani skąd wynikają wnioski.

**Cel (outcome):**  
Użytkownik może osadzać referencje między artefaktami w sposób lekki i spójny, a system pokazuje “Used in” jako platform-wide backlinks. To staje się fundamentem konwersji (notes→deliverables) i jakości generatorów (źródła per blok).

**Zakres (IN):**
- Embedded references jako **inline chip** w edytorach (Notebook/Interview materials/wybrane pola N‑mode).
- Akcja chipu: **Expand to preview** (mini-card zgodny ze standardem preview).
- Backlinks “Used in” (platform-wide) widoczne w prawym panelu Notebooka (i analogicznie w Workspace, jeśli jest w scope).
- “Live metadata always on” + opcjonalny “Live content” (MVP: nagłówki H1/H2/H3).

**Zakres (OUT):**
- Pełny “Graph Explorer UI” (wizualny graf powiązań) — v4+.
- Automatyczne wstawianie linków przez AI bez zgody usera.

**UX / UI notes:**
- Chip wygląda jak artefakt identity (ikona + subtelny akcent), nie jak “tag”.
- Preview card ma minimalny kontrakt per typ (Initiative/Task/Decision/Report/Deck/Assessment/Workspace).
- “Used in” to lista z filtrami (min: type + search), nie tablica grafowa.

**Data / kontrakty:**
- Kanoniczny obiekt relacji: `LinkEdge { from_type, from_id, to_type, to_id, link_kind, created_by, created_at }`.
- Backlinks to query odwrotne po `to_*` (bez duplikacji danych).
- Live metadata wymaga endpointów “light summary” per artefakt (lub wspólnego resolvera).

**AI behavior (jeśli dotyczy):**
- AI może sugerować linki (propose), ale user je akceptuje (accept/reject).
- AI nie tworzy ukrytych relacji “w tle”.

**Definition of Done (DoD):**
- Można wstawić link chip do min. 6 typów: Initiative/Task/Decision/Report/Deck/Assessment (+ opcjonalnie Workspace/Note).
- Expand preview działa i nie wymaga przeładowania całego widoku.
- “Used in” w Notebooku pokazuje linki z min. 3 domen: Notes + Initiatives + Reports/Decks.
- Wszystko działa w i18n PL/EN.

**Acceptance / test plan (manual):**
- W notatce wstaw link do inicjatywy → expand → widzisz status/owner/% (live).
- Otwórz “Used in” dla notatki → widzisz, że jest użyta w raporcie i w innej notatce.
- Usuń link chip → znika z backlinksów.

**Dependencies:**
- UI standard preview pane / mini-card style (`docs/ui-standards/**`).
- (opcjonalnie) traceability: preview ma pokazywać też “Source” jeśli dotyczy.

**Risks / go-live risk:**
- Zbyt szeroki scope (Graph Explorer) wysadzi timeline; dlatego OUT.

**Analytics / telemetry (minimal):**
- `link_inserted` (from_type, to_type)
- `link_preview_expanded` (type)
- `backlinks_opened` (type)

---

### V3-C07 — [MyWork] Notebook v3 core (create-from-note + outline-first + right panel contract)

- **Status spec:** draft  
- **Priorytet:** P0  
- **Target:** R1  
- **Zamyka CR:** CR-030, CR-033  
- **SSOT:** `docs/product/NOTEBOOK_V3.md`, `docs/ui-standards/02-components/workspace-3-tools-strip.md`, `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`

**Business challenge (problem):**  
Notebook jest w SSOT jako “living knowledge engine” i punkt startowy do deliverables, ale bez dopiętego kanonicznego flow create-from-note i outline-first generatory produkują śmieciowe obiekty, a user nie ma kontroli.

**Cel (outcome):**  
Notebook staje się przewidywalnym narzędziem pracy: zbieram treść → linkuję kontekst → jednym ruchem tworzę Initiative/Report/Deck/Assessment przez outline-first, a wszystko jest traceable.

**Zakres (IN):**
- Jedna akcja: **Create from note** → Initiative/Task/Decision/Report/Presentation/Assessment.
- Dla Report/Presentation/Assessment: **outline-first** (generate outline → user accept/edit → dopiero tworzymy artefakt).
- Prawy panel jako kanoniczny 3-tools strip (Tools/Context‑Links/AI Suggestions) z przewidywalnym układem.
- Nawigacja w długiej notatce: mini outline (H1/H2/H3) + szybkie skoki.
- AI w Notebooku: command block + voice dictation + voice command (propose→accept).

**Zakres (OUT):**
- Approval workflow dla notebooka (Notebook nie jest systemem zatwierdzania).
- Wersjonowanie “jak git” (Notebook nie jest systemem wersjonowanym).

**UX / UI notes:**
- “Create from note” to CTA w Tools panel, nie ukryte menu.
- Outline step ma 2 stany: proposed outline + user edits + accept.
- Po accept: otwieramy generator/builder w dynamic tabs z prefilled sources.

**Data / kontrakty:**
- Każdy output z Notebooka jest traceable: seed (note) → materializacja `ToolSession(type=MYWORK)` → output ma source do toolSession.
- (Jeśli `V3-A09` wchodzi) embedded refs i backlinks są częścią Notebooka.

**AI behavior:**
- AI nie może “Create …” bez kroku outline accept.
- AI proponuje poprawki tekstu w trybie propose→accept.

**Definition of Done (DoD):**
- Z notatki da się stworzyć draft report i draft deck z outline-first.
- Powstałe artefakty mają poprawne source i działające “Open source”.
- UI prawy panel jest zgodny z workspace-3-tools-strip standard.

**Acceptance / test plan (manual):**
- W Notebook: “Create Report” → outline → accept → builder; report ma sources, Open source wraca do MYWORK session.
- W Notebook: “Create Presentation” → analogicznie.
- Voice dictation dodaje tekst, a voice command uruchamia AI command w trybie propose→accept.

**Dependencies:**
- `V3-A01` traceability
- `V3-A02` dynamic tabs
- `V3-A09` (jeśli embedded/backlinks mają być “pełne”)

**Risks:**
- Jeśli zrobimy create-from-note bez outline-first, powstanie za dużo śmieciowych artefaktów.

**Analytics (minimal):**
- `create_from_note_clicked` (to_type)
- `outline_generated` (to_type)
- `outline_accepted` (to_type)

---

### V3-I02 — [Finance] Financial Analysis v3 core (5 tabs + interactive boards + library of runs)

- **Status spec:** draft  
- **Priorytet:** P0  
- **Target:** R1/R2  
- **Zamyka CR:** CR-091  
- **SSOT:** `docs/product/FINANCIAL_ANALYSIS_V3.md`, `docs/ui-standards/03-modules/interactive-board-standard.md`, `docs/product/OPERATING_MODEL_V3.md`

**Business challenge (problem):**  
`V3-I01` dowozi eksport, ale SSOT wymaga Financial Analysis jako systemu pracy (model → analizy → scenariusze → wycena → CAPEX). Bez tego nie dowozimy “unikatowego na rynku modelowania finansowego” i nie mamy prawdziwych danych do report/deck.

**Cel (outcome):**  
Financial Analysis działa jako spójny moduł z 5 tabami i biblioteką wyników (runs). User jest w stanie zrobić baseline, uruchomić analizę, zapisać run, zrobić scenariusz i wyeksportować to do deliverables (traceable).

**Zakres (IN):**
- 5 tabs: Modeling / Analysis / Forecasting / Valuation / Investment (CAPEX).
- Baseline “zero-change model” autopilot (P&L/BS/CF loop).
- Import pipeline MVP: PDF extract → normalize → map → validate → baseline.
- Library: saved analysis runs + scenarios library + valuation runs (min. metadata + re-run).
- Initiative effects w scenariuszu: revenue uplift / cost savings / CAPEX schedule (materializacja do osi miesięcznej).
- UI: interactive boards + “live view → save” dla analiz.

**Zakres (OUT):**
- Benchmarking (SSOT mówi: MVP odkładamy) — tylko jeśli osobno.
- Automatyczna synchronizacja z zewnętrznymi systemami (ERP) — osobny strumień integracji.

**UX / UI notes:**
- Live View jest domyślne; Save tworzy artefakt w bibliotece analiz (żeby nie tworzyć śmieci).
- Z każdego run/scenario jest CTA “Export” do report/deck/initiatives (wykorzystuje `V3-I01`).

**Data / kontrakty:**
- “Run” ma snapshot assumptions + wynik + linki do źródeł (upload, mapping) i powiązania do inicjatyw.
- Wewnętrzna rozdzielczość compute: miesięczna; UI agreguje.

**AI behavior:**
- AI w analizach jest “financial analyst style” (neutral), bez rekomendacji konsultingowych.
- AI może zadawać pytania o braki danych w scenariuszu, ale nie “zgaduje” bez confirm.

**Definition of Done (DoD) — R1 MVP:**
- Modeling: baseline działa i da się przejść do Analysis.
- Analysis: 1 analiza działa w Live View → Save → wpis w bibliotece.
- Forecast: 1 scenariusz baseline vs scenario.
- Export: z run/scenario można zrobić report/deck (source wraca do FA).

**Acceptance / test plan (manual):**
- Import PDF → baseline → save analysis run → export report → Open source wraca do FA run.
- Dodaj initiative effect (cost savings w konkretnej grupie kosztów) → scenariusz pokazuje delta vs baseline.

**Dependencies:**
- `V3-I01` export
- Results (`V3-H01..H06`) dla spójności KPI/attribution (min. decyzja w H06)

**Risks:**
- Za szeroki import PDF w R1; trzeba trzymać MVP pipeline + jasne komunikaty braków.

**Analytics (minimal):**
- `finance_model_created`
- `finance_analysis_saved`
- `finance_scenario_created`
- `finance_export_clicked` (to=report|deck|initiative)

---

### V3-J04 — [Reports] Report Generator core (R1–R4 templates + online artifact + quality gates)

- **Status spec:** draft  
- **Priorytet:** P0  
- **Target:** R1/R2  
- **Zamyka CR:** CR-100  
- **SSOT:** `docs/product/REPORT_GENERATOR_V3.md`, `docs/product/REPORTING_CANONICAL_TEMPLATES.md`, `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`

**Business challenge (problem):**  
Surfaces/huby nie wystarczą — “reporting layer” to kanoniczne typy raportów (R1–R4), quality gates i online living doc. Bez tego raporty będą albo losowe, albo zbyt “AI copywriter”, a nie sponsor-ready.

**Cel (outcome):**  
W v3 da się w 60–180 sekund wygenerować raport R1–R4 z kontekstu platformy, przejść przez outline-first, zrobić edit/regen per sekcja, przejść quality gate i wyeksportować PDF/DOCX.

**Zakres (IN):**
- Kanoniczne report types R1–R4 jako templates (sekcje + źródła danych + escalation rules).
- 3 ścieżki: Template / Free / Upload chaos (C może być etapowana).
- Online report jako primary artifact + export history.
- Quality gate (min): spójność źródeł, brak pustych sekcji obowiązkowych, język/ton zgodny z definition.
- Traceability per report/section/block.

**Zakres (OUT):**
- Real-time collaboration.
- W pełni automatyczne publikowanie cykliczne (to może być osobny strumień “scheduled reports”).

**UX / UI notes:**
- Report Definition Layer (cel/odbiorca/język/styl/długość) jest obowiązkowy w Free mode.
- Outline-first jest kanonem: user akceptuje outline zanim generujemy pełny content.

**Dependencies:**
- `V3-E13` outputs scaffolding (żeby tool outputs mapowały się deterministycznie na sekcje).
- `V3-A01` traceability.

**DoD (minimal):**
- Jest 1 referencyjny template R2 (Steering) i 1 R1 (Weekly) działający end-to-end.
- PDF + DOCX eksport działa i ma historię eksportu.

**Acceptance / test plan (manual):**
- Z Initiative + Results + ToolSession: generuj R2 → export PDF/DOCX → Open source działa.

**Analytics (minimal):**
- `report_created` (type=R1..R4)
- `report_outline_accepted`
- `report_exported` (format)

---

### V3-J05 — [Presentations] Presentation Generator core (Deck Builder + BrandKit + Smart Diagrams + animations)

- **Status spec:** draft  
- **Priorytet:** P0  
- **Target:** R2  
- **Zamyka CR:** CR-101  
- **SSOT:** `docs/product/PRESENTATION_GENERATOR_V3.md`, `docs/product/PRESENTATION_GENERATOR_VISUALS_IMPLEMENTATION_PLAN_V3.md`, `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`

**Business challenge (problem):**  
Biblioteka decków (hub) nie dowozi “wow”. SSOT wymaga generatora klasy Gamma, który korzysta z kontekstu organizacji i produkuje piękne decki online + eksport PPTX/PDF.

**Cel (outcome):**  
User generuje deck w 60 sekund: wybiera źródła (Initiatives/Notes/Finance/Insights) + setup (audience/goal/mode/register/theme) → outline-first → deck builder z block-level edit → export.

**Zakres (IN):**
- Deck Builder (Gamma-like) z block-level editing i regen per karta.
- BrandKit-first theme + curated color sets + image style preset.
- Smart diagrams + layout library (MVP: mały zestaw, ale jakościowy).
- Online deck z subtelnymi animacjami (liczniki KPI, chart animate, parallax minimal).
- Agent/chat edits (propose→accept).
- Data blocks: semi-live refresh KPI/finance charts.

**Zakres (OUT):**
- Realtime collaboration.
- “Unlimited” layout library (robimy MVP + skalowanie).

**Dependencies:**
- `V3-J02` deck library (surface)
- `V3-E13` scaffolding (źródła → slajdy)
- `V3-I02` (jeśli deck ma mieć wpięte wykresy finansowe)

**DoD (minimal):**
- 1 template “Executive update” działa end-to-end + export PPTX/PDF.
- 1 smart diagram + 1 KPI widget + 1 finance chart block.

**Acceptance / test plan (manual):**
- Z Initiative + Finance run: generuj deck → edytuj 1 kartę → export PPTX → slajdy mają spójny theme.

**Analytics (minimal):**
- `deck_created`
- `deck_outline_accepted`
- `deck_exported` (format)

---

### V3-P01 — [Meeting] Meeting tool v3 (event + agenda + pre-read + decisions + follow-ups)

- **Status spec:** draft  
- **Priorytet:** P2  
- **Target:** R2  
- **Zamyka CR:** CR-110  
- **SSOT:** `docs/product/MEETING_TOOL_V3.md`

**Uwaga:**  
Po closure audit ten epic jest już częścią V3 scope, ale tylko na poziomie local-first MVP. Jeśli ma być traktowany jako pełny feature V3, potrzebuje dalszego domknięcia backendowego i integracyjnego.




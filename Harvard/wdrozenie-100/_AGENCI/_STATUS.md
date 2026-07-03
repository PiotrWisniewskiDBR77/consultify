# TABLICA STATUSU — Re-skin (żywe źródło prawdy o postępie)
**Zaktualizowano:** 2026-07-01 (noc, autonomiczny przebieg Strega)
**Legenda:** ⬜ todo · 🟨 w toku · ✅ done+build · 🟦 staged (czeka na odbiór Piotra) · Priorytet P1=golden-path/core · P2=admin/settings · P3=public/docs/internal

## SKALA (prawda o zakresie)
**~115 ekranów** (95 top-level + 20 embedded). Rozkład: core-product ~40 (P1), admin/settings ~25 (P2), public/marketing/docs/legal/partner/superadmin ~50 (P3). **Pełne 100% = program wielodniowy 5 agentów, nie jedna noc.** Fundament (Fala 0) odblokowuje wszystkie.

## POSTĘP FAL
| Fala | Zakres | Stan |
|------|--------|------|
| **0 Fundament** | 6 fixów współdzielonych (Edit Columns/Badge/shell/select+Dropdown focus) | ✅ ZMERGOWANE (e1722ac3b8; G0 = dyrektywa Piotra „dopruwać plan do końca 5 agentami") |
| **1 Listy** | ~50 plików, 5 agentów — ZMERGOWANE (A1-A5) | ✅ BRAMKA PRZESZŁA (type-check 11=baseline, 0 nowych błędów; ~50 plików czysto) |
| 2 Artefakty | ~45 plików (Initiative doc 10.5k, Chat bąble, Assessment/Interview editory, Decision/Task modale, ROI/Valuation, Document/Deck) | ✅ BRAMKA PRZESZŁA (11=baseline, 0 nowych; A1-A5 zmergowane) |
| 3 Instrumenty+Huby | mechaniczne (kanban/gantt/dashboard/heatmap chrome + crimson-in-data→c-tag) vs design (M15 IA/DRD map build/Tool detail → Piotr) | 🟨 START |

**DECYZJE FUNDAMENTU (czekają na słowo Piotra):**
1. **Menu 2 pill vs underline** — KONFLIKT: `VISUAL_STANDARD §5.5` (underline, w kodzie ModuleNavBar) vs uwaga Piotra + TABLE_CANON + spec §9.2③ (pill jak My Work). NIE flipuję app-wide udokumentowanego standardu bez zgody. „pill wszędzie" = 5-min fix w `ModuleNavBar.tsx`.
2. **ModuleMenu3 active chip crimson** — zgodne ze spec §9.2② (brand accent); agenci przeflagowali; zostaje do decyzji.
3. Alpha na tokenach (`c-*/70`) nie działa (brak `<alpha-value>`) — translucent surfaces zostają slate; do decyzji.
4. Wariant „primary inverse" w Button (dziś ad-hoc `bg-c-text text-c-surface`) — dodać do fundamentu.

**Zdiagnozowane bugi (nie-CSS, do osobnej pracy):** badge Wstrzymaj/Zatrzymaj (R-4) = z DANYCH nie kodu · demo-dane hardcoded (`resultsShowcaseData.ts`) · multi-select bulk-bar wymaga API bulk (Meeting/Reports/Tools/Assessment) · Execution Workstreams = pusty stub.
| 3 Instrumenty+Huby+Chat | ~45 | ⬜ |
| 4 Hartowanie | perf/copy/sygnatura | ⬜ |
| 5 Light mode | wszystkie klastry | ⬜ |

## FALA 0 — komponenty (szczegół)
Branch kodu: `reskin/wave-0-foundation`. Weryfikacja: `type-check` — moje 4 pliki ZERO błędów; 12 błędów TS = PRE-EXISTING (cudze WIP: DocumentStudio/MyWork/Results/settings), NIE moje.
| Element | Plik | Stan |
|---------|------|------|
| Edit Columns (crimson eye/„Show All") | `Admin/shared/ColumnSelector.tsx` | 🟦 staged |
| Badge default crimson→neutral | `ui/badge.tsx` | 🟦 staged |
| Powłoka root | `layouts/MainLayout.tsx` → bg-c-bg | 🟦 staged |
| Powłoka wrapper hubów | `shared/ModuleHub/ModuleHub.tsx` → bg-c-bg | 🟦 staged |
| Focus rings crimson→niebieski | `ui/select.tsx` + `ui/primitives/Dropdown.tsx` | 🟦 staged |
| Sidebar → tokeny | `navigation/Sidebar` | ⛔ POMINIĘTE (Piotr zaakceptował sidebar; logo „77"=brand) |
| ESLint token gate | (nowa reguła) | ⬜ |
| selection=neutral (SYS-1) | shared row/FilterableTable | ⬜ |
| Menu 2 pill (A-2) | ModuleMenu3/tabs | ⬜ |
| chip Menu 3 ramki (A-3) | ModuleMenu3 | ⬜ |
| editor-shell (D-I) | editor-shell-canon | ⬜ |
| test-data cleanup | skrypt | ⬜ |
| przemianować Menu 1/2/3 | kod+spec | ⬜ |

**PRE-EXISTING dług do flagi (NIE mój, NIE tykam):** 12 błędów TS na `feat/deliverables-w1` — `Results/PortfolioInsightsPanel`, `Results/ValueDriverTree`, `settings/AIPreferencesModule` (brak modułu), `MyWork/Idea*Tool`, `DocumentStudio/editor/*`. Branch roboczy sam z siebie nie type-check'uje się w pełni.

---

## INWENTARZ POKRYCIA (każdy ekran = wiersz; ✅ dopiero gdy build+DoD)

### A1 · My Work (P1)
⬜ MyWorkHub HUB · ✅ Tasks table LISTA · ✅ Decisions table LISTA · ✅ Notebook list LISTA · ✅ Ideas list LISTA (tabela+pool) · ✅ Inbox LISTA · ✅ Notifications LISTA · ⬜ Notatka ARTEFAKT · ⬜ Task/Decision drawer ARTEFAKT · ⬜ MindMap A · ⬜ ProcessFlow A · ⬜ Whiteboard A · ⬜ Idea Table D · ⬜ Tasks/Decisions/Notifications Kanban INSTR · ⬜ Table Platform (Workspaces/Detail/Kanban/Gantt/Grid/Calendar) · ⬜ Public form/JWT/shared

### A2 · Interview+Tools+Assessment+Audits (P1)
⬜ Interview Hub · ⬜ Discovery Consultant KONW · ⬜ Interview Sesje/Inbox/Assigned/Templates LISTA · ⬜ Discovery Tools Hub · ⬜ Tools Library (strategic/operational/digital/automation) · ⬜ **Tool detail page (ZAPROJEKTOWAĆ OD ZERA)** A · ⬜ Megatrends Workspace INSTR · ⬜ Assessment Hub · ⬜ Assessment Session Editor (macierz DRD/SIRI/ADMA) D · ⬜ Assessment Table LISTA · ⬜ **DRDReportTemplate podłączyć + DRDAssessmentMap zbudować** · ⬜ Assessment Report B · ⬜ Audits Hub · ⬜ Audit Report B

### A3 · Initiatives+Execution+Meeting (P1)
⬜ Initiatives Hub · ⬜ Initiatives Library LISTA · ⬜ Initiative Detail ARTEFAKT (C-L) · ⬜ Initiative Tasks/Gates/Gantt/Intelligence INSTR · ⬜ Portfolio Hub · ⬜ Portfolio Kanban/Timeline/Matrix INSTR · ⬜ RoadmapGantt/Kanban INSTR · ⬜ Execution Hub · ⬜ Execution Kanban/Workstreams/Problems/Timeline · ⬜ Report PMO B · ⬜ Meeting Hub

### A4 · Results+Finance (P1) + Admin/Settings (P2) + SuperAdmin (P3)
⬜ Results Hub · ⬜ Results KPI table LISTA · ⬜ Results StatusDashboard INSTR · ⬜ **M15 redesign IA (4 koncepty→hierarchia)** · ⬜ Finance/Economics Hub · ⬜ Finance statements LISTA · ⬜ ROI View ARTEFAKT · ⬜ Capacity Heatmap INSTR · ⬜ [P2] Settings (17 zakładek) · ⬜ [P2] Admin (12 zakładek) · ⬜ [P2] Organization (10 zakładek) · ⬜ [P3] SuperAdmin (24 ekrany) · ⬜ [P3] Model Registry · ⬜ [P3] Internal Tools AI OS (8)

### A5 · Materiały+Chat (P1) + builders (P2) + Public/Docs/Legal/Partner (P3)
⬜ **Chat SPEC-K KONW (P1)** · ⬜ Document Studio B · ⬜ Deck Builder E · ⬜ Tabele KIMI D · ⬜ Prezentacje KIMI · ⬜ R&P Hub · ⬜ Presentations Hub · ⬜ [P2] Report Builder B · ⬜ [P2] Assessment Report Builder · ⬜ [P2] Management Reports · ⬜ [P3] Public/marketing (15: Landing/Pricing/Enterprise/HowItWorks/ForWhom/OurStory/BusinessCases/Resources/ToolsShowcase/Trial/MiniAssessment/AppIntro/Executive/BecomePartner/PartnerApp) · ⬜ [P3] Auth (6) · ⬜ [P3] Onboarding wizards (3) · ⬜ [P3] Docs (7) · ⬜ [P3] Knowledge Base (3) · ⬜ [P3] Legal (4) · ⬜ [P3] Partner (6) · ⬜ [P3] Consultant (2) · ⬜ [P3] Meta (Status/Changelog/Vector)

---

## LOG (co wydarzyło się w nocy)
- 2026-07-01: scaffold `_AGENCI/` utworzony (protokół + 5 zleceń + ta tablica). Inwentarz ze skanu routingu (~115 ekranów).
- 2026-07-01 noc: Fala 0 — 4 fixy na `reskin/wave-0-foundation` (ColumnSelector, badge, MainLayout, ModuleHub). Type-check: moje pliki czyste; 12 błędów pre-existing (cudze). Raport: `../_RAPORT_NOCNY_2026-07-01.md`.
- Wstrzymano dalszy grind: skala=115 ekranów, praca modułowa wymaga odbioru Piotra (G0). Maszyna gotowa do wypuszczenia 5 agentów.

## WERYFIKACJA (2026-07-02)
- **Type-check bramki:** F0, F1, F2, F3 — wszystkie 11 błędów = baseline pre-existing, ZERO nowych. ~116 plików src.
- **Wizualna (preview :3012, local FE→demo BE):** ✅ app kompiluje+renderuje bez błędów konsoli; ✅ landing+login renderują; ✅ **foundation token `c-bg` dark renderuje się poprawnie** (#0a0f1e). ❌ ekrany ZA LOGINEM niezweryfikowane — login failed (dane demo niepewne / proxy). → wymaga: poprawne dane demo LUB demo-deploy (zgoda Piotra).
- **Design-gated (blokuje 100%, wymaga Piotra):** M15 IA · DRD map build · Tool detail build · Chat SPEC-K ramka · Menu 2 pill werdykt · palety danych (dodać `c-tag-*` do tailwind.config).

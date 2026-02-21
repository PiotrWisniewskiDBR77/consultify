# Wave 5 — prompty do odpalenia równolegle (Cursor x2) + Codex (Bundle 05)

Odpal te 3 prompty jednocześnie:
- **Prompt A** → Cursor (Agent mode, Opus) — Licensed tools remainder (T026–T027)
- **Prompt B** → Cursor (Agent mode, Opus) — Execution control slice (T039–T040)
- **Prompt C** → Codex — Tools: toolsets + Speed Tool (Bundle 05)

Każdy agent pracuje na SWOIM branchu. Po skończeniu — raport wg `PROMPT_TEMPLATE_V2.md`.

Uwaga: prompty są zgodne z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` (PostgreSQL, strict TS, FunnelEventName, i18n rules, nie edytujemy progress.md).

---

## PROMPT A — Cursor Agent 1 → Bundle 06 (slice) — T026–T027

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 06 — Licensed tools — SLICE** (T026 + T027):
- **T026 — Finalize SIRI and ADMA Tools** (Content + UI parity z DRD)
- **T027 — Report and Presentation Templates for DRD, SIRI, and ADMA**

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T026" i "## T027")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-06-licensed-tools-t026-t027

## Krok 2: Implementacja (V2 deliverables)

### T026 — SIRI/ADMA finalize
- SIRI i ADMA są `available` w Licensed Tools (parity z DRD)
- Content: dopracowane opisy block/dimension/pillar, definicje skali (SIRI 0–5, ADMA 1–5), guidance jak zbierać evidence
- UX/UI parity z DRD: nawigacja, sposób odpowiedzi (current level, notes, evidence), Summary workspace
- Workflow parity: draft → in review → awaiting approval → approved (reject + reason)
- Generowanie raportów i inicjatyw dostępne dopiero po `approved`
- AI support: copilot pomaga w ocenianiu, wyniki po approve są w kontekście AI

### T027 — Report and Presentation Templates
- 3 templates raportów: DRD, SIRI, ADMA — auto-populated z assessmentu
- 3 templates decków: DRD, SIRI, ADMA — eksport PPTX
- Raport: executive summary → results → gaps → priorities → roadmap outline
- Deck: 10–15 slajdów, sponsor-ready
- Gating: tylko z assessmentów `APPROVED`

## Pliki startowe (podpowiedź)
- src/components/assessment/tools/SIRIForm.tsx, ADMAForm.tsx
- src/components/assessment/maps/SIRIAssessmentMap.tsx, ADMAAssessmentMap.tsx
- src/components/assessment/AssessmentModuleHub.tsx
- src/components/assessment/reports/templates/SIRIReportTemplate.tsx, ADMAReportTemplate.tsx
- src/services/assessmentKnowledge/siriKnowledge.ts, admaKnowledge.ts
- src/services/frameworkRegistry.ts

## Zasady (MUST)
- DB = PostgreSQL. Migracje w server/migrations/*.sql — natywny PostgreSQL. Ostatni numer: 560.
- i18n: EN+PL minimum. Klucze na końcu translation.json, prefix assessment.* lub licensedTools.*
- Jeśli dodajesz analytics events → rozszerz FunnelEventName w src/services/funnelAnalytics.ts
- NIE edytuj docs/plans/v2-delivery/progress.md
- UI: docs/ui-standards/README.md, N-mode, lucide-react

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## PROMPT B — Cursor Agent 2 → Bundle 10 (slice) — T039–T040

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 10 — Execution control — SLICE** (T039 + T040):
- **T039 — Timeline Management** (operational control layer)
- **T040 — Risk Signaling and Mitigation Management** (RAID + proactive alerts)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T039" i "## T040")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-10-execution-t039-t040

## Krok 2: Implementacja (V2 deliverables)

### T039 — Timeline Management
- Timeline views: Gantt dla inicjatyw (SCHEDULED, EXECUTING, BLOCKED, DONE)
- Paski inicjatyw: plannedStartDate/plannedEndDate, status-based coloring
- Dependencies: wizualizacja zależności (linie/strzałki), walidacja sekwencji, circular deps jako error
- Updates: status, planowane daty (z audit log), progress (jeśli pole istnieje)
- Monitoring: top warnings (overdue, blocked, dependency risk), "next gate / next action"
- Filters: status, priority, owner, search po nazwie

### T040 — Risk Signaling
- RAID: konsolidacja ryzyk, tworzenie/aktualizacja wpisów
- Early warning: alerty do właściwych osób
- Mitigacje: plan → owner → due date → status
- Wykrywanie heurystyczne: overdue tasks, brak mitigacji

## Pliki startowe (podpowiedź)
- src/components/Execution/ExecutionHub.tsx
- src/components/Execution/ExecutionTimelineView.tsx
- src/components/Execution/ExecutionDetailPanel.tsx
- src/views/ExecutionView.tsx
- server/src/services/initiative*, server/src/routes/initiative*

## Zasady (MUST)
- DB = PostgreSQL. Migracje w server/migrations/*.sql — natywny PostgreSQL. Ostatni numer: 560.
- i18n: EN+PL minimum. Klucze na końcu translation.json, prefix execution.*
- Jeśli dodajesz analytics events → rozszerz FunnelEventName w src/services/funnelAnalytics.ts
- NIE edytuj docs/plans/v2-delivery/progress.md
- UI: docs/ui-standards/README.md, N-mode, lucide-react

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## PROMPT C — Codex → Bundle 05 (Tools: toolsets + Speed Tool) — T019, T022–T024

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 05 — Tools: toolsets + Speed Tool**:
- **T019 — Development of First 10 Consulting Tools** (draft initiatives przez Tools → Initiatives; spójny UX N-mode)
- **T022 — 10 Operational Improvement Tools** (measurable impact)
- **T023 — 10 Digital Transformation Tools** (execution-ready)
- **T024 — Speed Tool: Process Automation Framework** (canonical automation method)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T019" ... "## T024")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-05-tools-toolsets-speed

## Ważne deliverables (minimum V2)

### T019 (dopełnienie po Bundle 04)
- Draft initiatives przez Tools → Initiatives, spójny UX N-mode
- Wspólny flow: Fill → Results → Reasoning → Prepare → Report/Deck → Initiatives

### T022 — 10 Operational Tools
- tool_sessions: sop-builder, a3-problem-solving, smed-planner, dms-builder, inventory-autopilot, vsm-builder, constraint-control, decision-engine, control-tower, automation-pipeline
- Flow: Fill → Results → Reasoning → Prepare → Report/Deck → Initiatives
- Impact hypothesis: baseline → target, jednostki
- KB per tool (T020): "How to use" + common mistakes

### T023 — 10 Digital Tools
- tool_sessions: robotics-feasibility, logistics-automation, rpa-scanner, ai-discovery, integration-diagnostic, digital-value-pool, legacy-analyzer, data-inventory, pain-to-solution, pain-explorer
- Results: execution readiness (prerequisites, risks, dependency map, quick wins vs strategic bets)

### T024 — Speed Tool (process-automation)
- Multi-step wizard: Identification → Process mapping → Measurement → Redesign → Re-estimation → Economics → Initiatives
- Finansowe uzasadnienie (baseline/target, ROI assumptions)

## Pliki startowe (podpowiedź)
- src/components/Discovery/DiscoveryToolsHub.tsx
- src/components/DiscoveryTools/ToolWorkspace.tsx, KnownToolDetailView.tsx
- server/src/services/KnownToolsService.ts
- server/migrations/559_tools_known_tools_library.sql (struktura tools)
- docs/ui-standards/02-components/building-blocks.md

## Zasady (MUST)
- DB = PostgreSQL. Migracje natywny PostgreSQL. Ostatni numer: 560.
- i18n: EN+PL, klucze na końcu, prefix tools.*
- Jeśli analytics → FunnelEventName
- NIE edytuj progress.md
- UI: docs/ui-standards/README.md, N-mode

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## Po zakończeniu pracy agentów

Gdy agent zgłosi gotowość ("in_review"):

1. Sprawdź branch: git switch bundle-XX-nazwa
2. Uruchom testy: npm run verify:quick (i test:protect jeśli dotyczy)
3. Manual QA z checklisty
4. Merge: git switch main && git pull && git merge bundle-XX-nazwa --no-edit
5. Jeśli konflikty w translation.json — rozwiąż ręcznie (klucze na końcu)
6. Push: git push origin main
7. Zaktualizuj progress.md centralnie: Status → merged

# Wave 7 — prompty do odpalenia równolegle (Cursor x2) + Codex (Bundle 09)

Odpal te 3 prompty jednocześnie:
- **Prompt A** → Cursor (Agent mode, Opus) — Presentations generator (T058–T059)
- **Prompt B** → Cursor (Agent mode, Opus) — Reports generator (T060–T061)
- **Prompt C** → Codex — Portfolio optimization (T034–T038)

Każdy agent pracuje na SWOIM branchu. Po skończeniu — raport wg `PROMPT_TEMPLATE_V2.md`.

Uwaga: prompty są zgodne z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` (PostgreSQL, strict TS, FunnelEventName, i18n rules, nie edytujemy progress.md).

---

## PROMPT A — Cursor Agent 1 → Bundle 17 — T058–T059

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 17 — Presentations generator + templates**:
- **T058 — Presentation Generator** (Gamma.app‑level quality, BCG‑grade PPTX, platform artifacts → deck)
- **T059 — Business Presentation Templates** (brand kits + preset deck types + intent library)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T058", "## T059")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-17-presentations-generator

## Krok 2: Implementacja (V2 deliverables)

### T058 — Presentation Generator
- Gamma.app‑level quality: BCG‑grade PPTX
- Input: platform artifacts (initiatives, reports, assessments, portfolio data)
- Output: sponsor‑ready deck (PPTX)
- Wykorzystaj istniejące: assessmentDeckService, block types, report builder

### T059 — Business Presentation Templates
- Brand kits: logo, kolory, fonty (per org)
- Preset deck types: executive summary, roadmap, assessment results, portfolio review
- Intent library: mapowanie intencji → struktura slajdów

## Pliki startowe (podpowiedź)
- server/src/services/assessmentDeckService.ts
- server/src/services/reportGenerationService.ts
- src/components/ReportBuilder/*, src/components/assessment/reports/*
- docs/ui-standards/02-components/building-blocks.md

## Zasady (MUST)
- DB = PostgreSQL. Migracje w server/migrations/*.sql — natywny PostgreSQL. Ostatni numer: 566.
- i18n: EN+PL minimum. Klucze na końcu translation.json, prefix presentations.* lub reports.*
- Jeśli dodajesz analytics events → rozszerz FunnelEventName w src/services/funnelAnalytics.ts
- NIE edytuj docs/plans/v2-delivery/progress.md
- UI: docs/ui-standards/README.md, N-mode, lucide-react

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## PROMPT B — Cursor Agent 2 → Bundle 18 — T060–T061

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 18 — Reports generator + templates**:
- **T060 — Structured Report Generator** (block builder, pro formatting, export‑ready, "first on market")
- **T061 — Standardized Business Report Templates** (business-grade library, use-case presets)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T060", "## T061")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-18-reports-generator

## Krok 2: Implementacja (V2 deliverables)

### T060 — Structured Report Generator
- Block builder: sekcje/bloki raportu (executive summary, findings, recommendations, appendix)
- Pro formatting: spójny layout, tabele, wykresy, numeracja
- Export‑ready: PDF, print
- Wykorzystaj istniejące: report builder, block types

### T061 — Standardized Business Report Templates
- Biblioteka szablonów: assessment report, portfolio review, benefits report, executive brief
- Use-case presets: typ raportu → domyślna struktura bloków
- Business-grade: sponsor‑ready, skanowalne

## Pliki startowe (podpowiedź)
- server/src/services/reportGenerationService.ts
- src/components/ReportBuilder/*
- server/migrations/* (block types, report templates)
- docs/ui-standards/02-components/building-blocks.md

## Zasady (MUST)
- DB = PostgreSQL. Migracje w server/migrations/*.sql — natywny PostgreSQL. Ostatni numer: 566.
- i18n: EN+PL minimum. Klucze na końcu translation.json, prefix reports.*
- Jeśli dodajesz analytics events → rozszerz FunnelEventName w src/services/funnelAnalytics.ts
- NIE edytuj docs/plans/v2-delivery/progress.md
- UI: docs/ui-standards/README.md, N-mode, lucide-react

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## PROMPT C — Codex → Bundle 09 — T034–T038

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 09 — Portfolio optimization engines**:
- **T034 — AI Correlation and Optimization Across Initiatives** (portfolio coherence)
- **T035 — Cross‑Initiative Time Optimization Engine** (sequence + bottlenecks + scenarios)
- **T036 — AI Workload Forecasting and Intelligent Task Allocation** (capacity → assignment suggestions)
- **T037 — Non‑Human Resource Allocation for Parallel Initiatives** (budget/tools/infra/vendors)
- **T038 — Scenario‑Based Timeline and Budget Optimization** (trade‑offs: time vs spend)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T034" ... "## T038")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-09-portfolio-optimization

## Ważne deliverables (minimum V2)

### T034 — AI Correlation
- Detekcja: timeline overlaps, dependency risks, resource conflicts, priority incoherence, duplication/overlap
- Rekomendacje: co zmienić + rationale
- UI: PortfolioListView — "AI: Analyze selection" → panel Conflicts, Priority suggestions, Consolidation
- Apply model: brak auto‑zmian, przycisk Apply per rekomendacja + audit log
- Explainability: "dlaczego tak", "jak to wpływa"

### T035 — Time Optimization
- Sequence + bottlenecks + scenarios
- Wykrywanie critical path, konfliktów terminów

### T036 — Workload Forecasting
- Capacity → assignment suggestions
- Gap analysis per owner/team

### T037 — Non‑Human Resources
- Budget/tools/infra/vendors allocation
- Parallel initiatives resource planning

### T038 — Scenario Optimization
- Trade‑offs: time vs spend
- Scenariusze "co jeśli"

## Pliki startowe (podpowiedź)
- src/components/Portfolio/* (PortfolioListView)
- server/src/routes/ai.routes.ts (initiatives/conflicts, priorities)
- server/src/services/initiative*, server/src/controllers/InitiativeController
- src/components/Execution/ExecutionHub.tsx, ExecutionTimelineView.tsx

## Zasady (MUST)
- DB = PostgreSQL. Migracje natywny PostgreSQL. Ostatni numer: 566.
- i18n: EN+PL, klucze na końcu, prefix portfolio.* lub execution.*
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

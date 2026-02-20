# Wave 6 — prompty do odpalenia równolegle (Cursor x2) + Codex (Bundle 11)

Odpal te 3 prompty jednocześnie:
- **Prompt A** → Cursor (Agent mode, Opus) — Licensed tools advanced (T028, T030, T031)
- **Prompt B** → Cursor (Agent mode, Opus) — Execution control remainder (T041–T042)
- **Prompt C** → Codex — Execution: people/change/comms (T043–T045)

Każdy agent pracuje na SWOIM branchu. Po skończeniu — raport wg `PROMPT_TEMPLATE_V2.md`.

Uwaga: prompty są zgodne z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` (PostgreSQL, strict TS, FunnelEventName, i18n rules, nie edytujemy progress.md).

---

## PROMPT A — Cursor Agent 1 → Bundle 07 — T028, T030, T031

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 07 — Licensed tools (advanced)**:
- **T028 — Lean 4.0 Audit and Implementation Framework** (DBR77: Pomierz → Zoptymalizuj → Automatyzuj)
- **T030 — External PDF Import and Mapping** (third‑party assessments → internal models)
- **T031 — Integration of Additional Paid Assessments** (scalable integration format)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T028", "## T030", "## T031")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-07-licensed-tools-advanced

## Krok 2: Implementacja (V2 deliverables)

### T028 — Lean 4.0 (LEAN framework)
- Framework LEAN w Licensed Tools (DBR77: Pomierz → Zoptymalizuj → Automatyzuj)
- 3 fazy: Pomierz / Zoptymalizuj / Automatyzuj; 2 perspektywy: Procesy / Stanowiska
- Checklisty, evidence guidance, coach questions, micro-lekcje
- AI copilot jako audytor/trener (dopytuje, wykrywa niespójności, NIE wciska poziomu)
- Output: overall score, top wastes, quick wins, automation opportunities, roadmap transformacji
- Roadmapa → inicjatywy (opis, zakres, priorytet)
- Raport audit → roadmap (PDF/print)

### T030 — External PDF Import
- Import PDF z zewnętrznych assessmentów (third-party)
- Mapowanie do wewnętrznego modelu (DRD/SIRI/ADMA)
- UI: upload → preview → mapowanie pól → import

### T031 — Paid Assessments Integration
- Skalowalny format integracji dodatkowych płatnych assessmentów
- Konfiguracja per framework (metadata, schema, pricing)
- Rozszerzalna architektura (plugin-style)

## Pliki startowe (podpowiedź)
- src/components/assessment/AssessmentModuleHub.tsx
- src/services/frameworkRegistry.ts
- src/components/assessment/maps/*, tools/*
- server/src/routes/assessment*.ts, server/src/services/*

## Zasady (MUST)
- DB = PostgreSQL. Migracje w server/migrations/*.sql — natywny PostgreSQL. Ostatni numer: 562.
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

## PROMPT B — Cursor Agent 2 → Bundle 10 (slice) — T041–T042

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 10 — Execution control — SLICE** (T041 + T042):
- **T041 — Delay Detection and Schedule Control** (plan vs actual, deviations → alerts)
- **T042 — Budget Planning and Financial Control** (AI‑supported, assumptions vs actual)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T041" i "## T042")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-10-execution-t041-t042

## Krok 2: Implementacja (V2 deliverables)

### T041 — Delay Detection
- Plan vs actual: inicjatywy (plannedStart/End vs execution dates), taski (due_date, SLA)
- Deviation types: late start, late finish risk, deadline risk
- Progi: warning (np. 3 dni), critical (7+ dni / overdue)
- Alerts: throttling (max 1/24h per initiative/task per type), link do Timeline/Initiative
- "Why slip" context: BLOCKED, dependencies, overload, RAID, brak ownera
- UI: panel/lista opóźnień w Execution module, filtry (severity, status, owner)
- Timeline: wizualne oznaczenie slip/overdue + tooltip „why”
- Ops: cron/scheduled worker — liczy deviations, zapisuje delay signals, wysyła alerty

### T042 — Budget Planning and Financial Control
- Plan vs actual per inicjatywa / projekt
- Forecast do końca okresu
- Sygnały overspend risk
- Assumptions: budżet planowany, jednostki, koszty
- Actual: wpisy wykonania (manual w V2)
- UI: widok budżetu w Execution, inicjatywa-level budget section

## Pliki startowe (podpowiedź)
- src/components/Execution/ExecutionHub.tsx
- src/components/Execution/ExecutionTimelineView.tsx
- server/src/routes/executionControl.routes.ts
- server/src/services/riskDetectionService.ts
- server/migrations/561_execution_control_t039_t040.sql (istniejące tabele)

## Zasady (MUST)
- DB = PostgreSQL. Migracje w server/migrations/*.sql — natywny PostgreSQL. Ostatni numer: 562.
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

## PROMPT C — Codex → Bundle 11 — T043–T045

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 11 — Execution: people/change/comms**:
- **T043 — Human Resource Management and Capability Alignment** (kompetencje → wymagania → assignment)
- **T044 — Change Emotion and Sentiment Management** (privacy‑first, odporność na bias)
- **T045 — Stakeholder Communication and Change Communication Management** (cadence + segmenty + log)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T043" ... "## T045")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-11-execution-people-change-comms

## Ważne deliverables (minimum V2)

### T043 — Capability Alignment
- Katalog kompetencji (taxonomia) + poziomy (1–5) + tagi
- Profil użytkownika: kompetencje + poziom
- Wymagania per task: wymagane kompetencje + min level
- Match score: task/initiative ↔ user/team
- Gap view: braki kompetencji (krytyczne / nice‑to‑have)
- Rekomendacje: przypisanie innej osoby, szkolenie, vendor, re‑scope
- UI: widok zespołu + capability matrix, task z wymaganiami + sugestie kandydatów
- AI może proponować przypisania, NIE przypisuje automatycznie

### T044 — change Emotion / Sentiment
- Pulse check‑ins (1–3 pytania, skala + opcjonalny komentarz)
- Feedback otwarty (anonimowy / jawny — polityka org)
- Sygnał przypięty do inicjatywy/projektu
- Agregacja trendów + ryzyka (resistance risk)
- Propozycje reakcji change‑management
- Privacy‑first: brak danych jednostkowych dla sponsorów

### T045 — Stakeholder Communication
- Cadence: harmonogram komunikacji (tygodniowo / co 2 tygodnie)
- Segmenty: sponsor, PMO, team, stakeholders
- Log: co zostało wysłane, kiedy, do kogo
- Szablony: typy komunikatów (status, milestone, risk, change)
- UI: panel komunikacji w Execution / Initiative

## Pliki startowe (podpowiedź)
- src/components/Execution/*
- src/components/Initiatives/* (ResourcesSection, InitiativeDetailModal)
- server/src/routes/*, server/src/services/*
- docs/ui-standards/02-components/shared-sections.md

## Zasady (MUST)
- DB = PostgreSQL. Migracje natywny PostgreSQL. Ostatni numer: 562.
- i18n: EN+PL, klucze na końcu, prefix execution.* lub people.*
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

# Final Implementation Contract — Ankiety (Position 9/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Generalnie ok; ewentualnie poprawa UI/UX.
- **Primary users**: operatorzy zbierający dane (survey owners) + respondenci.
- **Success metric**: „credible structured collection lane” z governed submission lifecycle i bridge do downstream insight (bez udawania, że survey = insight).

## 2. Scope
### 2.1 In-scope
- Operator workflow (create/run/review submission state).
- Submission governance + read-only/locked truth.
- Handoff do `Wnioski w Interview`.

### 2.2 Out-of-scope / non-goals
- Full assessment orchestration.
- Full reporting/analytics suite.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_ANKIETY_2026-03-29.md`
- Flow: `docs/flows/core/ASSESSMENT_EXECUTION_FLOW.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Ankiety` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_ANKIETY_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Typeform (logic + webhooks + export/reporting posture)**:
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029116392-What-is-branching-logic.html` (branching logic: conditional paths; “respondents never have to skip irrelevant questions”).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360057591531-Logic-Map.html` (Logic Map: wizualizacja ścieżek + troubleshooting; limity mapy przy dużej liczbie reguł).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/12978390412692-Webhooks-Troubleshooting-and-FAQ.html` (webhooks delivery posture; duplikaty “at least once” i retry gdy brak HTTP 200).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029253572-Export-your-responses.html` (export CSV/XLSX, tylko filtrowane/wybrane; export file uploads jako zip).
- **SurveyMonkey (skip logic / quotas / operator-ready collecting + API)**:
  - `Softs/0 Ankiety/Surveymonkey 2/help.surveymonkey.com/en/surveymonkey/create/skip-logic/index.html` (skip logic: różne ścieżki na podstawie strony lub answer choice; zastosowania: consent/disqualification/multilingual).
  - `Softs/0 Ankiety/Surveymonkey 2/help.surveymonkey.com/en/surveymonkey/create/quotas/index.html` (quotas: auto-close po osiągnięciu ratio qualified responses; balans próbki).
  - `Softs/0 Ankiety/Surveymonkey 1/developer.surveymonkey.com/api/v3/index.html` (SurveyMonkey API portal; docs hostowane jako osobna powierzchnia).
- **Qualtrics (enterprise survey/API family evidence)**:
  - `Softs/0 Ankiety/Qualtrics 1/api.qualtrics.com/index.html` (Qualtrics public API docs entry surface).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “operator-safe collection lane + governed submission lifecycle”, nie “pełna platforma assessment + analytics”.**

- **Logic/branching as first-class (Typeform + SurveyMonkey)**:
  - Branched flows (branching/skip logic) muszą być jawne, testowalne, i weryfikowalne przed publikacją.
  - Dla złożonych ankiet: potrzebna jest “mapa logiki” (wizualizacja ścieżek) oraz narzędzia do troubleshooting.
- **Quotas / sampling governance (SurveyMonkey)**:
  - Quoty i ograniczenia zbierania (auto-close przy osiągnięciu warunku) jako element operator workflow, nie “ręczne pilnowanie”.
- **Submission delivery posture + retries (Typeform webhooks doctrine)**:
  - System ma jasno opisać semantykę dostarczeń (np. at-least-once) i mieć bezpieczne retry/recovery bez utraty danych.
- **Export posture (Typeform)**:
  - Eksport jest częścią workflow (filtry/wybór → export) oraz wspiera załączniki (download uploads).
- **Bridge: collection ≠ insight (Wave1 doctrine)**:
  - Kontrakt wymaga jawnego handoff do `Wnioski w Interview` (przygotowanie do przeglądu i syntezy), bez obietnic “insight generator” w module Ankiet.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_ANKIETY_2026-03-29.md` + flow `ASSESSMENT_EXECUTION_FLOW.md`.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Operator workflow depth | create/run/review w jednym lane | “operator workflow shallow” | Pogłębić operator lifecycle: statusy, next actions, review queue | P0 |
| Submission governance follow-through | recoverable outcomes + locked truth | “governance not deep enough” | Domknąć submission lifecycle (pending/partial/complete/invalid) + recovery | P0 |
| Collection→insight bridge | structured handoff | “bridge still weak” | Ustalić i dowieźć handoff pakietu odpowiedzi do `Wnioski w Interview` | P0 |
| Logic troubleshooting posture | visualize + validate | (nieudowodnione jako zamknięte) | Wprowadzić mechanikę walidacji/preview logiki (lub jawnie ograniczyć) | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Operator rozumie stan submissions i next actions; istnieje widoczny bridge do insight lane.
- Submissions mają governed lifecycle (w tym partial/duplicate/invalid tam gdzie dotyczy) + locked/read-only truth po zamknięciu.
- Logika ankiety (jeśli wspierana w deklarowanym zakresie) jest testowalna przed publikacją i nie generuje “martwych ścieżek”.

### 5.2 Tests
- Integracyjne: create → collect → state transitions → lock → export → handoff do `Wnioski w Interview`.
- Regression: duplicate submission / partial submission (jeśli wspierane) → czytelny stan + rekomendowana akcja operatora.
- Contract tests: status grammar dla submission (pending/complete/locked/disputed) jest spójna w UI i API.

### 5.3 Staging proof checklist
- Staging run „create → collect → review state → export → handoff”.
- Demo logic: przynajmniej 1 ankieta z branching/skip (albo jawny non-goal w implementacji) + proof walidacji.


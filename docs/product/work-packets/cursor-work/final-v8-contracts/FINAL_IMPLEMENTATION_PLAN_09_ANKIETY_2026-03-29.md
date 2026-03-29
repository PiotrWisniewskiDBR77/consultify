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
- **Primary**: `Typeform` (wprost jako benchmark-class w planie: „Typeform-class product depth”).
- **Note**: `Softs/0 Ankiety` jest wskazane jako rodzina benchmarku, ale repo nie zawiera osobnego benchmark doc z listą vendorów poza tym odniesieniem.

## 5. Evidence plan (DoD)
- Acceptance: operator rozumie stan submissions i next actions; istnieje widoczny bridge do insight lane.
- Evidence: staging run „create → collect → review state → handoff” + testy dla lifecycle i locked/read-only.


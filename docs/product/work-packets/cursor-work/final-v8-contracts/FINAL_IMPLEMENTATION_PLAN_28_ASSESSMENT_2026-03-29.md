# Final Implementation Contract — Assessment (Position 28/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Assessment AI‑driven, wykonywalne przez czat.
- **Primary users**: konsultanci prowadzący diagnostykę; odbiorcy wyników.
- **Success metric**: jedna spójna rodzina assessment: choose → run workbench → evidence/scoring → interpret → promote into action/outputs.

## 2. Scope
### 2.1 In-scope
- Shared assessment workbench + state model.
- Evidence/scoring/interpretation governance.
- Promotion wyników do pracy/artefaktów.

### 2.2 Out-of-scope / non-goals
- Parity z każdą metodologią/diagnostic platform w 1 kroku.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ASSESSMENT_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: „structured diagnostic workbenches” — brak jawnej listy vendorów w repo (**missing input**).

## 5. Evidence plan (DoD)
- Acceptance: workbench jest spójny; scoring/interpretation ma governance; wyniki stają się akcją.
- Evidence: staging E2E dla 1 metodologii + testy integracyjne state machine.


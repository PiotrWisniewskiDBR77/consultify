# Final Implementation Contract — Provenance / review / visibility (Position 18/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Pełne traceability myśli i kontekstu (trust grammar artefaktów).
- **Primary users**: konsumenci artefaktów, reviewerzy, operatorzy.
- **Success metric**: każdy artefakt odpowiada: skąd, jaki run, jaki stage, kto widzi, kto review’uje, co exportowano — spójnie na wszystkich powierzchniach.

## 2. Scope
### 2.1 In-scope
- Trust grammar: source/run/version lineage; review + validation; visibility + access; export trace.
- Konsystencja sygnałów w `Outputs Library` i preview/open.

### 2.2 Out-of-scope / non-goals
- Global redesign całego permissions systemu.
- Zlanie run approval z artifact review.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md`
- Module card: `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PROVENANCE_REVIEW_VISIBILITY.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: „enterprise lineage/review/visibility systems” — w repo brak zdistylowanej listy vendorów dla tej rodziny (**missing input**).
- **Adjacent benchmark direction**: `Palantir-like knowledge truth` pojawia się jako benchmark direction w rodzinie AI OS, ale nie jest tu targetem „clone” (wciąż: brak referencji 1:1 zachowań → nie zgadujemy).

## 5. Evidence plan (DoD)
- Acceptance: trust-state jest widoczny i niesprzeczny (library + preview + export history + access); stage separation jest jasna.
- Evidence: testy integracyjne trust-state + staging checklist spójności UI na kluczowych surface.


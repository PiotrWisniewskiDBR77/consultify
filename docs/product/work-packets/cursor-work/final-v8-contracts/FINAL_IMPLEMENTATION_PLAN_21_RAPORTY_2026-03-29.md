# Final Implementation Contract — Raporty (Position 21/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (shared-sourced contract; dedicated plan pending extraction)

## 1. Executive summary
- **Intent**: Gamma‑like raporty: template → “zrób raport o … używając template …”.
- **Primary users**: konsultanci/PMO tworzący raporty dla klienta/management.
- **Success metric**: raport jako trwały dokument-artefakt z template-first create, reopen/continue, review/export i traceability.

## 2. Scope
### 2.1 In-scope
- Raporty jako user-facing pozycja odrębna od ogólnego `Documents` (kontrakt zachowania).
- Template-first generation wpięta w artifact family (run→artifact→library).

### 2.2 Out-of-scope / non-goals
- Pełny „reports builder” (to osobna pozycja/ambicja w rodzinie builder).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Shared source plan: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md`
- Related: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_FULL_REPORTS_PRESENTATIONS_BUILDER_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: brak jawnie zdistylowanej listy vendorów dla „AI-first report generator” w repo (**missing input**).
- **Secondary**: `Gamma` jest benchmarkiem dla prezentacji; „Gamma-like” w intencie raportów wymaga doprecyzowania referencji raportowego zachowania (**missing input**).

## 5. Evidence plan (DoD)
- Acceptance: template-first flow działa; raport jest reopenable; review/export mają ślady; raport jest w Outputs Library.
- Evidence: staging demo + testy integracyjne artifact lifecycle dla raportów.


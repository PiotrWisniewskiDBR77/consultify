# Final Implementation Contract — Templaty (Position 24/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (shared-sourced contract; dedicated template contract may be extracted)

## 1. Executive summary
- **Intent**: Templates dla raportów i prezentacji; przeniesienie pełnej funkcji z admin do Outputs: zakładka Templaty + generator + user templates + app templates.
- **Primary users**: użytkownicy tworzący raporty/prezentacje; operatorzy utrzymujący app templates.
- **Success metric**: template = kontrakt (struktura + intent + rules), a nie tylko „ładny wybór”; templates żyją w Outputs i działają w generatorze.

## 2. Scope
### 2.1 In-scope
- Template library: user + app templates.
- Template-driven generation dla raportów i prezentacji.
- Migracja/relokacja funkcji z admin do Outputs (bez łamania governance).

### 2.2 Out-of-scope / non-goals
- Budowa pełnego buildera office suite przed stabilizacją artifact family.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Shared source plan: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_FULL_REPORTS_PRESENTATIONS_BUILDER_2026-03-29.md`
- Related format runtimes:
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PRESENTATIONS_2026-03-29.md`
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md`
  - `docs/product/PREZENTACJE_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: `Gamma` (template/theme-driven generation).
- **Supporting**: `Beautiful.ai`, `Pitch` (template discipline + delivery semantics).
- **Missing input**: brak jawnego benchmark doc dla „report templates” z listą vendorów.

## 5. Evidence plan (DoD)
- Acceptance: templates są widoczne w Outputs; user template i app template mają jasne ownership; generator używa template jako kontraktu.
- Evidence: staging demo „template → generate → reopen” + testy integracyjne template selection + permissions.


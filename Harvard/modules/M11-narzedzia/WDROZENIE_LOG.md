# M11 — Narzędzia — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala-18 | BUG-M11-01: ORDER BY created_at ambiguous po JOIN z assessment_workflows | `a8c250ec72` | GET /api/assessments → 200, brak ambiguity error | ✅ |
| 2026-06-12 | Fala-18 | BUG-M11-02: SELECT answers zamiast answers_json w assessment-reports.routes.ts | `a8c250ec72` | GET responses/frameworks → 200, answers sparsowane | ✅ |
| 2026-06-12 | Fala-18 | BUG-M11-06: ToolController total bigint string (countResult?.total ‖ 0) | `a8c250ec72` | Number() wrap; sessions pagination numeryczna | ✅ |

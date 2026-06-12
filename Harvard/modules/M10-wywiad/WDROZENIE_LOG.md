# M10 — Wywiad — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | **FAZA 4 (żywa, staging)** | S1 smoke — moduł renderuje | — | **PASS**: `/discovery` (Wywiad) renderuje zakładki Inbox/Sesje/Przydzielone/Szablony/Wnioski/Inicjatywy; zero crashy; `/api/interview` zamontowany+gated (401 bez auth). FE+BE live. **Pending:** pełny cykl S1 (TemplateBuilder→publish→trwałość), S2 (przydział→inbox+mirror-task). | ZROBIONE (D smoke) |
| 2026-06-12 | **FAZA 4-deep — SECURITY/DATA** | 6 bigint flag bugów (Postgres) | `389918a388` | **Znalezione + naprawione live.** `is_template`/`is_required`(template)/`is_team_assignment` to **bigint** na PG → node-pg zwraca string `"1"` → `row.x === 1` zawsze false. **Realny wpływ na dane staging:** 201 pytań-szablonów czytanych jako nie-szablon, 15 required-flag jako opcjonalne, 4 team-assignmenty jako indywidualne (branżujący `if` nigdy nie wchodził). Fix: helper `flagOn` w `InterviewController` + `InterviewAssignmentService` (6 miejsc). **Live proof:** `GET /sessions/:id/questions` → `isTemplate:true`, `isRequired:true` (przed fixem byłyby false). Patrz [[finding_pg_bigint_jsonb_serialization]]. **Wynik negatywny:** tabele interview = brak jsonb → `parseJson` bezpieczny (zero cichej utraty danych). | ZROBIONE |

# Post‑V3 Refactor Checklist (small PRs)

Cel: rozbić ryzyko utrzymania po V3 na małe, bezpieczne PR-y, które poprawiają testowalność i spójność bez zmiany zachowania R0.

---

## P0 (1–2 dni) — bezpieczeństwo i spójność

- [ ] **Unifikacja modelu “open docs”**: wspólny `OpenDocument` + adapter per hub (MyWork/Interview), redukcja `any`.
- [ ] **Kontrakt command row**: wspólny komponent `ModuleHubCommandRow` (search | tabs | counters) używany przez huby.
- [ ] **Traceability “db gate”**: jeden check startowy/migracyjny, który failuje, jeśli brakuje kluczowych kolumn (`source_type/source_id`), zamiast cichego fallback.

---

## P1 (3–5 dni) — testowalność i kontrola regresji

- [ ] **State logic extraction**: wydzielić logikę wyboru zakładek/command-row do czystych funkcji + unit testy.
- [ ] **DB‑less unit tests**: odciąć unit-y od Postgresa przez mock DB layer; integracyjne uruchamiać osobnym profilem.
- [ ] **Patch coverage gate (PR)**: dodać gate “diff coverage ≥ 80%” dla nowych zmian (bez podnoszenia globalnego progu).

---

## P2 (1–2 tygodnie) — architektura i ergonomia dev

- [ ] **Modularizacja dużych hubów**: `MyWorkHub` i `InterviewHub` jako shell + subcomponents (Topbar, CommandRow, ContentRouter, TabsStore).
- [ ] **E2E “Tier‑0 manual → semi‑auto”**: przepisać runbook do Playwright “guided smoke” (z hard-coded selectors + screenshot evidence).
- [ ] **Migrations discipline**: standard “no silent column fallback” dla nowych modułów + checklist w PR template.


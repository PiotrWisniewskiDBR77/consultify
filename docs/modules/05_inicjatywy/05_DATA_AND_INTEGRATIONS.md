---
module_id: MODULE_INITIATIVES
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Inicjatywy

## Purpose

Opisać: obiekty danych inicjatywy, traceability do źródeł, decyzje gate’ów, KPI i integracje z task/decision runtime.

## Must

- MUST: inicjatywa ma źródła (SourceLink) i spełnia `SOURCE_TRACEABILITY_SPEC.md` (brak inicjatywy bez źródła).
- MUST: gate decisions tworzą audytowalny zapis: kto, kiedy, rationale, outcome.
- MUST: readiness check jest obliczany przez backend i zwracany przez `gate-readiness-check` (capabilities + transitions).

## Must Not

- MUST NOT: UI nie może ukrywać braku danych wymaganych do bramki (no fake readiness).

## Should

- SHOULD: `contextCreateActions` jest mapowany do artefaktów `task`, `decision`, `raid` zależnie od status band (wg CTA matrix).

## Acceptance Criteria

- [ ] Inicjatywa pokazuje źródła / lineage tam, gdzie użytkownik podejmuje decyzję.

## Related Sources

- `DRD/consultify/docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
- `DRD/consultify/docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`


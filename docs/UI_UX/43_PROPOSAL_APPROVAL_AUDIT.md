---
uiux_doc_id: UIUX_PROPOSAL_APPROVAL_AUDIT
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Proposal → Approval → Execution → Audit (UI contract)

## Purpose

Zdefiniować wspólny kontrakt UI dla działań wysokiego wpływu (AI i nie-AI), żeby użytkownik zawsze rozumiał: co się wydarzy, co zatwierdził i co faktycznie zaszło.

## Applies To

Każda istotna mutacja (governance, dane biznesowe, security, admin, automatyzacje, AI actions) oraz długie zadania (pipelines).

## Must

- **MUST**: `proposal` — UI pokazuje plan działania (co zmienimy, na jakich danych, jakie ryzyka).
- **MUST**: `approval` — użytkownik jawnie zatwierdza (lub odrzuca) proposal przed wykonaniem.
- **MUST**: `execution` — UI pokazuje stan wykonywania (progress / job state) bez infinite spinner.
- **MUST**: `audit` — UI pozwala odtworzyć ślad (kto, kiedy, co, na czym; link do audit trail / run details).

## Must Not

- **MUST NOT**: Silent execution istotnej mutacji.
- **MUST NOT**: Fake success (toast “Saved” bez backend confirmation).

## Should

- **SHOULD**: Dla działań wysokiego ryzyka: dodatkowe “are you sure” / reason capture / dual control (tam gdzie wymagane).
- **SHOULD**: Użytkownik widzi “what changed” (before/after summary) po sukcesie.

## Acceptance Criteria

- [ ] Dla każdej krytycznej akcji da się wskazać etap: proposal/approval/execution/audit.
- [ ] Brak “ukrytych” zmian bez śladu.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (Enterprise UI Invariants §1)


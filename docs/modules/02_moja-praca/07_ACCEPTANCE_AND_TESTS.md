---
module_id: MODULE_MY_WORK
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Moja Praca / My Work

## Purpose

Define how to prove this module satisfies the author contract.

## Required Evidence

- Screenshot or recording for main happy path.
- Screenshot or recording for loading, empty, error and degraded states where applicable.
- Evidence of permissions/ACL behavior for at least one denied action.
- Evidence that generated/converted objects preserve source/provenance.
- Link to test plan, manual test prompt or automated test when available.

## Acceptance Criteria

- Home shows current work and stale states with owning-module links.
- Radar insight can become note/idea/chat without becoming execution by default.
- Calendar/meeting items show conflicts and preparation state when available.

## Regression Checklist

- [ ] Route/sidebar entry opens the intended module.
- [ ] Primary object lifecycle works end-to-end.
- [ ] Cross-module handoff keeps lineage and does not duplicate ownership.
- [ ] AI/automation actions are proposal/approval/audit aware.
- [ ] Tenant/role boundaries hold under unauthorized access.

## Gate Result Language

- `PASS`: all P0/P1 acceptance criteria met.
- `PASS_WITH_P2`: usable but non-blocking issues remain.
- `BLOCKED_P1`: critical contract behavior missing.
- `NO_GO`: security, tenancy or data-integrity breach.

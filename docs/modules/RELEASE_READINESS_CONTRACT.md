---
doc_id: RELEASE_READINESS_CONTRACT
doc_kind: ENTERPRISE_GOVERNANCE_STANDARD
owner: user
status: active
last_updated: 2026-05-10
---

# Release Readiness Contract

## Purpose

Define when Consultify can be considered ready for release from documentation, runtime, UI/UX, security, and evidence perspectives.

## Release Gate Verdicts

- `GO`: all required gates pass.
- `GO_WITH_P2`: release accepted with tracked P2 items and owners.
- `NO_GO`: P0/P1, missing evidence, security/tenant uncertainty, or unaccepted ownership conflict.

## Mandatory Gates

| Gate | Required result | Evidence |
| --- | --- | --- |
| module contract rerun | `PASS` | `npm run docs:contract:rerun-gate` |
| PR runtime-contract sync | `PASS` | `module-contract-pr-gate.ts` |
| traceability | no critical missing links | `SYSTEM_TRACEABILITY_MATRIX.md` |
| evidence | no critical `MISSING`/`OBSOLETE` | `EVIDENCE_REGISTRY.md` |
| UI/UX | approved components/artifacts used | `UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD.md` |
| security/tenancy | deny-by-default, no leakage | `06_PERMISSIONS_AND_SECURITY.md`, security tests |
| ownership | biz + tech accepted | `CONTRACT_OWNERSHIP_REGISTRY.md`, PR body |
| P2 control | all P2 have owner/date/evidence | `_P2_ZERO_CLOSURE_PLAN_2026-05-10.md` |

## Hard NO-GO Conditions

- P0/P1 open without explicit override.
- Runtime changed without contract update.
- High-impact mutation without approval/audit.
- Security/tenant boundary uncertain.
- Critical artifact lacks source/evidence/approval lineage.
- SuperAdmin bypasses domain ownership.
- UI introduces unapproved one-off component system.

## GO_WITH_P2 Conditions

Allowed only when:

- all P2 are documented,
- each P2 has owner and date,
- workaround is acceptable,
- critical path remains intact,
- release owner explicitly accepts residual risk.

## RAW Development Entry Rule

Before RAW-driven development starts:

1. RAW content must be mapped through `SYSTEM_TRACEABILITY_MATRIX.md`.
2. Any new decision must be added to `DECISION_LOG.md`.
3. Change type must pass `CHANGE_TYPE_DOR_DOD.md` DoR.
4. Scope must be frozen in module/function/system contract before coding.

## Final Release Statement Template

```md
Release verdict: GO | GO_WITH_P2 | NO_GO
Modules checked:
Critical workflows checked:
Evidence registry status:
Open P2:
Owner acceptance:
Security/tenant result:
UI/UX result:
Decision log updates:
```

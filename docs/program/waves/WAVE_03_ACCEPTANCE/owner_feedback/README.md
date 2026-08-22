# Wave 3 owner feedback intake

This directory is the durable source-intake area for Piotr's Wave 3 owner-review
observations and evidence. The authoritative module owner-findings tables now
copy/link these captured items; this directory remains their verbatim wording and
evidence provenance, not a second findings queue. It does not record implementation
or acceptance.

Current documentation result:
`READY_FOR_CONTROLLED_IMPLEMENTATION_AND_DECISION_CLOSURE / OWNER_CONFIRMATION_REQUIRED`.
See [`DOCUMENTATION_AUDIT_2026-08-21.md`](DOCUMENTATION_AUDIT_2026-08-21.md),
[`IMPLEMENTATION_READINESS_AUDIT_2026-08-21.md`](IMPLEMENTATION_READINESS_AUDIT_2026-08-21.md),
[`TRACEABILITY_MATRIX.md`](TRACEABILITY_MATRIX.md) and
[`DECISION_REGISTER.md`](DECISION_REGISTER.md).

The shared implementation contract is defined by
[`FINAL_THREE_MODULE_CONTRACT.md`](FINAL_THREE_MODULE_CONTRACT.md). Ten product,
security and commercial decisions remain explicit gates; runtime behavior and owner
acceptance remain unverified until exact-SHA replay and an explicit owner result.

## Module index

| Module | Observation register | Evidence index | Current intake status |
|---|---|---|---|
| 01 Organization | [`01_ORGANIZATION/OWNER_FEEDBACK_REGISTER.md`](01_ORGANIZATION/OWNER_FEEDBACK_REGISTER.md) | [`01_ORGANIZATION/EVIDENCE_INDEX.md`](01_ORGANIZATION/EVIDENCE_INDEX.md) | `4 COPIED_TO_MODULE / CAPTURED_UNRECONCILED / 18 EVIDENCE` |
| 14 Admin | [`14_ADMIN/OWNER_FEEDBACK_REGISTER.md`](14_ADMIN/OWNER_FEEDBACK_REGISTER.md) | [`14_ADMIN/EVIDENCE_INDEX.md`](14_ADMIN/EVIDENCE_INDEX.md) | `1 COPIED_TO_MODULE / CAPTURED_UNRECONCILED / 8 EVIDENCE + 1 CROSS-MODULE REFERENCE` |
| 13 Settings | [`13_SETTINGS/OWNER_FEEDBACK_REGISTER.md`](13_SETTINGS/OWNER_FEEDBACK_REGISTER.md) and [`13_SETTINGS/FINAL_IMPLEMENTATION_SPEC.md`](13_SETTINGS/FINAL_IMPLEMENTATION_SPEC.md) | [`13_SETTINGS/EVIDENCE_INDEX.md`](13_SETTINGS/EVIDENCE_INDEX.md) | `1 COPIED_TO_MODULE / CAPTURED_UNRECONCILED / 1 EVIDENCE / SOURCE ID COLLISION OPEN` |
| Cross-module UI standard | [`CROSS_MODULE/OWNER_FEEDBACK_REGISTER.md`](CROSS_MODULE/OWNER_FEEDBACK_REGISTER.md), [`CROSS_MODULE/SETTINGS_UI_STANDARD.md`](CROSS_MODULE/SETTINGS_UI_STANDARD.md) and [`CROSS_MODULE/VISUAL_STANDARD_CARD_AUDIT.md`](CROSS_MODULE/VISUAL_STANDARD_CARD_AUDIT.md) | [`CROSS_MODULE/EVIDENCE_INDEX.md`](CROSS_MODULE/EVIDENCE_INDEX.md) | `6 CAPTURED + 1 PROPOSED_UNRECONCILED / 5 EVIDENCE` |
| 15 AI OS | [`15_AI_OS/OWNER_FEEDBACK_REGISTER.md`](15_AI_OS/OWNER_FEEDBACK_REGISTER.md) | [`15_AI_OS/EVIDENCE_INDEX.md`](15_AI_OS/EVIDENCE_INDEX.md) | `1 CAPTURED_UNRECONCILED / 1 EVIDENCE` |
| 16 Partners | [`16_PARTNERS/OWNER_FEEDBACK_REGISTER.md`](16_PARTNERS/OWNER_FEEDBACK_REGISTER.md) and [`16_PARTNERS/PARTNER_CONTENT_SOURCE_AUDIT_2026-08-22.md`](16_PARTNERS/PARTNER_CONTENT_SOURCE_AUDIT_2026-08-22.md) | [`16_PARTNERS/EVIDENCE_INDEX.md`](16_PARTNERS/EVIDENCE_INDEX.md) | `1 CAPTURED_UNRECONCILED / 1 EVIDENCE / 5 OPEN QUESTIONS` |

Three-module final documentation:
[`FINAL_THREE_MODULE_CONTRACT.md`](FINAL_THREE_MODULE_CONTRACT.md).

## Intake controls

- Preserve Piotr's exact original wording.
- Keep observation, interpretation, expected experience and evidence separate.
- Copy temporary screenshots into the relevant module folder immediately.
- Hash the copied file and compare it with the source before declaring a match.
- Do not infer `FIXED`, `ACCEPTED` or implementation completion from intake.

## Record types and authority

| Type | Meaning | Authority |
|---|---|---|
| `*-OWN-*` | Piotr's captured observation | Owner wording is authoritative; interpretation is not |
| `*-REQ-*` | Atomic requirement derived from an observation | `OWNER_EXPLICIT` or `EXPERT_PROPOSED` must be stated |
| `*-AC-*` | Testable acceptance criterion | Remains `NOT_TESTED` until evidence exists |
| `*-EVD-*` | Preserved evidence artifact | Proves only the claim and limitations recorded in its index |
| `*-Q-*` | Open question | Cannot be silently resolved by notetaker or implementer |
| `*-DEC-*` | Integrator/owner decision | Requires named decision result and date |
| `*-RESULT-*` | Verification result | Does not itself imply owner acceptance |

Allowed status transitions are fail-closed:

- `CAPTURED_UNRECONCILED` may become reconciled only on an explicit integrator result;
- `PROPOSED_UNRECONCILED` is never treated as an owner requirement;
- `NOT_TESTED` may become `PASS`, `FAIL`, `BLOCKED` or `EVIDENCE_MISSING` only with a linked result;
- only the integrator may set `FIXED` or `ACCEPTED`, using an explicit owner outcome.

## Evidence handling

- Screenshots are `INTERNAL_RESTRICTED` until a data-exposure review says otherwise.
- `MATCH` means only that the durable copy matched the temporary source at intake.
- A screenshot is visual evidence, not proof of persistence, permission enforcement,
  API/database/provider state, audit emission or owner acceptance.
- Unknown capture metadata stays `NOT RECORDED`; it must not be reconstructed by guess.

# T01-I04 — DRD adapter realDB evidence — 2026-08-07

> Historical checkpoint: the `useRef` TSC failure and `IN_PROGRESS` wording
> below describe this run only. Later full TSC and T01 DRD gates are GREEN;
> browser evidence remains a separate residual. The later native-PostgreSQL
> increment below supersedes the earlier missing seven-axis runtime proof.

## Acceptance boundary

This increment connects an accepted Interview result pack to the canonical DRD
Assessment lifecycle. It does not let the Agent invent or self-approve maturity
scores.

1. Agent proposes a DRD assessment from Case-linked, accepted Interview Insights.
2. Proposal creation writes no `assessments` or `assessment_sessions` rows.
3. Human proposal approval creates one real `assessments` row (`assessment_type=DRD`,
   `status=DRAFT`) and one canonical Assessment session.
4. The assessment keeps Case, lineage and source Interview Insight IDs in its
   context snapshot.
5. Transformation cannot leave DRD while the assessment is draft or lacks a
   current immutable `assessment_accepted_snapshots` row.
6. Only an `APPROVED` assessment plus its current accepted snapshot advances the
   Case to `opportunity_synthesis`.

## Disposable PostgreSQL proof

Environment: isolated PostgreSQL 16 database `consultify_t01_i04`; no demo or
shared environment writes. The container was stopped and removed after readback.

Observed sequence:

```text
before DRD proposal approval:
  assessments=0
  assessment_sessions=0

after proposal approval:
  assessments=1
  assessment_sessions=1
  assessment lineage links=1

attempt to accept DRAFT assessment:
  TRANSFORMATION_DRD_OUTPUT_NOT_ACCEPTED

after canonical quality acceptance fixture + current immutable snapshot:
  lifecycle_stage=opportunity_synthesis
  Case version=7
  assessment_type=DRD
  assessment_status=APPROVED
  completion_percent=100
  current snapshot=snapshot-t01-i04
  accepted snapshot lineage links=1
  transformation_drd.results_accepted audit events=1
```

Independent `psql` readback joined Case → Transformation artifact link → DRD
Assessment → current immutable accepted snapshot → snapshot artifact link and
confirmed the values above.

## Automated checks

Targeted contract and Agent Hub regression suite:

```text
Test Files  2 passed (2)
Tests       8 passed (8)
```

## Agent Hub surface

The Transformation Case preview now provides the governed DRD controls:

- enter the proposed diagnosis name;
- prepare a non-materializing proposal from accepted Interview Insights;
- approve/reject the proposal;
- open the created assessment at `/assessment/drd/:assessmentId`;
- request final handoff only after the canonical DRD quality review has produced
  an immutable accepted snapshot.

Post-UI targeted regression remained green: `2 files / 8 tests`.

Repository-wide TypeScript verification reaches one unrelated pre-existing
error only:

```text
src/components/AIChat/KimiWorkspace/ExceleParametricTemplates.tsx(280,35):
error TS2304: Cannot find name 'useRef'.
```

The repository-wide type-check is not claimed as passed.

## Canonical seven-axis quality gate — native PostgreSQL increment

The existing minimal canonical quality contract was executed against disposable
native PostgreSQL through `i04DrdQualityReviewRealDbProof.ts`. This contract is
the server-derived 39-area completion gate plus supporting evidence on every one
of the seven canonical DRD measurement axes; it is not an invented set of seven
quality criteria.

Observed marker: `I04_DRD_QUALITY_REVIEW_REALDB_GREEN`, natural process exit `0`.

Observed readback:

```json
{
  "answeredAreas": 39,
  "evidenceAxes": 7,
  "missingEvidenceRejectedWithZeroWrites": true,
  "unauthorizedCanApprove": false,
  "unauthorizedZeroWrites": true,
  "forcedFailureRollback": true,
  "acceptedSnapshotAxes": 7,
  "acceptedSnapshotAreas": 39,
  "tenantReadbackNull": true,
  "reviewHistoryReadback": 2,
  "reviews": 2,
  "snapshots": 2,
  "current_snapshots": 1,
  "approved": 1
}
```

The six-of-seven evidence attempt returned `MISSING_EVIDENCE` with zero review,
snapshot or approval writes. The authorized acceptance persisted a tenant-owned,
immutable snapshot containing all seven axes and 39 areas. A forced failure after
snapshot insertion rolled the entire decision back. Foreign-tenant history was
empty and current-snapshot readback returned null. Replay followed the existing
versioned re-acceptance contract: a second review and immutable snapshot were
created while exactly one snapshot remained current; no unsupported exactly-once
claim is made.

Focused canonical scoring tests: `2/2` PASS. Full repository TypeScript check:
PASS. The native proof, focused tests and TSC all ran against the same local
candidate contents.

## Remaining before full DRD acceptance

- Browser runtime screenshots of proposal, approval, DRD workspace and accepted
  handoff states on the same SHA, including owning-panel authority and T01
  accepted-handoff behavior.
- Same-SHA deployed tenant-isolation evidence through the HTTP/browser boundary.
- Expert-defined advanced assessment-quality criteria and thresholds only if the
  DRD owner decides they are required; the repository currently specifies no
  additional normative criteria beyond completion and seven-axis evidence.

Status: backend adapter, immutable-output handoff and the minimal canonical
seven-axis quality gate are locally RealDB GREEN. Full T01-I04 remains
`IN_PROGRESS` pending same-SHA owning-panel/T01 browser and deployed tenant proof,
plus any separately approved expert-quality extension.

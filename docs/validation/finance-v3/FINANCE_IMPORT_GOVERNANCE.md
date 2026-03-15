# Finance Import Governance

## Purpose
Make finance import quality governable, reviewable, and releasable as a data-quality program rather than a stream of ad hoc fixes.

## Mandatory Artifacts

### 1. Audit report
Current snapshot of system behavior and failure modes.

Reference:
- `docs/validation/finance-v3/FINANCE_IMPORT_SYSTEM_AUDIT.md`

### 2. Architecture decision record
Single source of truth for whether the team is repairing or rebuilding the core.

Reference:
- `docs/validation/finance-v3/FINANCE_IMPORT_ARCHITECTURE_DECISION.md`

### 3. Remediation program
Sequenced workstreams, exit criteria, and scope boundaries.

Reference:
- `docs/validation/finance-v3/FINANCE_IMPORT_REMEDIATION_PROGRAM.md`

### 4. Corpus scorecard
Every release candidate must publish:
- total fixtures
- pass/fail count
- failure modes by count
- changed outputs versus prior run
- critical regressions introduced

### 5. Deviation register
Any accepted mismatch between SSOT and implementation must record:
- deviation description
- business risk
- owner
- mitigation
- sunset date

### 6. Release readiness gate
Finance import release sign-off requires:
- strict corpus audit result
- no unresolved critical extraction defects
- no unresolved critical mapping defects
- no unexpected import `5xx`
- documented deviations, if any

## Weekly Scorecard Template

| Metric | Target | Current | Owner |
|---|---:|---:|---|
| Strict corpus pass rate | 100% bootstrap / target on real corpus | TBD | Finance platform |
| Critical extraction defects | 0 | TBD | Extraction owner |
| Critical mapping defects | 0 | TBD | Mapping owner |
| Unexpected import `5xx` | 0 | TBD | Backend owner |
| Recoverable-to-ready cycle time | Downward trend | TBD | Product + engineering |

## Command Surface
- `npm run benchmark:statement-ready`
- `npm run audit:statement-import`
- `npm run audit:statement-import:strict`

## Governance Rule
No change to extraction, period binding, mapping, readiness, or review logic may be treated as complete until the finance import corpus and release gate are reviewed together.

# Presentation Benchmark Scorecard (DBR77 / VTS)

Status: `ACTIVE`
Cadence: monthly
Owner: Product + QA + Delivery

## Reference Decks

- `DBR77 Growth Machine`
- `VTS Program Transformacji`

## Scoring Dimensions

- `content_quality_score` (0-100): thesis clarity, narrative flow, no placeholders.
- `visual_fidelity_score` (0-100): hierarchy, spacing, consistency across slide families.
- `evidence_completeness_score` (0-100): source traceability, confidence, freshness.
- `export_consistency_score` (0-100): parity across PPTX/PDF/PNG/HTML.

## Verdict Rules

- `PASS`: no P0/P1 and all four dimensions >= 90.
- `PASS_WITH_P2`: no P0/P1 and at least one dimension in 75-89.
- `BLOCKED_P1`: any P0/P1 issue or any dimension < 75.
- `INCONCLUSIVE`: run not reproducible or evidence set incomplete.

## Monthly Run Template

| Month | Deck | Content | Visual | Evidence | Export | Verdict | Open P1 | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| YYYY-MM | DBR77 Growth Machine | 0 | 0 | 0 | 0 | INCONCLUSIVE | none | |
| YYYY-MM | VTS Program Transformacji | 0 | 0 | 0 | 0 | INCONCLUSIVE | none | |

## Delta Tracking

For each month, record:

- previous score vs current score per dimension,
- blockers introduced vs resolved,
- top three actions for next cycle with owner and ETA.

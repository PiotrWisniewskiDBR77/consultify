# Presentation Monthly Benchmark Operations (Epic H1)

Status: `ACTIVE`
Owner: Product + QA + Delivery
Cadence: monthly
Source-of-truth template: `docs/testing/PRESENTATION_BENCHMARK_SCORECARD.md`

This runbook closes Epic H1 from `PRESENTATION_ARTIFACT_ENGINE_SYSTEM_AND_BACKLOG.md`
by turning the manual DBR77/VTS scorecard template into an operational
cadence backed by a CLI generator (`benchmark:monthly`), a deterministic
scoring service (`presentationBenchmarkScorecardService`), and a backing
table (`presentation_benchmark_runs`, migration `768`).

## 1. Purpose & Cadence

- One run per organization per calendar month, labelled `YYYY-MM`.
- Goal: track the gap to Gamma-class delivery quality (target Q3 2026).
- Output per run:
  - JSON record (`BenchmarkRunRecord`) — machine-consumable history.
  - Markdown report — human-readable scorecard with per-dimension status,
    delta vs prior run, and largest movements.
  - Optional `presentation_benchmark_runs` row (`--persist` flag).

## 2. Reference Deck Pool

The deck set is defined in `docs/testing/PRESENTATION_BENCHMARK_SCORECARD.md`:

- `DBR77 Growth Machine`
- `VTS Program Transformacji`

The default `--reference-set` is `DBR77+VTS`. Use a narrower label
(e.g. `DBR77`) when only one reference suite is scored — the service
treats different `reference_set` values as separate history streams,
so don't mix sets in a single run.

## 3. Scoring Procedure

Each run produces five per-dimension scores per deck (1-5 floats). The
dimensions and their interpretation:

| Dimension | What it measures |
| --- | --- |
| `content_quality` | Thesis clarity, narrative flow, no placeholders. |
| `visual_design` | Hierarchy, spacing, slide-family consistency. |
| `long_context_processing` | Behaviour on long source artifacts and multi-section briefs. |
| `api_automation` | Headless generation, export parity, programmatic edits. |
| `conversational_editing` | AI proposal quality, rejection rate, revert safety. |

Today the scores are produced manually by the QA judges (Product + QA +
Delivery owners). The `Future work` section below covers automated
scoring — this is intentionally out of scope for H1.

The judges agree per-deck scores in a shared sheet, then export them
into a JSON file shaped as `DeckScoreInput[]`:

```json
[
  {
    "deckId": "dbr77-growth",
    "deckTitle": "DBR77 Growth Machine",
    "contentQuality": 4.5,
    "visualDesign": 4.2,
    "longContextProcessing": 4.0,
    "apiAutomation": 3.8,
    "conversationalEditing": 4.3,
    "notes": "Hero slide still placeholder-prone."
  }
]
```

## 4. CLI Reference

The CLI lives at `server/scripts/run-monthly-benchmark.ts` and is exposed
as the `benchmark:monthly` npm shortcut.

```bash
# Dry-run from the repo root
npm run benchmark:monthly -- \
  --organization-id org_dbr77 \
  --run-label 2026-05 \
  --reference-set DBR77+VTS \
  --input ./scores.json \
  --report-file ./monthly-benchmark-2026-05.json \
  --markdown-file ./monthly-benchmark-2026-05.md \
  --reported-by piotr@dbr77.com

# Persist the result to the DB
npm run benchmark:monthly -- \
  --organization-id org_dbr77 \
  --run-label 2026-05 \
  --reference-set DBR77+VTS \
  --input ./scores.json \
  --reported-by piotr@dbr77.com \
  --persist
```

| Flag | Required | Notes |
| --- | --- | --- |
| `--organization-id` | yes | Tenant id (mirrors `presentation_decks.organization_id`). |
| `--run-label` | yes | Must match `YYYY-MM`. |
| `--reference-set` | no | Defaults to `DBR77+VTS`. |
| `--input` | yes | Path to a JSON file containing `DeckScoreInput[]`. |
| `--report-file` | no | Writes the full `BenchmarkRunRecord` as JSON. |
| `--markdown-file` | no | Writes the deterministic Markdown scorecard. |
| `--reported-by` | no | Free-form name/email of the run owner. |
| `--notes` | no | Free-form summary stored on the run row. |
| `--persist` | no | Opt-in flag — without it the run is dry-run only. |
| `--quiet` | no | Suppresses stdout summary; errors still print to stderr. |

### Exit codes

- `0` — `PASS` or `PASS_WITH_WARNINGS`.
- `1` — `BLOCK` (any dimension below `WARNING_THRESHOLD = 3.5`).
- `2` — argument or runtime error (missing file, invalid JSON, bad
  `--run-label`, etc.).

`--persist` semantics: the script always computes and prints the
scorecard; persistence is best-effort. If the migration has not been
applied, persistence reports `storage_error` on stderr and the run still
exits with the verdict-driven code so CI can decide what to do.

## 5. DB Schema

Backed by `server/migrations/768_presentation_benchmark_runs.sql`:

```sql
CREATE TABLE presentation_benchmark_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  run_label TEXT NOT NULL,
  reference_set TEXT NOT NULL,
  total_decks_scored INTEGER NOT NULL DEFAULT 0,
  scores JSONB NOT NULL,
  verdict TEXT NOT NULL,
  delta_vs_prior JSONB,
  notes TEXT,
  reported_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, run_label)
);
```

The `(organization_id, run_label)` unique constraint is the canary for
duplicate runs — see Failure Modes below. Because the service is
schema-tolerant, missing-table errors degrade to `storage_error` rather
than 500-ing the CLI or the `/api/presentations/benchmark/history`
endpoint.

## 6. Markdown Report Format

`renderBenchmarkScorecardMarkdown` produces a deterministic report — no
timestamps in the body, only `createdAt` in the footer. Layout:

1. Title `# Presentation Benchmark Scorecard - YYYY-MM`.
2. Verdict line: `Verdict: PASS | PASS_WITH_WARNINGS | BLOCK`.
3. Run metadata: reference set, decks scored, gamma target.
4. Dimension table with columns: `Dimension | Current | Prior | Delta | Status`.
5. `## Largest movements vs prior run` (top three by `|delta|`, or a
   "no prior run available" placeholder).
6. Optional `## Notes` block (when the input had `--notes` or the prior
   run carried notes forward).
7. Footer: `Reported by: ... | Created at: ...`.

`Status` uses ASCII tokens only — `OK` (≥ gamma target), `~`
(`WARNING_THRESHOLD` ≤ score < gamma target), `FAIL` (< warning floor).
This is intentional to keep the Markdown emoji-free per UI/UX governance.

## 7. Delta Interpretation Guidelines

- `+0.10` to `+0.30` per dimension month-over-month is healthy progress
  toward Gamma; flag a regression review when any dimension regresses
  by more than `0.20`.
- A flip from `OK` to `~` on any dimension is a warning signal even when
  the verdict stays `PASS_WITH_WARNINGS`.
- A flip from `~` to `FAIL` is always a blocker — open a P1 in the
  presentation generator backlog and link it from the scorecard `notes`.
- Deltas are clamped to two decimals; treat micro-deltas (`±0.01`) as
  noise unless multiple dimensions move together.

## 8. Verdict Thresholds

Defined as named constants in
`server/src/services/presentationBenchmarkScorecardService.ts`:

```ts
export const GAMMA_TARGET = 4.0;
export const WARNING_THRESHOLD = 3.5;
```

Verdict rules (`computeVerdict`):

- `PASS` — all five dimensions ≥ `GAMMA_TARGET`.
- `PASS_WITH_WARNINGS` — at least one dimension between
  `WARNING_THRESHOLD` and `GAMMA_TARGET` (inclusive lower bound,
  exclusive upper bound), no dimension below `WARNING_THRESHOLD`.
- `BLOCK` — any dimension below `WARNING_THRESHOLD`.

To retune, change the constants in one place — `computeVerdict` consumes
them, and `renderBenchmarkScorecardMarkdown` accepts an optional
`gammaTarget` override (used by tests). Update this runbook in the same
PR so the documented contract follows the implementation.

## 9. History Endpoint

`GET /api/presentations/benchmark/history?limit=N&referenceSet=...`

- Auth: requires the `presentation_view` capability (admin / PM /
  super-admin per `presentationAccessPolicyService`).
- Returns `BenchmarkRunRecord[]` ordered by `run_label DESC`.
- `limit` defaults to `12`, capped at `100`.
- `referenceSet` is optional — when provided, history is filtered to
  that reference suite.
- When the migration has not been applied yet, the endpoint responds
  `503 STORAGE_UNAVAILABLE` rather than 500. Schema-missing during
  fetch returns an empty list with `200`.

## 10. Cron Suggestion

The intended cadence is the first day of every month at 09:00 local
time (Europe/Warsaw):

```
0 9 1 * *  cd /srv/consultify && npm run benchmark:monthly -- \
  --organization-id org_dbr77 \
  --run-label "$(date -u +%Y-%m)" \
  --reference-set DBR77+VTS \
  --input /srv/consultify/var/benchmark/scores-$(date -u +%Y-%m).json \
  --report-file /srv/consultify/var/benchmark/report-$(date -u +%Y-%m).json \
  --markdown-file /srv/consultify/var/benchmark/report-$(date -u +%Y-%m).md \
  --reported-by ops@dbr77.com \
  --persist
```

Note: judges still need to drop the prepared `scores-YYYY-MM.json` into
`/srv/consultify/var/benchmark/` before the cron fires. The CLI never
fabricates scores — missing input file is a `2` exit (argument error).

## 11. Failure Modes & Rollback

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Argument error: --run-label must match YYYY-MM` | Wrong label format | Re-run with `--run-label 2026-05`. |
| `Cannot read --input file ...` | Path typo or missing scores file | Re-run with the correct `--input`. |
| `Persist skipped: storage_error (schema_missing)` | Migration `768` not applied | Run `npm run db:migrate:staging` (or production migrate), then re-run with `--persist`. |
| `Run already exists for org=... label=... — skipping insert (duplicate)` | A row already exists for `(org, run_label)` | Inspect the original row, then either delete it manually (audit + rollback ledger) or pick a different label. |
| Verdict flips to `BLOCK` unexpectedly | A dimension dropped below `WARNING_THRESHOLD` | Open a P1 in the presentation backlog and link from the run's `notes` before re-running. |

Rollback for a bad run:
1. Identify the row: `SELECT id, run_label, verdict FROM presentation_benchmark_runs WHERE organization_id = 'org_dbr77' AND run_label = '2026-05';`
2. Archive it (preferred) by exporting the row to the audit ledger
   before deleting (per `00-core-execution.mdc` archive-first rule).
3. Delete the row, fix `scores.json`, then re-run with `--persist`.
   The new row will succeed because the duplicate was archived away.

## 12. Future Work

- **Automated dimension scoring.** Wire a model-judge prompt around the
  existing presentation generator outputs so the JSON input is
  pre-populated; judges only review and override.
- **Trend dashboard (Sprint 15 / Epic H2).** Surface
  `presentation_benchmark_runs` history as a chart inside the
  Operations Health module — link directly from the Governance Card.
- **Per-deck dimension drilldown.** Capture each deck's per-dimension
  score in a sibling table (`presentation_benchmark_run_decks`) so the
  scorecard can attribute regressions to specific decks.
- **CI integration.** Once Antygravity automation generates the scores,
  run `benchmark:monthly` nightly in dry-run mode and fail the
  presentation pipeline when the verdict flips to `BLOCK`.

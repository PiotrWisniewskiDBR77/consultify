# Presentation Export Parity (Epic F1)

Cross-format export parity validates that the same canonical deck renders
consistently across PDF, PPTX, HTML, and PNG exports. The check is the
last quality gate before a deck is shipped to a client and closes Epic F1
of `PRESENTATION_ARTIFACT_ENGINE_SYSTEM_AND_BACKLOG.md`.

## Purpose

Client-facing decks must look the same regardless of which format the
client opens. The parity checker is a deterministic, read-only verifier
that compares the canonical `DeckDocument` against the `presentation_export_records`
table, surfacing any drift before the deck leaves the organization.

It catches the most common cross-format failures we have seen in the wild:

- A page is missing from a PDF after a hot-fix to the renderer.
- The PPTX export forgets to stamp the confidentiality watermark.
- An HTML preview omits the appendix that PDF and PPTX include.
- The PNG export records a failure but is not retried.

The checker never re-runs exports. It reads recorded artifacts and the
source-of-truth `DeckDocument` and computes a verdict in milliseconds —
cheap enough to run on every PR and on every export completion.

## Required vs optional formats

| Format | Required | Missing severity |
| ------ | -------- | ---------------- |
| `pdf`  | yes      | `critical` (FAIL) |
| `pptx` | yes      | `critical` (FAIL) |
| `png`  | no       | `info` (does not block) |
| `html` | no       | `info` (does not block) |

A deck that only ships PDF + PPTX (no HTML/PNG) still passes parity. A
deck that is missing PDF or PPTX fails immediately.

## Severity model

| Severity   | Meaning |
| ---------- | ------- |
| `critical` | Blocks the deck. Operator must fix and re-export before shipping. |
| `warning`  | Cosmetic drift (header/footer text). Deck may ship but should be triaged. |
| `info`     | Informational only (e.g. optional format absent, no required action). |

The checker emits issues with these fields:

- `format` — which export format the issue belongs to
- `field` — `page_count` / `header_text` / `footer_text` / `confidentiality_watermark` / `sections` / `export_status` / `missing_export`
- `expected` / `actual` — the values being compared (always JSON-serializable)
- `reason` — operator-facing remediation hint (mentions format, both values, and the suggested fix)

## Verdict mapping

| Issues observed                  | Verdict              |
| -------------------------------- | -------------------- |
| No issues                        | `PASS`               |
| Only `warning` and/or `info`     | `PASS_WITH_WARNINGS` |
| Any `critical`                   | `FAIL`               |

## API reference

### `GET /api/presentations/decks/:deckId/export-parity`

- **Auth**: required.
- **Capability**: `presentation_view`.
- **Response shape**:

```json
{
  "success": true,
  "data": {
    "deckId": "deck_abc",
    "generatedAt": "2026-05-07T10:30:00.000Z",
    "formatsChecked": ["pdf", "pptx", "html"],
    "formatsMissing": ["png"],
    "issues": [
      {
        "format": "png",
        "field": "missing_export",
        "expected": "completed export record",
        "actual": null,
        "severity": "info",
        "reason": "PNG export is optional and not present. Skip if intentional, otherwise trigger a PNG export."
      }
    ],
    "verdict": "PASS_WITH_WARNINGS",
    "summary": { "total": 1, "critical": 0, "warning": 0, "info": 1 }
  }
}
```

- **Status codes**:
  - `200` — parity report computed (any verdict).
  - `400` — missing `deckId` or organization context.
  - `403` — caller lacks `presentation_view` capability.
  - `404` — deck not found in the caller's organization.
  - `503` — `presentation_export_records` or `presentation_decks` table is unavailable (migration pending or transient DB error). Body includes `code: "STORAGE_UNAVAILABLE"` and a `reason`.

The endpoint is read-only. It does not mutate decks, export records, or
audit logs.

## CLI reference

The CLI runs the same pure-logic core that powers the API. It is the
canonical CI gate:

```bash
npx tsx server/scripts/check-export-parity.ts \
  --deck-ids "deck_a,deck_b,deck_c" \
  --organization-id "org_123" \
  [--report-file ./parity-report.json] \
  [--quiet]
```

Or via npm:

```bash
npm run parity:check -- \
  --deck-ids "deck_a,deck_b,deck_c" \
  --organization-id "org_123"
```

### Arguments

| Flag | Required | Description |
| ---- | -------- | ----------- |
| `--deck-ids`        | yes | Comma-separated list of deck IDs. |
| `--organization-id` | yes | Tenant ID — checker enforces tenancy by org. |
| `--report-file`     | no  | Path to write the aggregate JSON report. Parent directories are created. |
| `--quiet`           | no  | Suppress the stdout summary table; only errors and exit code remain. |

### Exit codes

| Exit | Meaning |
| ---- | ------- |
| `0`  | All decks `PASS` or `PASS_WITH_WARNINGS`. |
| `1`  | At least one deck `FAIL` or `not_found` / `storage_error`. |
| `2`  | Argument parsing or runtime error before checks could run. |

### Sample output

```
Cross-format export parity report
  organization: org_123
  checked_at:   2026-05-07T10:30:00.000Z
  global:       PASS_WITH_WARNINGS
  totals:       checked=3 pass=2 warning=1 fail=0 unknown=0

  deck_id                          verdict                crit  warn  info  reason
  -------------------------------- ---------------------- ----- ----- -----
  deck_a                           PASS                   0     0     0
  deck_b                           PASS_WITH_WARNINGS     0     1     0
  deck_c                           PASS                   0     0     0
```

## CI integration example

```yaml
- name: Cross-format export parity
  run: |
    npm run parity:check -- \
      --deck-ids "${{ inputs.deck_ids }}" \
      --organization-id "${{ secrets.PARITY_ORG_ID }}" \
      --report-file artifacts/parity-report.json
- name: Upload parity report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: parity-report
    path: artifacts/parity-report.json
```

The action fails the workflow on `exit 1` (any deck has critical parity
issues) without requiring extra plumbing.

## Failure-mode triage

### Page count drift (`page_count`, critical)

The export pipeline produced a different number of pages than the
canonical deck has slides. Most often caused by:

- A renderer crash that swallowed the last slide silently.
- A divergent slide-template that splits one canonical slide into two.

**Fix**: Re-export PDF/PPTX. If drift persists, inspect the renderer
logs for `_render_skipped` events.

### Watermark missing (`confidentiality_watermark`, critical)

The deck is classified as `confidential` or `restricted`, but the export
was rendered without the corresponding watermark.

**Fix**: Confirm the deck-level `confidentiality` is correct, then
re-export. Watermarks are mandatory on every slide for confidential and
restricted decks.

### Section missing (`sections`, critical)

A required structural section (cover, dashboard, insight, roadmap, or
appendix) is present in the canonical `DeckDocument` but absent from
the export's recorded section list.

**Fix**: Inspect the renderer logs for skipped slides; re-export.

### Export status failed (`export_status`, critical)

The latest recorded export for that format completed with `failed` or
`blocked` status. The `reason` field surfaces the original error
category from `presentation_export_records.error_category`.

**Fix**: Resolve the underlying error (quality gate, render timeout,
schema migration, etc.) and re-export.

### Header/footer mismatch (`header_text` / `footer_text`, warning)

Cosmetic drift only. The deck may still ship.

**Fix**: Re-export with the canonical header/footer string. Whitespace
differences are normalized away before comparison, so any reported
mismatch is a real text difference.

## Future work

- **Real-time parity checks on export completion.** Hook the parity
  check into the export pipeline so any new export immediately produces
  a parity verdict and emits a `presentation_runtime_event` with the
  result. This will turn parity into a streaming SLO instead of a
  batch CI gate.
- **Parity history dashboard.** Surface `verdict` history per deck in
  the Operations Health view so operators can spot regressions across
  consecutive exports of the same deck.
- **Visual parity sampling.** Extend the checker to compare per-slide
  pixel hashes (PDF-rendered vs PNG) on a low-frequency sampling
  schedule so structural parity is reinforced with visual parity.

# CI Gate: Presentation Governance Card

Status: `ACTIVE`
Owner: QA + Delivery
Script: `server/scripts/check-presentation-governance.ts`

## 1) Purpose

This gate guards release candidates from shipping decks that fail the Presentation Quality Governance Scorecard. It calls the Consultify Presentation API for one or more decks, reads each deck's Governance Card, aggregates verdicts, and exits non-zero when any deck is `BLOCKED_P0`, `BLOCKED_P1`, or unreachable.

It is a hard release gate. Promotion to `staging` / `preprod` / `prod` is not allowed if this script fails.

For verdict semantics, see `PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md`.

## 2) CLI Usage

The script has no extra dependencies. It uses only the Node 18+ standard library (`node:fs`, `node:path`, global `fetch`).

```
npx tsx server/scripts/check-presentation-governance.ts \
  --deck-ids "deck_a,deck_b,deck_c" \
  --api-url "https://demo.consultify.ai/api" \
  --token "$CONSULTIFY_TOKEN" \
  [--allow-inconclusive] \
  [--report-file "out/governance.json"]
```

### Inputs

- `--deck-ids` CSV of deck ids (required) OR `--deck-ids-file` path to JSON file `{ "deckIds": ["..."] }`.
- `--api-url` Presentation API base URL (or env `CONSULTIFY_API_URL`).
- `--token` Bearer token (or env `CONSULTIFY_TOKEN`). Never logged.
- `--allow-inconclusive` Treat `INCONCLUSIVE` as success. Use only on bootstrap envs.
- `--report-file` Path for the JSON report. The report is always built; the file is optional.

### Examples

Single env, two decks, fail on inconclusive:

```
npx tsx server/scripts/check-presentation-governance.ts \
  --deck-ids "deck_demo_a,deck_demo_b" \
  --api-url "https://demo.consultify.ai/api" \
  --token "$CONSULTIFY_TOKEN" \
  --report-file "out/governance.json"
```

Bulk list from JSON, allow inconclusive on a fresh staging:

```
npx tsx server/scripts/check-presentation-governance.ts \
  --deck-ids-file "ci/decks.json" \
  --api-url "$CONSULTIFY_API_URL" \
  --token "$CONSULTIFY_TOKEN" \
  --allow-inconclusive \
  --report-file "out/governance.json"
```

Stdout summary:

```
Presentation Governance Check
- Checked: 3
- Pass: 1
- Blocked: 2 (deck_b: BLOCKED_P1, deck_c: http_404)
- Inconclusive: 0
Exit code: 1
```

## 3) Exit Codes

- `0` All decks passed (`PASS` or `PASS_WITH_P2`, plus `INCONCLUSIVE` when `--allow-inconclusive` is set).
- `1` At least one deck is `BLOCKED_P0`, `BLOCKED_P1`, or unreachable.
- `2` Argument parsing error (missing required arg, malformed deck-id file, etc.).

The last line of stdout is always `Exit code: <N>` for CI log parsing.

## 4) GitHub Actions Example

```yaml
name: presentation-governance
on:
  pull_request:
    branches: [main]

jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install
        run: npm ci
      - name: Presentation governance gate
        env:
          CONSULTIFY_API_URL: ${{ secrets.CONSULTIFY_API_URL }}
          CONSULTIFY_TOKEN: ${{ secrets.CONSULTIFY_TOKEN }}
        run: |
          npx tsx server/scripts/check-presentation-governance.ts \
            --deck-ids "${{ vars.GOVERNANCE_DECK_IDS }}" \
            --report-file "out/governance.json"
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: governance-report
          path: out/governance.json
```

## 5) GitLab CI Example

```yaml
presentation-governance:
  stage: verify
  image: node:20
  script:
    - npm ci
    - npx tsx server/scripts/check-presentation-governance.ts
        --deck-ids "$GOVERNANCE_DECK_IDS"
        --report-file "out/governance.json"
  artifacts:
    when: always
    paths:
      - out/governance.json
  variables:
    CONSULTIFY_API_URL: $CONSULTIFY_API_URL
    CONSULTIFY_TOKEN: $CONSULTIFY_TOKEN
```

## 6) Verdict Semantics

`BLOCKED_P0` and `BLOCKED_P1` use the priority model defined in `PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md`.

- `BLOCKED_P0` Critical content integrity defect: raw internals leaked into a slide, placeholder content shipped to a deck-grade view, encoding artefacts. Must not ship.
- `BLOCKED_P1` Decision-traceability defect: missing `key_message`, missing `source_refs`, evidence below confidence floor, missing freshness signal. Blocks release immediately.
- `PASS_WITH_P2` Allowed to ship only with explicit acknowledgment in release notes.
- `INCONCLUSIVE` Verdict could not be verified with reliable evidence. Treated as failure unless `--allow-inconclusive` is set.

## 7) Failure-mode Triage

| Failure                            | Likely cause                                                                                | Action                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `network_error`                    | API unreachable, DNS, TLS, or runner network policy.                                        | Re-run once. Verify `CONSULTIFY_API_URL`. Inspect runner egress rules. Open infra ticket.    |
| `http_401` / `http_403`            | Missing/expired token, wrong tenant, or capability not granted to CI principal.             | Rotate `CONSULTIFY_TOKEN`. Confirm principal has `presentation_governance:read` capability.  |
| `http_404`                         | Deck id is wrong, deck is archived, or deck belongs to a different tenant.                  | Update the deck-ids list. Do not weaken the gate.                                            |
| `http_5xx`                         | Backend incident on the Presentation API.                                                   | Check `presentation_runtime_events` and the API health dashboard. Treat as P1 if recurrent.  |
| `BLOCKED_P0` / `BLOCKED_P1`        | Real governance failure on the deck.                                                        | Open the deck, resolve `P0/P1` gates, re-run. Never bypass with `--allow-inconclusive`.      |
| `INCONCLUSIVE`                     | Governance evaluator could not produce a reliable verdict (missing evidence, telemetry).    | Investigate. Use `--allow-inconclusive` only on freshly seeded envs, never on `prod` gates.  |

## 8) Security Notes

- The token is read only from `--token` or `CONSULTIFY_TOKEN`.
- The token is never printed, never echoed to logs, and is not included in the JSON report.
- The `apiUrl` is masked in the report to `https://***/<path>` to avoid leaking environment hostnames in shared CI artifacts.
- The script does not write to the database and does not call any mutation endpoint. It is read-only.

## 9) Cross-references

- `PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md` priority model and PASS vocabulary.
- `PRESENTATION_RUNTIME_AND_CONFIDENTIALITY_ROLLOUT_RUNBOOK.md` related runtime checks during deploy.
- `CI_TESTING_RUNBOOK.md` how this gate fits into the broader CI test pipeline.

# Presentation Benchmark LLM Judge

Status: `ACTIVE` (Sprint 16, Epic H1)
Owner: Product + QA + Delivery
Companion: `docs/testing/PRESENTATION_BENCHMARK_SCORECARD.md`,
`docs/operations/PRESENTATION_MONTHLY_BENCHMARK_OPERATIONS.md`

## Purpose

Sprint 15 shipped the H1 monthly benchmark scorecard
(`presentationBenchmarkScorecardService.ts`) — but scoring was fully manual
via a JSON file of `DeckScoreInput[]`. Sprint 16 adds an automated LLM
judge that consumes a deck (via `deckId`) plus the reference rubric,
calls an LLM through the existing `llmService` wrapper, and returns
per-dimension scores with rationale and evidence quotes.

Goals:

- Reduce the manual scoring overhead of the monthly H1 cadence.
- Keep the manual pipeline intact — the judge produces inputs that feed
  the same scorecard service unchanged.
- Provide a calibration surface so we can detect drift over time.

Non-goals (Sprint 16):

- Replacing human review on production-affecting BLOCK decisions.
- Multi-judge ensembles or fine-tuned per-dimension scorers (see
  "Future work" below).

## Rubric

The judge scores each deck against five dimensions, each on a `1.0..5.0`
scale in `0.5` increments. The dimensions mirror the Sprint 15
scorecard exactly so the output can be merged without remapping.

| Dimension                  | What it measures (1 → 5)                                           |
| -------------------------- | ------------------------------------------------------------------ |
| `content_quality`          | Thesis clarity, narrative flow, no placeholders, evidence cited.   |
| `visual_design`            | Hierarchy, spacing, layout consistency, brand fidelity.            |
| `long_context_processing`  | Cross-slide consistency, traceability, no contradictions.          |
| `api_automation`           | Suitability for automated regeneration from the deck JSON.         |
| `conversational_editing`   | Stable section boundaries, addressable IDs, clear delta hooks.     |

Default rubric: `DEFAULT_RUBRICS` in
`server/src/services/presentationBenchmarkJudgeService.ts`. CLI accepts
a `--rubric-file` override (JSON array of `JudgeRubric`).

## Pipeline

1. **Deck fetch** — `presentation_decks` row by `id` + `organization_id`,
   tolerant of missing schema.
2. **Slide flatten** — `unified_json.slides` → `deck_json.slides` →
   `outline_json.sections` (best available).
3. **Prompt build** — `buildJudgeSystemPrompt()` plus
   `buildJudgeUserPrompt({ deck, rubrics })`. Bullets capped at 5 per
   slide; slide list capped at 60; per-bullet character cap for cost
   safety.
4. **LLM call** — via the injected `LlmJudgeAdapter`. Real adapter wraps
   `llmService.call(...)` (Vercel AI SDK + circuit breaker stack).
5. **Strict parse** — `parseJudgeResponse(rawText, rubrics)`. JSON only,
   handles ```` ```json ```` fences, validates `score ∈ [1, 5]` in
   `0.5` increments, requires every dimension and a non-empty rationale.
6. **Aggregate** — `aggregateScores(scores)` returns the per-dimension
   numbers in the shape consumed by the Sprint 15 scorecard.
7. **Map to scorecard input** — `judgeResultToDeckScoreInput(result, ...)`
   produces the `DeckScoreInput` row used by
   `computeBenchmarkScorecard`.

## Adapter model

The judge service is decoupled from any concrete LLM client via the
`LlmJudgeAdapter` interface:

```ts
export interface LlmJudgeAdapter {
  judge(input: { systemPrompt: string; userPrompt: string; expectsJson: true }):
    Promise<{
      status: 'ok' | 'rate_limited' | 'timeout' | 'unavailable';
      rawText?: string;
      modelId?: string;
      reason?: string;
    }>;
}
```

Three adapters ship with this sprint:

- **`noopLlmAdapter`** — always returns `unavailable`. Lets the service
  be imported and exercised in environments without LLM keys.
- **`mockLlmAdapter(predefined)`** — returns a predefined JSON response
  for tests; keeps the test suite offline and deterministic.
- **Real adapter** (constructed in
  `server/scripts/run-benchmark-judge.ts` and
  `server/scripts/run-monthly-benchmark.ts`) — thin wrapper around
  `llmService.call(...)` that translates rate-limit / timeout / quota
  errors into the typed status enum.

CRITICAL invariants:

- The service **never throws**. All errors flow through the typed
  `JudgeResult.status` field.
- LLM responses are validated **strictly** — half-parsed JSON, missing
  dimensions, or out-of-range scores all degrade to `invalid_response`
  (no silent fabrication).
- The service is **offline-testable** via `mockLlmAdapter`.

## CLI reference

```bash
npx tsx server/scripts/run-benchmark-judge.ts \
  --deck-ids deck_a,deck_b \
  --organization-id org_123 \
  --output-file ./judge-scores.json \
  [--rubric-file ./custom-rubric.json] \
  [--quiet]
```

Or via the npm shortcut:

```bash
npm run benchmark:judge -- \
  --deck-ids deck_a,deck_b \
  --organization-id org_123 \
  --output-file ./judge-scores.json
```

Args:

- `--deck-ids` (required) — comma-separated list of deck IDs.
- `--organization-id` (required) — tenant scope for the deck fetch.
- `--output-file` (required) — writes `DeckScoreInput[]` suitable for
  `--input` of `run-monthly-benchmark.ts`.
- `--rubric-file` (optional) — JSON array of `JudgeRubric` overriding
  `DEFAULT_RUBRICS`.
- `--quiet` (optional) — suppress non-error stdout.

Exit codes:

- `0` — every requested deck was scored successfully.
- `1` — one or more decks reported `unavailable` / `rate_limited` /
  `invalid_response` / `not_found`.
- `2` — argument or runtime error.

Adapter selection:

1. If at least one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
   `GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, or `OPENROUTER_API_KEY` is
   set AND `llmService` is importable, the real adapter is used.
2. Otherwise the script falls back to `noopLlmAdapter` and warns.
   No keys → graceful `unavailable`, **never a crash**.

The judge model tier defaults to `'standard'` and can be overridden via
the `BENCHMARK_JUDGE_MODEL_TIER` environment variable
(`fast` | `standard` | `premium` | `reasoning`).

## Integration with `run-monthly-benchmark`

`run-monthly-benchmark.ts` gained a `--judge` flag that takes a
comma-separated list of deck IDs:

```bash
npx tsx server/scripts/run-monthly-benchmark.ts \
  --organization-id org_123 \
  --run-label 2026-05 \
  --judge deck_a,deck_b \
  --report-file ./monthly-2026-05.json \
  --markdown-file ./monthly-2026-05.md \
  --persist
```

When `--judge` is set:

- The judge service is called for each deck.
- The resulting `DeckScoreInput[]` becomes the input for
  `computeBenchmarkScorecard` (the `--input` flag is no longer
  required).
- A side-channel audit file `<report-file>.judge.json` is written with
  the full per-dimension rationale + evidence per deck so reviewers can
  inspect what the LLM saw and why.
- `--persist` still works — the persisted scorecard is identical in
  shape to a manual run; only the source-of-truth metadata in the
  audit file distinguishes the two.

CRITICAL: when `--judge` is set without an LLM adapter, the script
exits gracefully with `EXIT_BLOCK` and writes the judge audit
side-channel — it does **not** crash and does **not** persist a
misleading empty-deck-list scorecard.

## Failure modes

| Status              | Meaning                                            | Recommended action                                    |
| ------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| `ok`                | Scores parsed and validated.                       | Use as input to scorecard; spot-check evidence.       |
| `unavailable`       | No adapter / no keys / empty model response.       | Configure provider keys; rerun.                       |
| `rate_limited`      | Provider rate-limit / quota error.                 | Wait or rotate keys; sequential CLI is rate-safe.     |
| `timeout`           | Wall-clock exceeded (default 60s).                 | Reduce slide count or bump `BENCHMARK_JUDGE_MODEL_TIER`. |
| `invalid_response`  | LLM returned non-JSON or violated rubric.          | Inspect raw text in audit file; tighten system prompt. |

## Calibration

To detect drift:

- Maintain a **golden human-scored reference deck** per organization.
- Run `npm run benchmark:judge -- --deck-ids <golden> ...` monthly.
- Diff the judge aggregate vs the human aggregate per dimension; alert
  if any dimension drifts by `>= 0.5` for two consecutive months.
- Track delta in the same `presentation_benchmark_runs` history (using
  a distinct `reference_set` like `judge-calibration`).

## Cost considerations

- Per-deck token estimate (default rubric, 60-slide cap, 5 bullets per
  slide): roughly 1.5k–2.5k input tokens, ~600 output tokens.
- The CLI calls decks **sequentially** — this is intentional for rate-
  limit safety. For larger pools, batch by date or by reference set
  rather than parallelizing, until provider quotas justify it.
- `cache: false` is passed to `llmService` to avoid stale judgements
  bleeding into a new monthly cadence.
- Bullets are truncated server-side before the prompt is built, so
  very long decks degrade gracefully instead of blowing up the prompt.

## Future work

- **Multi-judge ensembles** — run two providers in parallel and surface
  disagreement as a confidence signal.
- **Fine-tuned dimension scorers** — replace the generalist judge with
  per-dimension models trained on historical human scores.
- **Calibration-aware confidence** — adjust the `confidence` field
  using the rolling judge-vs-human delta on the calibration deck.
- **Webhook trigger** — auto-run the judge on every deck publish and
  keep a rolling "last-30 deck" benchmark, separate from the monthly
  cadence.

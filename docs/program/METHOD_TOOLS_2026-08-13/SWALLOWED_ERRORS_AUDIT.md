# Swallowed-errors audit — Tools surface (STREAM G2)

Date: 2026-08-13. Scope per assignment: `server/src/controllers/ToolController.ts`,
`server/src/services/tools/**`, `server/src/services/ToolInitiativeService.ts`,
`server/src/services/toolOutput*`, `server/src/routes/tool*`, `src/toolOutputs/**`.

Method: for each file in scope, ran

```
rg -n "catch\s*\{\s*\}"
rg -n "catch.*\{[^}]*\}" -U
rg -n "// *(table|column).*may not exist" -i
rg -n "catch\s*\([^)]*\)\s*\{\s*(//|/\*)?[^}]*\}" -U
rg -n "\.catch\("
```

then read every hit with surrounding context to classify it. `server/src/services/tools/swotCandidateHandoffService.ts`,
all four `server/src/routes/tool*.ts` files, and all of `src/toolOutputs/**` had
**zero** `catch` blocks at all (confirmed with a plain `catch` grep, not just
the structured patterns above) — they are not in the findings table below.

## The confirmed defect (Task 1)

`ToolController.ts`, `promoteToOutput`'s `outputType === 'idea'` branch:
`INSERT INTO my_ideas (...)` was wrapped in `catch { /* Table may not exist */ }`
— the sibling of the `presentation` branch's defect fixed in `bc9b8ae0cd`. Unlike
presentation, `my_ideas` was never the *wrong* table (it's migration-owned by
`755_my_ideas_00base.sql` / `20260220_my_work_my_ideas.sql`, confirmed against
this worktree's live schema — every column the INSERT used exists), but the
blanket `catch` still meant **any** failure — a constraint violation, a
connection blip, a future column rename — was silently swallowed and the
endpoint kept returning 200 with an `id` pointing at nothing in `my_ideas`.
Fixed in `server/src/controllers/ToolController.ts` (see that diff + the new
`tests/integration/tools-idea-persistence.realdb.test.ts`). Full writeup in
this stream's final report; not repeated here.

## Sweep findings table

Verdict legend: **(a)** legitimately optional (best-effort telemetry/audit) —
kept, comment + log added if it was silent before. **(b)** a required write
that could silently fail — fixed so the caller learns. **(c)** already correct
(not a defect) — no change.

| # | File:line | What it guards | Verdict | Action taken |
|---|---|---|---|---|
| 1 | `ToolController.ts` `promoteToOutput` (`outputType === 'idea'`), was ~L2762 | `INSERT INTO my_ideas` | **(b)** | **THE TASK 1 FIX.** Catch removed entirely — failure now propagates through `asyncHandler` to the error handler (same "no catch" shape as the `initiative` branch's plain `INSERT INTO initiatives`, which never had one). Lineage added via `source_pack_json`. |
| 2 | `ToolController.ts` `respondDeduplicated`, `outputType === 'idea'` block (new) | Retry-after-failure reporting fake dedup success | **(b)** | **Added** (didn't exist before): checks `my_ideas` row exists before reporting `deduplicated: true`, mirroring the `presentation` branch's `existingDeck` check. Wrapped in `waitForRow` (new helper) to tolerate the legitimate race where a concurrent winner's ledger claim has landed but its `my_ideas` INSERT hasn't committed yet — a real race surfaced by `tests/integration/tools-promotion-race.realdb.test.ts`'s 25-way concurrent `idea` promotion once this check was added. |
| 3 | `ToolController.ts:113-120,134-142,152-159` | `safeParseJSON`/`safeJsonParse`/`safeJsonParseAny` — generic JSON.parse fallbacks | **(c)** | No change. Fallback to a typed default on malformed JSON; not a write, not data loss — the field just renders empty/default. |
| 4 | `ToolController.ts:194-203` (`getRuntimeGateBlockers`) | Runtime-contract JSON parse | **(c)** | No change. On parse failure returns `['invalid runtime contract']` — that string becomes a promotion **blocker**, i.e. it fails the request closed, not open. Correct shape already. |
| 5 | `ToolController.ts:240-251` (`getDecisionColumns`) | `getTableColumns('decisions')` introspection | **(c)** | No change. Falls back to a known-good hardcoded default column set; this is a read-path capability probe, not a write. |
| 6 | `ToolController.ts:365-390` (`logAudit`) | `INSERT INTO audit_log` | **(a)** | **Fixed**: was a bare `catch {}` with zero logging. Kept non-blocking (audit trail is supplementary to every promotion/approval call) but added `logger.warn` with the action/resourceId/error so a genuinely broken audit table is now observable. |
| 7 | `ToolController.ts:392-...` (`ensureToolsSchema`), ~10 inner `ALTER TABLE`/`CREATE INDEX`/`INSERT` catches | Self-managed-DB bootstrap DDL (dev/test only; `DB_MANAGED_SCHEMA=on` in demo/prod skips this whole function) | **(c)** | No change to the ~10 inner catches — each guards an expected, benign race ("another concurrent request already added this column/index") and each already has a specific comment explaining why; the managed migration set is authoritative wherever it matters. Re-litigating each one individually was out of proportion to the risk (dev-only, idempotent IF NOT EXISTS / ON CONFLICT everywhere). |
| 8 | `ToolController.ts` outer catch of `ensureToolsSchema`, was L625-627 | Whole-function fallback | **(a)** | **Fixed**: was `catch { // no-op: schema might be managed elsewhere }` with zero logging — hid a genuinely broken self-managed bootstrap from operators on dev/self-managed DBs (their only signal). Added `logger.warn`; still never rethrown. |
| 9 | `ToolController.ts:1096-1101` (`suggestTool`) | Tool-picker suggestion errors | **(c)** | No change. Already correct: explicit "Fail-open" comment + `logger.warn` with the error. Picker UI falls back to manual selection — genuinely optional. |
| 10 | `ToolController.ts:1666-1679` | `approvedSnapshot` JSON build (audit/export snapshot) | **(c)** | No change. Falls back to a minimal `{toolSessionId, approvedAt}` snapshot on failure; the approval itself (the `UPDATE tool_sessions SET status='APPROVED'...`) still happens unconditionally right after. |
| 11 | `ToolController.ts:1920-2006` (similarity-check + AI generation) | Duplicate-initiative similarity check; AI generation failure | **(c)** | No change. Both already log (`logger.warn`/`logger.error`) and the generation failure path persists `failure_reason` on the session (surfaced via `getToolSession`) rather than swallowing — this is the correct "fail visibly, don't fail the whole request" shape. |
| 12 | `ToolController.ts:2090,2154` (`res.status(422)...`) | Invalid stored runtime contract | **(c)** | No change. Not a swallow — it's a proper explicit error response to the caller. |
| 13 | `ToolController.ts` ledger unique-violation handling (report/idea/presentation branches, ~L2447+ and ~L2921+) | `insertLedgerRow` races | **(c)** | No change. Intentional, well-tested idempotency logic (the whole point of `uq_tool_initiative_links_promotion`), covered by `tools-promotion-race.realdb.test.ts`. |
| 14 | `ToolController.ts` funnel-enabled `initiative` branch, `UPDATE initiatives SET priority_order` (~L2521-2529 pre-fix) | Extra display-sort column, post-create | **(a)** | **Fixed**: was silent. `priority_order` is a non-critical sort hint — the initiative itself is already created by `funnelCreateInitiative` before this UPDATE runs, so this must stay non-blocking. Added `logger.warn`. |
| 15 | `ToolController.ts` presentation branch's compensating `DELETE FROM presentation_cards`/`presentation_decks` (`.catch(() => undefined)`, ~L2788-2796) | Rollback-after-failure cleanup | **(c)** | No change. Correct existing pattern from the presentation fix: the ORIGINAL error is always rethrown (`throw err` right after); these two `.catch(() => undefined)` only protect the cleanup attempt itself from masking that original error. Best-effort compensation, not the primary failure path. |
| 16 | `ToolController.ts:3203-3219` (activity-history JSON parse) | `audit_log.details` display field | **(c)** | No change. Read-path display fallback (`payload = undefined`), not a write. |
| 17 | `ToolController.ts:3225-3250` (`handoffSwotCandidate`) | `handoffSwotRecommendation` errors | **(c)** | No change. Already correct: catches only to translate a known `SwotCandidateHandoffError` into its declared HTTP status; every other error is rethrown (`throw error`). |
| 18 | `ToolController.ts:3304-3420,3713-3794` (SWOT proposal audit-event logging, 4 sites) | `auditEventsService` calls around SWOT proposal lifecycle | **(c)** | No change. Already correct: each already has `logger.warn('...failed audit event', {auditErr})`. |
| 19 | `ToolController.ts:3531-3552,3610-3615` (SWOT proposal accept transaction) | JSON.parse of `proposed_after_json`/`answers_json` inside a Postgres transaction | **(c)** | No change. Fallback to `{}`/safe defaults inside a real transaction that otherwise does atomic conditional UPDATEs + CAS version checks with explicit `throw` on staleness; not a required-write swallow. |
| 20 | `toolOutputSnapshotService.ts:84-91` (`safeParseJSON`-equivalent) | Generic JSON parse fallback | **(c)** | No change. Same shape as ToolController's parsers. |
| 21 | `toolOutputSnapshotService.ts:332-380` (`ensureToolOutputSnapshot`) | `SELECT`/persist against `tool_outputs`, guarded by `isMissingTableError(err)` | **(c)** | No change — and notably **not** a blanket catch already: it rethrows anything that is *not* specifically a missing-table error, and only degrades to an in-memory, unpersisted snapshot on the one harness (`tool-session-roundtrip.contract.test.ts`'s in-memory SQLite) that is documented to never have the table. Real environments (prod/demo/every `RUN_DB_TESTS=1` suite) always have `tool_outputs`. This is the pattern the removed `idea`/old-`presentation` catches *should* have used instead of a blanket `catch {}`. |
| 22 | `toolOutputSnapshotService.ts:363-368` (`hasRawPgTransaction` probe) | Feature-detecting `queryHelpers.withRawPgTransaction` | **(c)** | No change. Property-access probe on a possibly-partially-mocked module (documented reason: `vi.mock` factories that don't return every export throw on access rather than yielding `undefined`); not a data write. |
| 23 | `ToolInitiativeService.ts:31-43` (`parseJsonPayload`) | AI-generated JSON payload parse | **(c)** | No change. Returns `null` on malformed AI output; caller (`generateInitiatives`, L212-246) retries once more and then falls back to `fallbackInitiatives(...)` — a deliberate degraded-but-safe default, not silent data loss, and the retry loop's own catch already logs via `logger.warn`. |
| 24 | `ToolInitiativeService.ts:45-64` (`withTimeout`) | AI call timeout race | **(c)** | No change. `.catch((error) => { clearTimeout(timer); reject(error); })` rethrows via `reject` — not a swallow, a timeout-race helper. |
| 25 | `ToolInitiativeService.ts` funnel-enabled path, `UPDATE initiatives SET priority_order` (~L285-292 pre-fix) | Same extra display-sort column as finding #14, different call site (`persistInitiatives`, the bulk tool→initiatives generator) | **(a)** | **Fixed**: same rationale and same fix as #14 — added `logger.warn`. |
| 26 | `ToolInitiativeService.ts` `persistInitiatives`, `INSERT INTO audit_log` (~L349-366 pre-fix) | Bulk-initiative-generation audit trail | **(a)** | **Fixed**: same rationale and fix as #6 (`logAudit`) — added `logger.warn`. |

## Summary

- **1 required-write defect fixed** (idea persistence — Task 1), plus its
  companion dedup-race check (#2), which itself needed a bounded-retry fix
  (`waitForRow`) once added, to avoid a false-negative regression against
  `tools-promotion-race.realdb.test.ts`'s existing 25-way concurrency proof.
- **4 legitimately-optional writes were silent and now log** (#6, #8, #14,
  #25, #26 — audit-log inserts and the `priority_order` display-sort
  backfill, in both `ToolController.ts` and its sibling
  `ToolInitiativeService.ts`). None of these change response behavior; they
  only add `logger.warn` so a real, ongoing failure is no longer invisible.
- **Everything else in scope was already correct** — either not a write at
  all (JSON-parse fallbacks, read-path introspection, display fields), or
  already fails closed / already logs / already narrowly type-checks the
  specific condition it tolerates (`isMissingTableError`) instead of
  swallowing everything.
- `swotCandidateHandoffService.ts`, all `server/src/routes/tool*.ts` files,
  and all of `src/toolOutputs/**` contain no `catch` blocks at all.

## Not fixed / flagged out of scope

- **`ensureToolsSchema`'s ~10 inner DDL catches** (#7): each is a narrow,
  well-commented, genuinely benign race guard on a dev-only fallback path.
  Left as-is; only the function's outer catch got a log line.
- **Presentation branch's identical dedup-race window**: `respondDeduplicated`'s
  `outputType === 'presentation'` `existingDeck` check (added by `bc9b8ae0cd`)
  has the exact same theoretical race as the `idea` check did before
  `waitForRow` — a concurrent winner's ledger claim can land before its
  `presentation_decks` INSERT commits. `tools-promotion-race.realdb.test.ts`
  does not exercise `presentation` at 25-way concurrency (only `idea` and,
  at low concurrency, a couple of other cases — see that file's own header
  on why `idea`/`presentation` were chosen over `initiative`), so it has
  never been observed failing. Out of this stream's scope (owned by the
  presentation fix's stream) — flagging here rather than silently patching:
  the same `waitForRow` helper (now in `ToolController.ts`) would close it
  if/when someone writes that test.

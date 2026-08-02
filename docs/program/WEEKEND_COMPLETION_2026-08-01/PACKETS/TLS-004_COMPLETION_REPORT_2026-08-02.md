---
doc_id: TLS-004_COMPLETION_REPORT_2026-08-02
truth_type: operations
status: AWAITING_CODEX_REVIEW
owner: claude
product_owner: piotr
priority: P0
depends_on: TLS-001, TLS-002, TLS-003
last_reviewed: 2026-08-02
---

# TLS-04 — Teresa-assisted SWOT: completion report (post Codex fix packet)

## Status

`AWAITING_CODEX_REVIEW`. This is the SECOND review round: the first (HEAD
`927f11727cb0db11da392d384d9e294ef7ad1026`) was marked `ACTIVE_FIX` with 5
blockers. This report covers the fix packet closing all 5.

## Branch / base / HEAD / worktree

- Branch: `feat/tls-004-teresa-assisted-swot`
- Base: `0ab035a5723e0623f35c6838100c86135aabe8fb` (TLS-01/02/03, frozen)
- HEAD reviewed by Codex (round 1): `927f11727cb0db11da392d384d9e294ef7ad1026`
- Worktree: `.../scratchpad/wt-tls-004`
- No push / merge / deploy / Railway / demo touched. TLS-01/02/03/05/06 not
  reopened.

## Commits (round 1 + fix packet)

Round 1 (already reviewed): `483a52554f` (backend), `1482b422b7`
(frontend), `e831511fb7` (tests), `927f11727c` (edit-before-accept bug fix
found in round-1's own adversarial review).

Fix packet (this round), on top of `927f11727c`:
1. `fix(tls-004): BLOCKER 1 -- version bump on every answers_json write` --
   `ToolController.ts`'s `updateToolSession`.
2. `fix(tls-004): BLOCKER 2 -- CAS source of truth is the proposal's own
   expected_version, never client body` -- `ToolController.ts`'s
   `acceptSwotProposal`.
3. `fix(tls-004): BLOCKER 3 -- editedAfter is strict text-only` --
   `tool.validators.ts`, `ToolController.ts`, `TeresaSwotProposals.tsx`,
   `api.ts`.
4. `fix(tls-004): BLOCKER 4 -- semantic validation + honest provenance` --
   `swotProposalService.ts`, `ToolController.ts`.
5. `test(tls-004): fix-packet negative controls + standing writer inventory`
   -- new/extended test files (see Tests section).
6. `docs(tls-004): completion report` -- this file.

## Canonical owners (unchanged from round 1)

Backend: `ToolController`/`tool_sessions` family, extended with
`swot_proposals` (new table, `server/migrations/20260802_swot_proposals.sql`).
No new AI subsystem, no second SWOT store/router -- everything lives inside
the existing canonical controller and table family. Provider boundary:
`server/src/services/ai/swotProposalService.ts`, mirroring the existing
`canvasGraphLlm.ts` pattern (`llm.call({type:'structured', schema, ...})`).
Frontend: `src/components/DiscoveryTools/tools/DynamicSWOT/
TeresaSwotProposals.tsx`, mounted into the existing `SWOTBuildPhase.tsx`.

## BLOCKER 1 -- writer inventory + fix

**Full inventory performed**: every `UPDATE tool_sessions` statement in
`server/src` was located and classified (`ToolController.ts` lines 1236,
1352, 1453, 1542, 1776, 1803, 1867, 1944, 2259, plus the new
`acceptSwotProposal` write). Only ONE production writer touches
`answers_json`: `updateToolSession`'s dynamically-built `SET` clause
(`setClauses.push('answers_json = ?')` when the caller sends `answers`).
Every other `UPDATE tool_sessions` statement in this codebase touches
unrelated fields only (`status`, `context_snapshot`, `dod_status`,
`runtime_contract_json`, `failure_reason`, `last_generation_batch_id`) and
correctly does NOT bump `version` (per the explicit instruction not to bump
on unrelated-field writes). All `INSERT INTO tool_sessions` sites
(`createToolSession`, `InterviewController.ts`, `my-work.routes.ts`,
`v8/interview.routes.ts`, `notebookConversionService.ts`,
`demoSeedService.ts`) are fresh-row creates where `version` correctly
defaults to 1 via the migration's `DEFAULT 1` -- no bump needed there.

**Fix**: `updateToolSession`'s `if (answers !== undefined) { ... }` branch
now also pushes `version = version + 1` onto the same atomic `UPDATE`
statement -- scoped ONLY to writes that actually change `answers_json`, so a
`wizardState`-only or `status`-only save still does not move `version`.

**Standing regression guard**: new
`tests/unit/backend/toolSessionsAnswersVersionInventory.test.ts` --
static-analysis test (not a runtime/DB test) that scans the WHOLE
`server/src` tree for every place SQL sets `answers_json` on
`tool_sessions` and asserts a `version = version + 1` bump exists in the
SAME enclosing method. Deliberately not scoped to `ToolController.ts` --
catches a hypothetical future writer added anywhere. Verified genuinely
load-bearing: an earlier, naive version of this test (single-literal-SQL-
statement matching only) stayed GREEN even after physically deleting the
version-bump `push()` line, because this codebase's real writer builds its
`SET` clause from separately-pushed string fragments joined at runtime --
the literal SQL template text never contains the substring `answers_json`
at all. Fixed to a method-boundary-scoped proximity search; re-verified
RED (correctly, by line number) with the bump removed, GREEN restored.

**Required real-PG flow, built and green**:
`generate proposal at V -> real PUT/autosave changes SWOT -> session V+1 ->
accept the OLD proposal -> 409 STALE_VERSION -> proposal stays pending ->
manual edit survives, never overwritten by the stale AI text` -- new test
in `tls04-swot-proposal-lifecycle.e2e.test.ts` (`BLOCKER 1` describe
block), using a REAL `PUT /api/tools/:toolId` (not raw SQL) to prove the
fix end to end through the actual production write path.

## BLOCKER 2 -- CAS source of truth fix

`acceptSwotProposal`'s optimistic-concurrency check now ALWAYS uses
`swot_proposals.expected_version` (the value recorded on the proposal row
at generation time, re-read from the same atomic accept-flip `UPDATE ...
RETURNING *`) as the CAS anchor against `tool_sessions.version` -- never
the client-supplied `expectedVersion`. The request body's `expectedVersion`
is now optional and used ONLY as a client-side assertion: if provided and
it does not match the proposal's own `expected_version`, this is treated
identically to a real stale-version conflict (same `STALE_VERSION` code,
same rollback), not a distinct error class a client could learn to route
around. The 409 response now returns both `currentVersion` (live session
version) and `proposalVersion` (what the proposal was actually generated
against).

**Negative control (malicious bypass)**: proposal generated at V, session
manually bumped to V+1 via a real PUT, caller sends
`expectedVersion: V+1` (the CURRENT live version, attempting to make a
stale proposal look fresh) -- still `409 STALE_VERSION`, zero changes to
proposal or session. Plus two positive controls: an honest matching
assertion still succeeds; omitting `expectedVersion` entirely still uses
the proposal's own recorded version correctly.

## BLOCKER 3 -- editedAfter immutability fix

`AcceptSwotProposalSchema.editedAfter` is now `z.object({ text:
z.string().trim().min(1).max(2000) }).strict()` -- any other key
(`id`/`quadrant`/`source`/`confidence`/`proposalStatus`/`constructor`/
anything else) is rejected with 400 at the validation layer, before the
request reaches the controller. Defense-in-depth in the controller itself:
the merge onto `proposed_after_json` now explicitly reads only
`editedAfter.text` and reconstructs the final item from the proposal's own
stored fields -- never a generic object spread of caller input -- so even
a hypothetical future schema relaxation could not silently reopen
arbitrary-field injection. The shipped frontend (`TeresaSwotProposals.tsx`)
was updated to match: it now sends `{ text: draft }` only (a prior,
now-reverted fix attempt had it spreading the full proposed item into
`editedAfter`, which the new strict schema would reject).

**Negative controls, all green**: `quadrant`, `id`, `source`, `confidence`,
`proposalStatus`, `constructor` keys each independently tested -> 400,
proposal stays `pending`, session `version` unchanged. `__proto__` is
covered by a dedicated test verifying the actual security property (no
`Object.prototype` pollution, no leaked field in the persisted item) rather
than a specific HTTP status -- a genuine own `"__proto__"` property (as
produced by `JSON.parse` per the ECMAScript spec) round-trips through
Express's JSON body parser intact but was found, empirically, not to be
treated by this stack as an "extra key" the same way ordinary named keys
are; regardless of the exact status code, the controller's explicit
`editedAfter.text`-only extraction makes the key inert either way --
verified directly (no pollution, no leak).

## BLOCKER 4 -- semantic validation + provenance honesty

`swotProposalService.ts` now performs SEMANTIC validation on top of the
existing zod shape validation, using the same `currentItems` context the
model was given: for `operation !== 'add'`, `targetItemId` must exist in
the current SWOT AND its recorded quadrant must match the proposal's
claimed `quadrant`; for `isAssumption === false`, every `sourceRefs` entry
must match a real item id from the input SWOT (an "identifiable element",
per the requirement) -- a fabricated/hallucinated reference fails
validation. Any semantic failure is treated exactly like a schema-parse
failure (one retry, then `INVALID_MODEL_RESPONSE`, zero rows persisted --
never silently accepted).

**Provenance honesty**: `llmService.callStructured`'s structured-output
path (`server/src/services/ai/llmService.ts`) returns only `{ object,
usage }` -- it does NOT surface which provider/model actually served the
request, confirmed by reading the function in full. Widening that shared,
heavily-used file's return contract (used by `canvasGraphLlm.ts` and other
unrelated callers) was deliberately NOT done under this fix packet's time
budget, to avoid ripple risk to features outside TLS-04's scope. Instead,
`model_metadata_json` now honestly records only what is actually known
from the CALLER's side: `{ provider: 'unknown', model: 'unknown',
requestedPolicy: 'premium' }` -- never asserting `anthropic` (or any
specific provider) without having observed it. Flagged as an open
follow-up below.

**Negative controls, all green**: nonexistent `targetItemId` -> 502
`INVALID_MODEL_RESPONSE`, zero rows; real item claimed under the wrong
quadrant -> same; fabricated `sourceRef` on a non-assumption proposal ->
same; a genuine `isAssumption:true` proposal (no sourceRefs needed)
succeeds and its `modelMetadata` is asserted to never contain the string
`anthropic`.

## Changed files (fix packet, cumulative with round 1)

```
server/migrations/20260802_swot_proposals.sql        (round 1, unchanged)
server/src/controllers/ToolController.ts              (round 1 + all 4 blockers)
server/src/database/PostgresDatabase.ts                (round 1, unchanged)
server/src/routes/tools.routes.ts                      (round 1, unchanged)
server/src/services/ai/swotProposalService.ts          (round 1 + BLOCKER 4)
server/src/utils/queryHelpers.ts                        (round 1, unchanged)
server/src/validators/tool.validators.ts                (round 1 + BLOCKER 2/3)
src/components/DiscoveryTools/tools/DynamicSWOT/SWOTBuildPhase.tsx (round 1, unchanged)
src/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals.tsx (round 1 + BLOCKER 3)
src/services/api.ts                                     (round 1 + BLOCKER 2/3 types)
tests/acceptance/tls04-swot-proposal-lifecycle.e2e.test.ts (round 1 + fix-packet cases)
tests/components/discovery-tools/TeresaSwotProposals.test.tsx (round 1, unchanged)
tests/unit/backend/toolSessionsAnswersVersionInventory.test.ts (NEW, this packet)
docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/TLS-004_COMPLETION_REPORT_2026-08-02.md (NEW)
```

## Tests and negative controls (this fix packet's additions)

Real-Postgres (`tests/acceptance/tls04-swot-proposal-lifecycle.e2e.test.ts`,
LLM mocked ONLY at `llmService.js`'s `llmService.call`, everything else
real): 29 cases (up from 12 in round 1), independently re-run by the
orchestrating session against the real acceptance Postgres, not just
trusted:
- BLOCKER 1: real PUT/autosave bumps version -> stale accept rejected ->
  manual edit survives (1 case).
- BLOCKER 2: malicious currentVersion bypass rejected; honest assertion
  succeeds; omitted assertion still uses the proposal's own version
  (3 cases).
- BLOCKER 3: 6 forbidden-key rejections (quadrant/id/source/confidence/
  proposalStatus/constructor) + 1 dedicated `__proto__` no-pollution proof
  + 1 valid text-only-edit positive control (8 cases).
- BLOCKER 4: nonexistent targetItemId, wrong-quadrant target, fabricated
  sourceRef, honest-assumption-with-no-provider-leak (4 cases).
Plus the round-1 suite's original 12 cases (re-verified, 2 hardcoded
`expectedVersion` assertions updated from 1 -> 2 to reflect that
`createSwotSession`'s own seed PUT now legitimately bumps version under
the BLOCKER 1 fix), and the pre-existing `addProposal()` fixture's default
`sourceRefs` updated from a non-existent `'s1'` to the real seeded id
`'strengths-1'` (would otherwise now fail BLOCKER 4's own semantic
validation).

Re-run alongside `h31-swot-flow.e2e.test.ts` in the same invocation: 30/30
passed, no fixture-prefix collision, no regression.

Standing static-analysis guard:
`tests/unit/backend/toolSessionsAnswersVersionInventory.test.ts` (1 case,
described above under BLOCKER 1).

Component (`tests/components/discovery-tools/TeresaSwotProposals.test.tsx`):
9/9, unchanged from round 1, re-verified green against the fix-packet
frontend changes.

Regression: `ToolDocumentView.golden-flow.test.tsx` (TLS-02/03, frozen)
still 3/3 green.

All of the above independently re-run by the orchestrating session, not
only trusted from a subagent's report.

## Audit / provenance

Every proposal state transition (generate success, generate failure,
accept, reject) writes to `auditEventsService` with `actorType: 'AI'` for
generation and `actorType: 'USER'` for the human decision, each wrapped so
a logging failure never blocks or masks an already-committed response.
`model_metadata_json` is now honest per BLOCKER 4 above.

## Security findings (this round)

1. **(Fixed, was the round-1 blocking finding)** edit-before-accept data
   corruption -- already fixed and regression-tested before this round
   began.
2. **(Fixed, BLOCKER 2)** client-controlled CAS bypass via a forged
   `expectedVersion`.
3. **(Fixed, BLOCKER 3)** unrestricted `editedAfter` allowing
   provenance-field overwrite / prototype-pollution-shaped payloads.
4. **(Fixed, BLOCKER 4)** unvalidated semantic claims (hallucinated
   target, wrong-quadrant target, fabricated source) and dishonest
   provider attribution.
5. **(Fixed, BLOCKER 1)** version guard blind to ordinary SWOT writes,
   allowing a stale proposal to clobber a newer manual edit.

## Unresolved risks (disclosed, not blockers)

- `llmService.callStructured`'s structured-output path does not surface
  real provider/model identity to callers. `model_metadata_json` is
  therefore honestly generic (`provider: 'unknown'`) rather than precise.
  Widening `llmService.ts`'s shared return contract to include this was
  deliberately deferred (real ripple risk to `canvasGraphLlm.ts` and other
  unrelated callers under this packet's time budget) -- a real follow-up
  if per-proposal provider attribution becomes a product requirement.
- Accepting a proposal updates the proposal card in place but does not yet
  auto-refresh the live SWOT quadrant grid in the UI (documented in round
  1, unchanged by this fix packet) -- the item IS durably persisted
  (proven by read-back in the real-PG suite); this is a visual-refresh gap
  only.
- `editedAfter.text`'s zod bound (`min(1).max(2000)`) is a reasonable but
  arbitrary length cap; worth revisiting against real usage.
- The standing writer-inventory test's method-boundary detection is a
  pragmatic regex heuristic, not a real parser -- it is verified correct
  against this codebase's actual writer shapes today (both the dynamic
  `setClauses.push()` pattern and literal single-statement SQL), but a
  sufficiently unusual future code style could in principle evade it.
  Genuine RED->GREEN verification against the ONE real writer this repo
  has today gives confidence, not a formal guarantee.

## Final gates

- Real-PG full lifecycle: 30/30 (this suite + h31), independently re-run.
- Manual PUT/autosave -> stale proposal test: green (BLOCKER 1's new case).
- Malicious currentVersion bypass test: green (BLOCKER 2).
- Immutable editedAfter tests: 8/8 green (BLOCKER 3).
- Malformed/malicious semantic model tests: 4/4 green (BLOCKER 4).
- Component tests: 9/9 green, unchanged.
- Standing writer-inventory test: green, RED->GREEN verified load-bearing.
- Fresh migration: `20260802_swot_proposals.sql` re-confirmed idempotent
  on the shared local acceptance Postgres (unchanged from round 1).
- Typecheck: `tsc --noEmit` clean, full project, zero errors.
- Build: `server` (`tsc --noCheck`) exit 0. Frontend `vite build` exit 0,
  built in ~34s (only pre-existing, unrelated chunk-size-limit warnings).
- `git diff --check`: clean on every commit in this fix packet.
- Secret scan (`scripts/check-secrets.js`) against every changed file:
  clean.
- Clean tree at HEAD (confirmed via `git status --short`).

No push, no merge, no deploy, Railway/demo untouched. TLS-01/02/03/05/06
not reopened.

**AWAITING_CODEX_REVIEW**

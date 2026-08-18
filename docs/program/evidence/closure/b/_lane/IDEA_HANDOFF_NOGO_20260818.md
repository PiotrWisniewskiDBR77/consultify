# Lane B — IDEA-WORKSPACE / IDEA-DOCUMENT-HANDOFF: NO-GO record

**Status: READ-ONLY DECISION RECORD, NOT A WORK ITEM.** No product code was
touched to produce this file. No lane lease was amended. No database
container was started. Worker: B5-AUDIT-IDEAHANDOFF. Judged at canonical
`5ce16c71bdee5258ba126870e2fd3039c2a1485d`.

## Decision

**NO-GO.** Lane B will not implement `IDEA-WORKSPACE-SUBPACKET-001` or
`IDEA-DOCUMENT-HANDOFF-SUBPACKET-001`. Program authority has since ruled
implementation stops entirely for both IDs (they are outside the frozen 82);
this record is the evidence trail for why that ruling is correct, and it is
why the work was never started.

## Decisive facts, each with citation

1. **Both IDs are outside the frozen 82-task authority; both are mandatory
   supporting scope only.** Verified two independent ways:
   - `docs/cleanup/POST_CLEANUP_COMPLETION_PLAN.md` contains neither ID
     anywhere (`grep -n "IDEA-WORKSPACE-SUBPACKET-001\|IDEA-DOCUMENT-HANDOFF-SUBPACKET-001" docs/cleanup/POST_CLEANUP_COMPLETION_PLAN.md`
     — zero matches), and this is the exact file `scripts/cleanup/verify-closure-plan.mjs`
     parses to build the 74-module + 8-cross-program = 82 authority set.
   - `docs/cleanup/agents/CLAUDE_LANE_C_15_TASKS_20260816.md`: the numbered-line
     pattern the verifier itself uses (`^\d+\. \`ID\``) matches exactly 15
     lines in that file (`grep -c "^[0-9]\+\. \`" docs/cleanup/agents/CLAUDE_LANE_C_15_TASKS_20260816.md`
     → `15`); both Idea IDs appear only as unnumbered bullets at lines 34 and
     38, under the file's own heading "but these checks are not additional
     top-level tasks in the 82-task denominator." `node scripts/cleanup/verify-closure-plan.mjs`
     passes (82 unique authority IDs, A15+B15+C15+Codex37, zero duplicates)
     with no reference to either Idea ID.

2. **Lane B's lease contains zero Idea-owned paths, so no in-lease
   implementation can satisfy either packet's recorded blocker.**
   `docs/cleanup/agents/generated/CLAUDE_LANE_B_PATH_LEASE.json` — a
   case-insensitive scan of all 2066 entries for the substring `idea` returns
   zero matches. `materializeIdeaArtifact` (`server/src/services/ideaHandoff/ideaHandoffService.ts:371-383`)
   and its route (`server/src/routes/ideaBusinessCase.routes.ts`) are
   Idea-owned/Lane-C-owned; the latter is present verbatim in
   `docs/cleanup/agents/generated/CLAUDE_LANE_C_PATH_LEASE.json`. The real
   document/deck/workbook owner tables and the services that write them
   (`server/src/services/documentStudio/**`, `presentationExportGate.ts`,
   workbook services) are likewise present in Lane C's lease and absent from
   Lane B's. The one required path that IS in Lane B's lease —
   `server/src/routes/my-work.routes.ts`, confirmed present verbatim in
   `CLAUDE_LANE_B_PATH_LEASE.json` — is necessary but not sufficient: fixing
   it alone cannot make `materializeIdeaArtifact` write a real row, because
   that function is out-of-lease code that deliberately writes only a
   placeholder `target_record_id` (`idea-artifact:<proposalId>`) and "never
   writes to `documents`, `presentation_decks`, or any generated-workbook
   table, because those are owned by other lanes"
   (`server/src/services/ideaHandoff/ideaHandoffService.ts:362-370`, docstring).

3. **Lease identity resolved: `f4d75f0a…` is authoritative, `bc4aca9b…` is
   a wrong computation, not a different version of the file.**
   `docs/cleanup/agents/FOUR_BRANCH_EXECUTION_CONTRACT_20260816.md:70` states
   "The JSON SHA-256 is the lease identity and must be reported in every
   handoff," and line 73 quotes Lane B's lease identity as
   `f4d75f0aed94f2e34acaec63d91c245495e7e0f658aa36d1122342c2acecc612`. That
   value is the lease JSON's own internal `sha256` field
   (`sha256(files.join('\n')+'\n')`, the exact formula `verify-closure-plan.mjs`
   checks) — independently recomputed and confirmed matching. `bc4aca9bbc5e54d8cd4eee5afa75d7cc7c2c5cb3ddf9180b7706e6a34a1b34b1`
   is merely `shasum -a 256` of the whole raw file (including the `sha256` key
   itself) — a different, non-canonical measure the contract never
   references. The lease file itself has not changed since baseline: its git
   blob is identical (`f783f5f55a5d4cf98ef671ab9e56108e54c639bd`) at baseline
   commit `64f507859c717494ffa5e83fae550173c9382230` and at canonical
   `5ce16c71bd`. Several Lane B `TASK_EVIDENCE.json` files quote the wrong
   (`bc4aca9b…`) value — a worker reporting error, not evidence of drift
   (`grep -h leaseSha256 docs/program/evidence/closure/b/*/TASK_EVIDENCE.json`
   shows both values in circulation).

4. **The `/convert` duplicate-row mechanism**, `server/src/routes/my-work.routes.ts:7573-7623`
   (the `presentation` target; the same unconditional-insert pattern repeats
   for every other `LIVE_CONVERT_TARGETS` branch at lines ~7245, ~7299,
   ~7412, ~7496, ~7649): `const presId = uuidv4();` followed by an
   unconditional `INSERT INTO presentations (...)`, with no prior lookup for
   an existing conversion of this idea+target and no idempotency key accepted
   from the client. The companion lineage table's DDL
   (`server/migrations/20260723_idea_conversion_history.sql:17-46`) defines
   `my_idea_conversions` with only non-unique indexes on `idea_id`,
   `organization_id`, `target` — **no `UNIQUE` constraint on
   `(idea_id, target)` or on any key column**. A double-click, a client retry
   after a timed-out-but-succeeded request, or two concurrent requests each
   run the same unconditional insert and each succeed, producing duplicate
   rows. This is structurally unlike Lane C's own spine
   (`idx_handoff_receipt_proposal_unique`; partial unique on
   `(organization_id, idempotency_key)`) — `/convert` has no analogous
   DB-level guarantee.

5. **Maturity-stage enforcement is client-side only.** The only server-side
   `maturity_gates_json`/`stage` logic in `my-work.routes.ts` (lines
   3131-3220) validates the *shape* of a maturity-attestation PATCH and a
   stage-enum PUT on the idea record itself; it does not gate `/convert`.
   None of `/convert`'s 680 lines (6966-7646) reference maturity or stage.
   The only real enforcement is client-side:
   `src/components/MyWork/shared/IdeaMaturityGate.tsx`, trivially bypassed by
   calling the API directly.

6. **Three citation defects found in Lane C's own evidence for these two
   packets**, alongside a real, independently-reconstructed six-commit /
   eight-file chain that the evidence never actually enumerates:
   - Both `docs/program/evidence/closure/c/IDEA-WORKSPACE-SUBPACKET-001/TASK_EVIDENCE.json`
     and `docs/program/evidence/closure/c/IDEA-DOCUMENT-HANDOFF-SUBPACKET-001/TASK_EVIDENCE.json`
     have `"changedPaths": []` — zero explicit file paths cited, despite the
     WORKSPACE packet's prose claim of "eight IDEA product/test paths."
   - The WORKSPACE packet's `reconciliationSha` (`163a702f128518965bcdb132dda9c664231a75fa`)
     resolves to `test(finance): corrected B2 perf gate — PERF_FAIL, median
     p95 2279.5ms vs 1200ms limit`, touching only
     `server/src/services/__tests__/financialModelingService.approvePersist.perfgate.pg.test.ts`
     — a Finance perf-gate commit, unrelated to Ideas. The claimed "path
     continuity ... through reconciliation SHA 163a702f" is not verifiable as
     stated.
   - The WORKSPACE packet's `technicalSourceSha` (`bf3e86f7a5fa25199d03ad30eb4e05c5be3128c2`)
     is not an ancestor of `5ce16c71bd` (`git merge-base --is-ancestor` fails)
     — an off-branch/pre-rebase duplicate. Its content is byte-identical to
     on-branch commit `bebf0d118cece77c36ce9dc0ac6f5e566f69c41b`, so the
     underlying work survived, but the cited commit object itself is
     unreachable from canonical.
   - The real, independently reconstructed chain
     (`git diff --name-only 3cef0c4489~1 bebf0d118c`) is six commits —
     `3cef0c4489 → 494a05bd01 → d4fba7c7dd → 190d5d8cfd → e6d5997176 → bebf0d118c`
     — touching exactly eight files: `server/migrations/20261012_idea_workspace_durable_collaboration.sql`,
     `server/src/gateways/ideaCollabWs.gateway.ts`,
     `server/src/realtime/ideaMapAccess.ts`,
     `server/src/routes/my-work.routes.ts`,
     `server/src/validators/ideaWorkspaceGraph.validators.ts`,
     `tests/e2e/ideas/idea-workspace-subpacket.spec.ts`,
     `tests/integration/gateways/ideaCollabWs.sharedPersist.test.ts`,
     `tests/integration/idea-workspace-subpacket.realdb.test.ts`. This chain
     is real and on-branch; it is simply not the chain the evidence's own
     `reconciliationSha` field points to.

## Disposition

Nothing in this file changes product code, lease scope, or verdicts recorded
elsewhere. This is the closing record for worker B5-AUDIT-IDEAHANDOFF's
assignment; the slot is repurposed per program authority as of 2026-08-18.

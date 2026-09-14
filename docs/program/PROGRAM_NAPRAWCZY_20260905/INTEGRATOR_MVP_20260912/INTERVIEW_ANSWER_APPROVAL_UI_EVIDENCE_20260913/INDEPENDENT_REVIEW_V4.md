# Interview answer approval UI V4 — independent skeptical review

Date: 2026-09-13 19:05 America/Chicago  
Reviewer: independent Codex review agent  
Branch: `codex/interview-answer-approval-20260913`  
Backend HEAD reviewed: `b0a2642f9152fd36e590aff2cdb36278c26688b3`  
Base: `cfea70de8a02df900f22416e0728de383d1bde26`

## Verdict

**ACCEPT.** The V4 package closes the final-build runtime evidence gap from V3. I found no P1 or P2 defect in the reviewed UI slice or its evidence. This acceptance is limited to the isolated local Package 5 candidate; it does not authorize staging, deployment, or production changes.

## Frozen candidate integrity

- `FREEZE_MANIFEST_V4.json` SHA-256 is exactly `f3284b57ebb2930d378c6a8a35822e12ec2e278f79c03635ff1c75d54ccf0d44`.
- I independently recomputed byte count, SHA-256, and Git blob ID for every manifest entry: **52/52 exact, 0 missing, 0 drifted**.
- The manifest declares 52 entries and the independently read `dist/index.html` SHA-256 is exactly `49299c4447ca620a049bee24de302e9df163513ec234f16708b438bca0d590d9`.
- Each accepted V4 browser evidence JSON names this exact distribution SHA.

## Independent behavior test

I independently ran:

```text
npx vitest run \
  src/services/__tests__/api.getSystemHealth.guarded.test.ts \
  src/components/Interview/__tests__/InterviewHub.assignmentReview.behavior.test.tsx \
  src/components/Interview/__tests__/InterviewSingleQuestionRuntime.ownerBehavior.test.tsx \
  src/components/Interview/__tests__/InterviewWorkspace.managerReview.behavior.test.tsx \
  tests/unit/views/superadmin/OrgAIPolicyTab.honesty.test.tsx \
  --reporter=verbose
```

Result: **5/5 test files PASS, 44/44 tests PASS**. This independently reproduces the behavioral denominator recorded in `FOCUSED_GREEN_V17_44_OF_44.json`. The expected test-only stderr for the explicit legacy AI-unavailable scenario did not fail the suite.

## Source review of the earlier P1s

The earlier fail-open and stale-scope defects are closed in the reviewed diff:

- approval state is keyed by the exact `organization:user:assignment` scope;
- an in-flight response is ignored when its captured scope differs from the current scope;
- loading and error states keep the workspace and every question read-only;
- assigned-interview submit returns before mutation until the exact-scope projection resolves;
- manager legacy actions appear only after a resolved empty projection; per-answer actions require a resolved non-empty projection;
- answer writes re-read the version token if needed and do not send an unguarded write;
- `getApiMessageKey` reads both normalized `error.data.messageKey` and Axios-compatible `error.response.data.messageKey`.

The independent tests explicitly cover loading, projection error, late response after organization change, resolved-empty legacy behavior, exact per-answer approve/send-back, returned-answer correction, approved-sibling lock, missing assignment identity, and both message-key shapes.

## Browser and PostgreSQL evidence review

I opened and visually inspected the V4 screenshots rather than accepting their JSON summaries alone:

- manager light view shows two separate pending-answer decision forms; after mutation q1 is Approved and q2 is Sent back with the exact reason;
- respondent dark view shows q1 Approved and locked, q2 Sent back with the reason, then q2 corrected with the rendered Review & Submit action;
- superadmin light view shows the organization-specific Answer approval mode set to Two-stage and visible successful load/save feedback;
- controlled-loading light view shows only `Loading answer approval status...`; no approve, send-back, submit, or enabled answer-editor control is visible.

The corresponding accepted JSON artifacts report page errors 0, console errors 0, and local HTTP failures 0. Manager approve and send-back, respondent PATCH and resubmit, superadmin policy load/save, and guarded `/api/system-health/detailed` all returned HTTP 200.

The cold SQL readback contains **4 applied commands and 5 immutable decision receipts**: two initial submitted answers, q1 manager approval, q2 manager send-back with its reason, and a new q2-only submitted receipt after correction. It preserves q1's approved answer digest and records the corrected q2 text. The live policy remains `manager`; the separate draft is `two_stage`; unrelated future keys remain present.

The PostgreSQL setup evidence records PG 18.6, source schema SHA-256 `bf580feb5a9edd7960a2b38708fa31e5d8b16c7014ec82870f700882aa4aba78`, additive migration `20262170_interview_answer_decisions.sql` succeeding twice, and 1,820 public tables after migration.

## Cleanup and limits

The cleanup artifacts record zero fixture rows, zero owned containers, zero owned named volumes, and free ports 4214, 5290, and 6454. I independently checked the current host: none of those ports had a listener and no `cx-interview-ui-v4*` container or volume remained. Port 6456 was outside this package and the package reports it untouched.

The full frontend TypeScript denominator remains 189 inherited diagnostics, with zero diagnostics on changed paths according to the frozen evidence. This is a declared repository limitation and does not invalidate the scoped Package 5 acceptance.

# Interview — per-answer approval implementation plan (2026-09-13)

## Decision

**MIGRATION_REQUIRED.** No migration is included in this branch. Per the CTO
instruction, schema-dependent implementation stops until the additive contract
below is explicitly approved.

The organization policy itself does not require a migration. It can use the
existing versioned `organization_ai_policy.policy` JSONB document under:

```json
{
  "interview": {
    "answerApproval": {
      "version": 1,
      "mode": "manager"
    }
  }
}
```

Allowed modes are `ai`, `manager`, and ordered `two_stage` (`ai` then
`manager`). A missing, malformed, or unknown value resolves to `manager`.

## Existing system audit

### Data model

- `server/migrations/727_beta_missing_tables.sql` and
  `server/migrations/295_interview_context.sql` define
  `interview_questions` as the mutable current answer. It has `answer_text`,
  answer status, author/timestamps and later V6 payload/voice fields, but no
  per-answer submission identity, review stage, approval decision or immutable
  decision receipt.
- `server/migrations/923_interview_answer_history.sql` is an append-only text
  snapshot used for assignment submit/send-back. Its free-form `reason` and
  `answer_text` cannot safely encode ordered AI/manager decisions, policy
  provenance, idempotency or the full answer payload.
- `server/migrations/20260802_interview_ai_suggestion_audit.sql` records whether
  a Teresa suggestion was accepted/rejected. It is not approval of the current
  respondent answer and must not be reused as one.
- `server/migrations/754_interview_ai_review_memory.sql` adds an assignment-level
  AI review snapshot and manager-vs-AI memory. It does not identify an immutable
  answer revision or approve each question independently.
- `interview_answers` is a session/category aggregate with `question_answers`
  JSON, not the canonical per-question runtime writer.

### API and domain behavior

- `server/src/controllers/InterviewController.ts` PATCHes one mutable question
  using `expectedUpdatedAt`, but submit/send-back/approve transition the whole
  assignment and session.
- `server/src/routes/interview.routes.ts` exposes assignment-level submit,
  review-access, send-back and approve routes. There is no per-answer decision
  route or current approval projection.
- `server/src/services/interviewAssignmentReviewAccess.ts` and
  `server/src/services/interviewManagerScope.ts` provide reusable tenant and
  reviewer authority checks. They remain the authority boundary.
- `server/src/routes/llm.routes.ts` already provides same-organization read and
  SuperAdmin versioned writes for `organization_ai_policy`; no parallel policy
  table or default row is needed.

### UI and tests

- `src/components/Interview/InterviewWorkspace.tsx` shows assignment-level AI
  quality, answer history and one assignment-level Approve/Send back control.
  `InterviewSingleQuestionRuntime.tsx` has no per-answer approval badge/action.
- `src/services/api/v8/interview.ts` only has assignment-level review methods.
- `tests/acceptance/interview-submit-review-lifecycle.e2e.test.ts` and
  `tests/e2e/interview-manager-review-real-pg.spec.ts` prove whole-assignment
  submit/send-back/approve. They do not prove each answer or organization modes.
- The older draft
  `docs/product/INTERVIEW_ASSIGNMENT_REVIEW_AND_CONFIRMATION_RUNTIME_V8.md`
  says AI may not auto-approve. The newer Wpis 1 requirement explicitly adds an
  `ai` mode. This is an open CTO decision. The safe work in this branch models
  policy stages only: it does not make an automatic final decision, persist an
  approval or add a writer. The implementation must record the product-policy
  resolution in binding documentation before any AI-only writer is built.

## Minimal additive schema contract requiring CTO approval

Add one append-only table, tentatively
`interview_answer_approval_events`; do not alter `interview_questions`:

| Column                                                  | Contract                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `id`                                                    | immutable event/receipt ID                                                                      |
| `organization_id`                                       | tenant scope on every read/write/index                                                          |
| `assignment_id`, `session_id`, `question_id`            | exact Interview identity                                                                        |
| `submission_id`                                         | groups every answer snapshot in one assignment submission                                       |
| `answer_updated_at`                                     | existing question CAS token captured at submit                                                  |
| `answer_digest`                                         | digest of the complete canonical answer snapshot                                                |
| `answer_snapshot_json`                                  | immutable answer value/context/evidence/voice/AI contribution and question/template version     |
| `event_type`                                            | `submitted`, `ai_approved`, `ai_rejected`, `manager_approved`, `manager_rejected`, `superseded` |
| `stage`                                                 | nullable `ai` or `manager`                                                                      |
| `decision`                                              | nullable `approved` or `rejected`                                                               |
| `reason`                                                | human-readable rejection/limitation reason                                                      |
| `policy_mode`, `policy_version`, `policy_snapshot_json` | policy frozen with the decision                                                                 |
| `actor_type`, `actor_id`                                | `ai` with model provenance or authenticated human                                               |
| `client_request_id`, `request_fingerprint`              | idempotent replay and changed-payload conflict                                                  |
| `metadata_json`                                         | AI score/model/prompt or structured manager missing items                                       |
| `created_at`                                            | server/DB observation time                                                                      |

Required constraints/indexes:

- unique `(organization_id, client_request_id)`;
- tenant-first lookup by `(organization_id, assignment_id, submission_id)` and
  `(organization_id, question_id, created_at)`;
- foreign keys to assignment/session/question with cascade matching current
  Interview lifecycle;
- stage/decision/event checks;
- no UPDATE/DELETE in normal workflow.

The exact answer snapshot/digest means an edit or resubmission cannot inherit a
decision from an older answer. The existing `updated_at` CAS is retained; no
second mutable answer-version column is necessary.

## Implementation after schema approval

1. **Persistence service** — add a tenant-scoped service under
   `server/src/services/interview/` which appends submission/decision events in
   the same transaction as the existing submit and approval transitions,
   verifies request fingerprint replay and derives current per-answer state.
2. **Submit** — extend `InterviewController.submitAssignment` to create one
   `submission_id`, freeze one event per answer and resolve the organization
   policy. AI downtime must remain explicit; it must not silently become an AI
   approval.
3. **Per-answer routes** — add list/read and decision routes in
   `server/src/routes/interview.routes.ts`, guarded by current tenant/reviewer
   access and exact `expectedAnswerUpdatedAt` plus `clientRequestId`.
4. **Stage rules** — `manager` requires manager approval; `ai` requires an AI
   receipt for the exact digest; `two_stage` requires AI approval before manager
   approval. A rejection remains visible and blocks finalization for that
   submission.
5. **Assignment finalization** — retain the existing assignment as the
   downstream compatibility gate, but allow `approved/completed` only when every
   submitted answer satisfies its frozen policy. Never synthesize per-answer
   approvals from the old assignment status.
6. **Read model/API** — add per-question approval state, current stage, reason,
   decision actor/time and policy mode to Interview reads and
   `src/services/api/v8/interview.ts`.
7. **UI** — render per-answer status and allowed next action in
   `InterviewSingleQuestionRuntime.tsx`; keep assignment coverage/final action
   in `InterviewWorkspace.tsx`. Add an explicit Interview policy control backed
   by the existing versioned organization policy API instead of a parallel
   settings store.
8. **Evidence** — behavioral tests must cover all three modes, manager default,
   exact question/digest identity, two-stage ordering, changed-answer
   invalidation, idempotent replay, tenant 404, permission 403, concurrent CAS,
   AI unavailable, cold readback and approved-only downstream use.

## Safe work completed without migration

`server/src/services/interview/interviewAnswerApprovalPolicy.ts` supplies the
pure policy parser/updater and ordered-stage evaluator. It reads the existing
organization policy shape, defaults to manager, preserves unrelated keys and
reports only whether configured stages are complete. It does not equate an AI
stage with final Interview approval, perform database writes or introduce a
schema fallback.

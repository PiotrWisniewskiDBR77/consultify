# Interview — per-answer approval implementation plan (2026-09-13)

## Decision

**MIGRATION_AUTHORIZED, NOT INCLUDED IN THIS REVIEW-FINDINGS COMMIT.** Wpis 2
08:20 authorizes exactly one additive migration:
`server/migrations/20262170_interview_answer_decisions.sql`. It may use only
`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and
`CREATE INDEX IF NOT EXISTS`; it may not alter types, drop objects, edit old
migrations, or backfill data. The next commit must prove an idempotent double
run on both an empty database migrated from zero and the restored local
schema-only staging dump. It must not run against staging or demo.

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
`manager`). Version `1` is the only supported policy version. A missing,
malformed, unknown-mode, invalid-version, or future-version policy resolves
fail-closed to `manager`. A policy writer must refuse an invalid or future
version; it must never overwrite or downgrade it to version `1`.

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
  says AI may not auto-approve. The newer Wpis 1 and Wpis 2 08:20 supersede that
  draft only for per-answer sufficiency: `ai` lets the AI quality stage decide
  whether an exact answer revision is sufficient, `manager` requires the
  manager, and `two_stage` records the AI proposal before the manager decides.
  Completing an AI quality stage is not an automatic final assignment or
  Interview approval. Assignment roll-up remains blocked until the durable
  per-answer writer and projection prove every answer's frozen policy; it must
  never infer approval from `stages_complete` in this pure helper.

## Minimal additive schema contract requiring CTO approval

The authorized migration must add a parent command receipt and append-only
answer decisions; it must not alter `interview_questions`.

`interview_answer_decision_commands` is the idempotency boundary for one
multi-answer submission/decision command:

| Column                                                    | Contract                                                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `id`, `organization_id`, `assignment_id`, `submission_id` | immutable command and tenant-scoped Interview identity                                                          |
| `client_request_id`, `request_fingerprint`                | unique replay key per organization and exact whole-command fingerprint                                          |
| `expected_answer_count`, `answer_manifest_digest`         | proves the command's complete question/revision denominator                                                     |
| `status`, `response_json`                                 | one atomic terminal response replayed for the whole command; never reconstruct a partial replay from event rows |
| `created_at`, `completed_at`                              | server/DB observation time                                                                                      |

`interview_answer_decisions` holds the immutable per-answer receipts:

| Column                                                  | Contract                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `id`                                                    | immutable event/receipt ID                                                                        |
| `organization_id`                                       | tenant scope on every read/write/index                                                            |
| `assignment_id`, `session_id`, `question_id`            | exact Interview identity                                                                          |
| `submission_id`                                         | groups every answer snapshot in one assignment submission                                         |
| `answer_updated_at`                                     | existing question CAS token captured at submit                                                    |
| `answer_digest`                                         | digest of the complete canonical answer snapshot                                                  |
| `answer_snapshot_json`                                  | immutable answer value/context/evidence/voice/AI contribution and question/template version       |
| `command_id`, `ordinal`                                 | parent command plus a positive, command-local monotonic receipt order                             |
| `event_type`                                            | `submitted`, `ai_approved`, `ai_sent_back`, `manager_approved`, `manager_sent_back`, `superseded` |
| `stage`                                                 | nullable `ai` or `manager`                                                                        |
| `decision`                                              | nullable `approved` or `sent_back`                                                                |
| `reason`                                                | human-readable send-back/limitation reason                                                        |
| `policy_mode`, `policy_version`, `policy_snapshot_json` | policy frozen with the decision                                                                   |
| `actor_type`, `actor_id`                                | `ai` with model provenance or authenticated human                                                 |
| `metadata_json`                                         | AI score/model/prompt or structured manager missing items                                         |
| `created_at`                                            | server/DB observation time                                                                        |

Required constraints/indexes:

- command unique `(organization_id, client_request_id)` and changed-fingerprint
  conflict before any answer receipt is appended;
- decision unique `(organization_id, command_id, question_id, event_type)` and
  `(organization_id, command_id, ordinal)`;
- tenant-first lookup by `(organization_id, assignment_id, submission_id)` and
  `(organization_id, question_id, ordinal, id)`;
- foreign keys to assignment/session/question with cascade matching current
  Interview lifecycle;
- stage/decision/event checks;
- no UPDATE/DELETE in normal workflow.

The exact answer snapshot/digest means an edit or resubmission cannot inherit a
decision from an older answer. The existing `updated_at` CAS is retained; no
second mutable answer-version column is necessary. Projection order is always
`ordinal ASC, id ASC`; array or query return order is never authority. The
parent receipt commits the full response only after the complete expected
answer count is present, so exact replays return the whole command result and a
changed fingerprint conflicts atomically.

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
   sufficiency receipt for the exact digest; `two_stage` requires the AI
   proposal before the manager decision. `sent_back` remains visible and blocks
   finalization for that submission. AI stage completion alone never writes the
   final assignment decision.
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
organization policy shape, defaults fail-closed to manager, refuses to rewrite
invalid/future policy versions, preserves unrelated keys and reports only
whether configured stages are complete. Decision receipts carry an explicit
positive ordinal and receipt ID and are ordered deterministically rather than
by input-array order. It uses the production `sent_back` vocabulary. It does
not equate an AI stage with final Interview approval, perform database writes or
introduce a schema fallback.

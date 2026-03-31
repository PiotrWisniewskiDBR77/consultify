# P09-B Verification — Survey Collection Lane Canon

**Date**: 2026-03-31
**Packet**: P09-B (collection lane canon + operator workflow governance)
**Status**: verified(evidence)

## Technical closure

### P09-B: Collection lane canon closure

1. **Canon module** — `server/src/services/v8/surveyCollectionCanon.ts`
   - Contract identifier: `survey_collection_lane_v1`
   - 6 submission statuses: draft → submitted → under_review → accepted → rejected → locked
   - Operator next actions defined per status
   - Status transitions explicit; locked and rejected are terminal
   - Survey lifecycle: draft → published → collecting → review_queue → closed → archived

2. **Branching posture** — Supported: skip_logic, conditional_display; Non-goal: complex_scripting, quotas, randomized_blocks, loops
   - Validation expectation: dead-end detection before publish
   - Preview requirement: operator can preview pathing

3. **Handoff to P10** — `P09HandoffToP10Payload` interface
   - Identity: surveyId, submissionId, respondentId, timestamps
   - Governance: submissionStatus, validationSummary, operatorResolutionNotes
   - Content: normalizedAnswers, attachmentRefs, consentFlags
   - Provenance: exportArtifactRef, auditTrailPointers, surveyVersionAtSubmission
   - Idempotency: submissionId as idempotency key

4. **Anti-duplicate rules** — at-least-once delivery assumption, stable idempotency key, no double-counting
5. **Degraded posture** — 10 scenarios with explicit user-visible state + operator next action
6. **Non-goals** — 6 explicit non-goals including insight computation

### Tests
- Canon tests: `server/src/routes/v8/__tests__/p09-survey-canon.test.ts` (15+ tests)
- Coverage: status grammar, transitions, branching posture, handoff payload, anti-duplicate, degraded posture, acceptance checklist, non-goals

## Acceptance checklist verification

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Ankiety is collection lane, not insight engine | PASS — `P09_COLLECTION_LANE_CONTRACT` + `P09_NON_GOALS` |
| 2 | Canonical submission statuses with operator next actions | PASS — 6 statuses, each with operatorAction + notes |
| 3 | Branching posture explicit (supported vs non-goal) | PASS — `P09_BRANCHING_POSTURE` with validation + preview |
| 4 | Handoff payload to P10 explicit | PASS — `P09HandoffToP10Payload` + `P09_HANDOFF_TO_P10` |
| 5 | Anti-duplicate + degraded posture explicit | PASS — 4 anti-duplicate rules + 10 degraded scenarios |

## Staging checklist
- [x] Submission status grammar frozen with operator next actions
- [x] Status transitions explicit; terminal states defined
- [x] Branching posture: supported vs non-goal with validation expectation
- [x] Handoff payload covers identity + governance + content + provenance + idempotency
- [x] Anti-duplicate rules: at-least-once + idempotency key + no double-counting
- [x] Degraded posture: 10 scenarios with user-visible state + next action

## Rollback plan
- Disable survey publishing; preserve existing submissions read + export
- No data destruction

## Known limits
- P09-B is canon + governance closure only; full operator workflow runtime (create/collect/review/lock/export) deferred to P09-B runtime phase

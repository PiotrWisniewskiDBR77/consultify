# Team Approval And Shared Agent Review v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac jak propozycje AI, praca `Teresa` i execution flows sa reviewowane, komentowane i zatwierdzane przez zespol, a nie tylko pojedynczego usera.

---

## 1. Why this document exists

`Chat v8` i `proposal-only` semantics sa juz mocne dla pojedynczego usera.

W B2B to nie wystarcza.

Potrzebna jest jeszcze jedna warstwa:

- kto reviewuje propozycje w teamie,
- kto ma ownership decyzji,
- jak wspolna rozmowa lub thread przechodzi przez approval,
- jak Teresa-generated proposals dzialaja w shared context.

---

## 2. Inherited truth

This document inherits:

- `CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md`
- `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md`
- `CHAT_APPLICATION_AGENT_RUNTIME_V8.md`

Rule:

`shared AI work must preserve clear approval ownership even when many people can see the same thread`

---

## 3. Shared review scenarios

This document covers:

- shared team thread with Teresa proposals
- team review of one proposal set
- delegated approval ownership
- observed but non-editing participants
- escalation to stronger approver

It does not mean:

- every team member can apply everything
- shared visibility equals shared authority

---

## 4. Canonical collaboration roles

Roles in shared agent review:

- `requester`
- `reviewer`
- `approver`
- `observer`
- `escalation_owner`

One user may hold multiple roles, but the semantics must remain explicit.

---

## 5. Canonical objects

## 5.1 `SharedReviewContext`

Fields:

- `shared_review_context_id`
- `thread_or_workspace_ref`
- `execution_run_ref`
- `proposal_set_ref`
- `visible_to_role_set`
- `approval_owner_ref`

## 5.2 `ApprovalAssignment`

Fields:

- `approval_assignment_id`
- `proposal_or_set_ref`
- `assigned_reviewer_ref`
- `assigned_approver_ref`
- `deadline_at?`
- `assignment_reason`

## 5.3 `ReviewComment`

Fields:

- `review_comment_id`
- `proposal_ref`
- `author_ref`
- `comment_type`
- `body`
- `created_at`

Comment types:

- `question`
- `risk`
- `requested_change`
- `approval_note`

---

## 6. Shared approval doctrine

The baseline doctrine should support:

- visible proposal preview for authorized collaborators
- explicit approval ownership
- clear current decision state
- shared comment and review history
- escalation when the current approver is not enough

The doctrine must not allow:

- hidden change of approver meaning
- multiple conflicting approvals without resolution rule
- shared thread visibility to imply mutation rights

---

## 7. Teresa in team contexts

If Teresa proposes work in a shared context:

- proposal ownership should remain traceable
- Teresa should know whether she is assisting one requester or a shared team surface
- approval CTA should route to the right reviewer or approver
- comments and objections should remain attached to the proposal, not only to chat prose

---

## 8. Review state vocabulary

Shared review states:

- `awaiting_reviewer`
- `awaiting_approver`
- `changes_requested`
- `approved`
- `rejected`
- `escalated`
- `expired`

This vocabulary should align with the broader proposal spine rather than inventing a separate collaboration language.

---

## 9. Notification and reengagement tie-in

Shared reviews should integrate with:

- `pending_review`
- `proposal_expiring`
- `completed_async_work`
- `resume_available`

Only the right reviewer or approver should receive the action CTA when policy requires exclusive ownership.

---

## 10. Risks and anti-patterns

- team-shared thread has no clear approver
- Teresa proposal is visible to many people but decision ownership is ambiguous
- comments live only in chat prose and cannot be audited
- one user approves while another thinks the decision is still pending
- shared review creates hidden permission escalation

---

## 11. Acceptance criteria

- shared AI review has explicit roles and approval ownership
- Teresa proposals can be safely handled in team-visible contexts
- comments and decisions are attached to proposals, not only messages
- visibility, review and apply rights stay distinct

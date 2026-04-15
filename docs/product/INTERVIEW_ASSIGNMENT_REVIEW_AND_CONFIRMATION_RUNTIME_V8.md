# Interview Assignment Review And Confirmation Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical assignment lifecycle, reminder memory, escalation policy, answer validation, respondent confirmation and reviewer rework loop for Interview

---

## 1. Why this document exists

One of the most important weak points in Interview is not question authoring alone.

It is the operational flow:

- someone assigns work
- someone receives it
- someone answers
- someone reviews
- someone confirms or sends back
- the system remembers inactivity, deadlines and escalation

Without this, Interview remains only a form engine instead of a governed work system.

---

## 2. Core statement

`Interview` assignments should behave like accountable, reviewable work.

The runtime must make explicit:

- ownership
- deadline
- progress
- reminders
- escalation
- answer quality
- respondent confirmation
- reviewer decision
- rework cycle

---

## 3. Canonical assignment lifecycle

The canonical lifecycle should be:

`assigned -> in_progress -> submitted -> approved | expired | escalated`

### 3.1 Runtime state meanings

- `assigned`: work delegated but not yet started
- `in_progress`: active answering or draft progression
- `submitted`: respondent marked the current answer set as reviewable, but can still continue editing until final approval
- `send_back`: reviewer requested rework and the assignment returns to normal work state `in_progress`
- `approved`: answer set confirmed and accepted
- `expired`: deadline ended without acceptable completion
- `escalated`: assignment moved into escalation handling

Rule:

`the lifecycle must keep reviewability explicit, but only approval should hard-lock the respondent`

---

## 4. Assignment memory and reminder model

The system should preserve assignment memory as durable workflow state, not just ad hoc notifications.

Canonical reminder memory fields:

- `assigned_at`
- `last_opened_at`
- `last_answered_at`
- `last_submitted_at`
- `last_reviewed_at`
- `last_reminder_at`
- `reminder_count`
- `last_reminder_type`
- `escalation_count`
- `last_escalated_at`

### 4.1 Reminder classes

Allowed reminder classes:

- `not_started`
- `inactive_draft`
- `due_soon`
- `overdue`
- `sent_back_waiting`
- `review_waiting`

### 4.2 Reminder policy

Reminder policy should define:

- who receives the reminder
- when reminders start
- maximum reminder cadence
- whether reminders pause after submit
- whether reminders change after send-back

Rule:

`reminders must be state-aware and stop when the assignment no longer needs the respondent's action`

---

## 5. Escalation doctrine

Escalation should exist for:

- overdue assignments
- assignments with no activity
- repeated send-back cycles
- reviewer inactivity after submit

Escalation should preserve:

- assignment owner
- escalation target
- reason
- timing context
- prior reminder history

### 5.1 Escalation classes

- `deadline_breach`
- `no_response`
- `rework_stuck`
- `review_stuck`
- `quality_risk`

---

## 6. Answer validation model

Interview should separate three validation layers:

### 6.1 Template validation

Checks:

- question quality
- modality fit
- flow integrity
- evidence expectations

### 6.2 Respondent submission validation

Checks:

- required answer present
- required supporting context present where policy requires it
- required evidence present where policy requires it
- numeric or structured constraints
- unresolved empty critical fields

### 6.3 Reviewer validation

Checks:

- answer is understandable
- answer has internal meaning
- answer is sufficiently complete
- answer is consistent with the question intent
- evidence and context are adequate

Rule:

`submission validation confirms technical completeness; reviewer validation confirms business adequacy`

---

## 7. Completeness and quality semantics

The module should distinguish:

- `answered`
- `complete`
- `adequate`
- `approved`

These are not the same thing.

### 7.1 Minimum completeness dimensions

- answer presence
- supporting context presence
- evidence sufficiency
- internal meaning
- unresolved ambiguity

### 7.2 Quality signals

The runtime should support machine and human quality signals such as:

- too short
- ambiguous
- unsupported
- contradictory
- needs clarification
- evidence missing

---

## 8. Respondent confirmation model

The system should support explicit respondent confirmation whenever an answer is:

- transcribed from voice
- parsed from conversational input
- AI-structured from a larger response
- enriched from external context

Canonical confirmation classes:

- `raw_manual_answer`
- `confirmed_transcript`
- `confirmed_ai_structured_answer`
- `confirmed_context_enriched_answer`

Rule:

`if the final stored answer is not a simple manual answer, the respondent should confirm that it reflects their meaning`

Optional respondent attestation:

- `I confirm this answer is accurate to the best of my knowledge`

---

## 9. Reviewer confirmation and send-back loop

Reviewer decisions should be:

- `approve`
- `send_back_for_rework`
- `escalate`

### 9.1 Send-back must be structured

Send-back should preserve:

- reason
- missing items list
- affected question IDs or sections
- expected fix type

Examples of fix types:

- `clarify`
- `add_evidence`
- `expand_answer`
- `correct_meaning`
- `complete_required_fields`

### 9.2 Rework cycles must be counted

The runtime should preserve:

- send-back count
- resubmission count
- latest missing-items checklist
- unresolved review concerns

---

## 10. Manager and reviewer visibility

Managers and reviewers should see:

- assigned
- started
- partially complete
- submitted
- awaiting review
- sent back
- overdue
- escalated

They should also see:

- last activity
- reminder history
- escalation history
- quality risk markers

---

## 11. AI quality governance

AI in Interview should play three distinct roles:

- respondent coach
- machine quality reviewer
- approved-knowledge learner

These roles must not collapse into one opaque automation.

### 11.1 Respondent-side AI

AI may help the respondent by:

- explaining the question intent
- improving wording and structure
- cleaning transcript artifacts
- mapping conversational input into draft answers

Rule:

`AI may assist answer formation, but the respondent remains the final source of meaning`

If an answer is produced or materially transformed by AI or transcript processing, the respondent should confirm it before it becomes the accepted stored answer.

### 11.2 Review-stage AI

After `submit`, the runtime should support an AI quality layer that evaluates:

- completeness
- specificity
- relevance
- actionability
- evidence sufficiency

The result should be visible to:

- the respondent
- the reviewer
- the manager operating the workflow

The AI quality layer may:

- produce per-question warnings
- produce an overall verdict
- suggest improvements
- flag quality risk markers

The AI quality layer may not:

- auto-approve the assignment
- silently overwrite respondent answers
- publish downstream outputs as trusted knowledge before human approval

### 11.3 Human authority rule

Manager or reviewer remains the final authority for:

- `approve`
- `send_back`
- escalation decisions
- downstream release of approved meaning

Rule:

`AI scores quality; humans decide acceptance`

### 11.4 Learning loop

Interview should improve AI quality over time using:

- approved answers
- approved transcripts
- manager send-back reasons
- resubmission deltas
- approval outcomes compared with prior AI verdicts

The preferred first mechanism is retrieval and governance memory, not silent model drift.

Rule:

`AI should learn primarily from approved and reviewer-confirmed meaning, not from raw submissions alone`

### 11.5 Governance boundary

The system should explicitly distinguish:

- raw respondent content
- AI-assisted draft content
- submitted reviewable content
- approved reusable context

Only approved reusable context should be eligible for broad organizational learning and downstream knowledge reuse.

---

## 12. Known implementation-facing risk

The documentation package should explicitly track one important risk until code catches up:

`rework and resubmission must be aligned with runtime gate policy so a sent-back assignment can reliably move back into a valid resubmission path`

This is not a reason to weaken the doctrine.
It is a reason to make the doctrine explicit.

---

## 13. Related canonical docs

- `INTERVIEW_DISTRIBUTION_AND_PARTICIPANT_RUNTIME_V8.md`
- `INTERVIEW_TEMPLATE_QUALITY_AND_METHODOLOGY_GUARDRAILS_V8.md`
- `INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md`
- `INTERVIEW_AGENT_GUIDED_RUNTIME_V8.md`
- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
- `ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`

# Interview Distribution And Participant Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: participant management, invitation flow, reminder policy, representation rules and participation funnel for Interview

---

## 1. Why this document exists

World-class survey and interview systems treat participant operations as first-class, not an afterthought.

---

## 2. Core statement

Interview distribution in Consultify should support:

- who to ask
- how to invite
- how to remind
- how to resume
- how to understand drop-off and coverage

---

## 3. Participant runtime objects

The system should use:

- `InterviewParticipant`
- `ParticipantInvitation`
- `ParticipantAccessLink`
- `ParticipantReminder`
- `ParticipantProgressState`

---

## 4. Distribution channels

Supported conceptual channels:

- internal assignment
- email invite
- controlled shared link
- guided synchronous interview

Rule:

`participant distribution must remain policy-aware and traceable`

---

## 5. Participation funnel

The module should track:

- invited
- opened
- started
- partial
- completed
- dropped
- disqualified where policy allows

---

## 6. Representation rules

Programs should define whether enough participants exist by:

- role
- business area
- geography if relevant
- initiative linkage

---

## 7. Partial completion and resume

The platform should support:

- partial save
- resume path
- reminder policy
- expiration policy

---

## 8. Related canonical docs

- `INTERVIEW_PROGRAM_OPERATING_MODEL_V8.md`
- `INTERVIEW_REPORTING_AND_DASHBOARDS_V8.md`
- `INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md`

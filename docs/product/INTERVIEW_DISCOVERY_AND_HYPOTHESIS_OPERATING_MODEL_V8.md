# Interview Discovery And Hypothesis Operating Model v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical consulting-discovery model for Interview programs, including discovery brief, hypotheses, stakeholder weighting and decision-oriented inquiry

---

## 1. Why this document exists

Interview should not behave like a neutral questionnaire only.

In consulting work, interviews exist to:

- reduce uncertainty
- validate or invalidate hypotheses
- reveal blockers
- support decisions

This document defines the discovery operating model around Interview so the module can collect data and context like a consultant.

---

## 2. Core statement

Every serious Interview program should start from a governed discovery brief, not just a list of questions.

Canonical path:

`client problem -> discovery brief -> hypotheses -> stakeholder coverage plan -> interview execution -> evidence review -> consulting synthesis`

---

## 3. Discovery brief contract

An `InterviewDiscoveryBrief` should define:

- `client_problem_statement`
- `program_goal`
- `decision_targets`
- `critical_unknowns`
- `required_evidence_areas`
- `suspected_blockers`
- `success_conditions`

Rule:

`questions should be derived from discovery intent, not treated as isolated form fields`

---

## 4. Hypothesis model

The Interview package should support explicit hypotheses such as:

- `current_state_hypothesis`
- `root_cause_hypothesis`
- `adoption_hypothesis`
- `risk_hypothesis`
- `capability_gap_hypothesis`

Each `InterviewHypothesis` should preserve:

- statement
- owner
- confidence before interviews
- evidence needed
- current status: `open | supported | contradicted | unresolved`

---

## 5. Stakeholder weighting and coverage

Coverage should not treat all respondents equally.

The platform should support a weighted stakeholder map including:

- executive sponsor
- transformation owner
- middle manager
- frontline operator
- domain expert
- IT or systems owner
- blocker or skeptic
- informal influencer

Each `InterviewParticipantRef` should be enrichable with:

- `stakeholder_class`
- `influence_weight`
- `decision_proximity`
- `process_proximity`
- `risk_of_omission`

Rule:

`coverage completion should consider weighted stakeholder presence, not only response count`

---

## 6. Decision-oriented inquiry doctrine

Interview should help teams distinguish between:

- exploratory questions
- validation questions
- contradiction-seeking questions
- decision-support questions
- evidence-request questions

The consulting goal is not only to capture what people say, but to understand what the program can safely conclude.

---

## 7. Discovery outcomes

The module should be able to produce:

- validated hypothesis set
- disproven assumptions
- open unknowns
- missing stakeholder warnings
- evidence gaps
- decision-ready findings

---

## 8. Related canonical docs

- `INTERVIEW_PROGRAM_OPERATING_MODEL_V8.md`
- `INTERVIEW_DISTRIBUTION_AND_PARTICIPANT_RUNTIME_V8.md`
- `INTERVIEW_EVIDENCE_CONFIDENCE_AND_TRIANGULATION_V8.md`
- `INTERVIEW_CONTRADICTION_AND_CLIENT_READBACK_RUNTIME_V8.md`

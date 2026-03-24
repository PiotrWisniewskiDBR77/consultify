# Interview Branching And Flow Architecture v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: branching, routing, reusable flow fragments, path simulation and runtime path audit for Interview templates

---

## 1. Why this document exists

The survey benchmark confirms that strong interview systems need more than static question lists.

They need governed flow logic.

---

## 2. Core statement

Interview flow should support:

- branching
- conditional display
- path routing
- reusable question blocks
- path audit

without destroying author clarity.

---

## 3. Allowed flow mechanisms

- conditional next question
- conditional section skip
- reusable branch fragment
- hidden or prefilled context trigger
- respondent-role pathing

---

## 4. Runtime path audit

The system should preserve:

- which path was taken
- why it was taken
- which conditions triggered it
- what context data influenced it

---

## 5. Topic adaptation

The flow model should allow topic-fit adaptation based on:

- respondent role
- org context
- previous answers
- hidden context fields

Rule:

`adaptation may deepen or reroute, but it must not become opaque manipulation`

---

## 6. Related canonical docs

- `INTERVIEW_TEMPLATE_QUALITY_AND_METHODOLOGY_GUARDRAILS_V8.md`
- `INTERVIEW_AGENT_GUIDED_RUNTIME_V8.md`
- `INTERVIEW_DISTRIBUTION_AND_PARTICIPANT_RUNTIME_V8.md`

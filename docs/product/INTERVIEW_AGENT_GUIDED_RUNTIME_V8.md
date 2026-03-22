# Interview Agent Guided Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: agent-guided interviewing, Teresa-led question flow, adaptive probing and governed AI assistance during interview sessions

---

## 1. Why this document exists

Interview should support not only static asking of questions but guided interviewing with AI assistance.

---

## 2. Core statement

Agent-guided Interview should allow Teresa or another governed assistant to:

- ask questions
- clarify
- probe deeper
- adapt based on context and prior answers
- help structure responses
- support both typed and spoken answering paths

without replacing human review or governance.

---

## 3. Allowed AI guidance behaviors

AI may:

- explain the question
- ask a follow-up
- request evidence
- suggest missing context
- summarize what was heard

AI may not:

- fabricate an answer
- silently change the meaning of the respondent's answer
- force hidden path changes without traceability

---

## 4. Topic-fit adaptation

Agent-guided runtime may adapt based on:

- respondent role
- template logic
- org context
- previous answers
- known external context that is already in scope

All meaningful adaptations should be auditable.

This includes adaptation when the user:

- types directly
- dictates
- answers in a spoken interview with Teresa

---

## 5. Answer enrichment

The guided runtime should help capture:

- direct answer
- clarification
- supporting context
- evidence reference
- unknowns or ambiguity

This is one of the core ways Interview moves beyond simple answers.

If the final stored answer is based on:

- transcript parsing
- AI structuring
- context enrichment

the respondent should confirm that the answer reflects their intended meaning before it becomes the accepted answer state.

---

## 6. Related canonical docs

- `INTERVIEW_BRANCHING_AND_FLOW_ARCHITECTURE_V8.md`
- `INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
- `TERESA_ASSISTANT_CONTRACT_V8.md`
- `INTERVIEW_ASSIGNMENT_REVIEW_AND_CONFIRMATION_RUNTIME_V8.md`
- `INTERVIEW_AGENT_AND_ORG_CONTEXT_MEMORY_V8.md`

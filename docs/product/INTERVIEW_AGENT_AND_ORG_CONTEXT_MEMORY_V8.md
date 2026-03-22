# Interview Agent And Org Context Memory v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical integration contract between Interview, Teresa-style agent guidance, text and voice answer capture, answer refinement, and promotion of approved interview outputs into organization-shared context and vector knowledge

---

## 1. Why this document exists

Interview is not complete if it only supports static question answering.

In real use:

- some users want to type
- some users want to dictate
- some users want to answer conversationally with Teresa
- some users write poorly but still mean something valuable

At the same time, the outputs of Interview are later reused across the organization.

So the platform needs one explicit contract for:

- how answers are captured
- how AI helps
- how Teresa participates
- how the final meaning is confirmed
- how approved outputs become organization context and vector knowledge

---

## 2. Core statement

`Interview` should support one governed answer pipeline across text, voice and agent-guided interaction.

Canonical path:

`question -> answer capture -> AI or Teresa assist -> respondent confirmation -> reviewer confirmation where needed -> structured knowledge object -> organization-shared context and vector promotion by policy`

Rule:

`no interview-derived organizational memory should be created from unconfirmed or policy-ineligible answer states`

---

## 3. Allowed answer input modes

The Interview runtime should explicitly support:

- `manual_text`
- `dictated_text`
- `voice_transcript_answer`
- `agent_guided_conversation_answer`
- `context_enriched_answer`

### 3.1 `manual_text`

The user types the answer directly.

### 3.2 `dictated_text`

The user speaks, the system transcribes, but the user still treats the result as an editable written answer.

### 3.3 `voice_transcript_answer`

The answer is captured as transcript-first and must be confirmed before it becomes accepted answer state.

### 3.4 `agent_guided_conversation_answer`

Teresa or another internal agent asks, clarifies and structures the response conversationally.

### 3.5 `context_enriched_answer`

The answer is expanded or structured using already-allowed organizational or project context.

---

## 4. Teresa integration doctrine

Teresa should be able to participate in Interview by:

- asking the active question
- explaining the intent of the question
- probing for clarification
- identifying missing context
- suggesting better wording
- helping transform poor raw text into clearer factual language

Teresa may not:

- invent business facts
- silently replace the respondent's meaning
- auto-submit the answer as final truth
- silently promote answer content into org memory

Rule:

`Teresa is a guided capture and clarification layer, not the owner of the respondent's meaning`

---

## 5. Answer refinement doctrine

The platform should support a refinement path where AI or Teresa can help convert:

- messy wording
- fragmented notes
- spoken narrative
- incomplete contextual phrasing

into:

- clearer factual answer
- structured answer
- summarized answer
- answer plus evidence prompt

But every refinement must preserve:

- original answer source
- refined answer state
- confirmation state

Canonical answer states should distinguish:

- `raw_answer`
- `ai_refined_draft`
- `respondent_confirmed_answer`
- `reviewer_confirmed_answer`

---

## 6. Confirmation doctrine

### 6.1 Respondent confirmation

Respondent confirmation is required whenever the final saved answer is based on:

- transcript parsing
- AI structuring
- Teresa-guided capture
- context enrichment beyond raw wording cleanup

### 6.2 Reviewer confirmation

Reviewer or assigner confirmation is required where:

- the assignment requires approval
- quality or completeness remains uncertain
- the answer is intended for downstream organizational reuse

### 6.3 Confirmation rule

The system must preserve:

- who confirmed
- what version was confirmed
- whether the confirmation was respondent-only or reviewer-approved

---

## 7. Organizational context formation

Interview should create organizational context in layers:

### 7.1 Session-local layer

- raw answers
- drafts
- transcripts
- notes
- evidence references

This layer is not yet organization truth.

### 7.2 Structured interview layer

- confirmed answers
- structured answer objects
- evidence-backed clarifications
- approved interview insights

This layer is eligible for governed reuse.

### 7.3 Organization-shared context layer

- approved context snapshots
- approved findings
- approved reusable facts
- approved evidence-linked statements

This layer may become organization-shared memory.

---

## 8. Vector knowledge promotion doctrine

Interview-derived vector knowledge should only be created from policy-eligible content such as:

- respondent-confirmed structured answers
- reviewer-approved answers where review is required
- approved insight fragments
- evidence-derived text with provenance
- organization-context summaries approved for reuse

Interview content must not enter organization-shared vector memory from:

- raw unconfirmed transcripts
- unanswered prompts
- private notes not cleared for org reuse
- sensitive content not allowed by privacy policy

---

## 9. Required metadata for Interview-derived knowledge

Each promoted knowledge unit should preserve:

- `org_id`
- `session_id`
- `question_id`
- `assignment_id?`
- `template_version`
- `respondent_role`
- `answer_input_mode`
- `confirmation_state`
- `review_state`
- `privacy_class`
- `source_type`

---

## 10. Retrieval and usage rule

When Interview-derived context is later used across the organization:

- retrieval must respect organization-shared scope
- raw private or session-local content must not be implicitly reused
- answers should remain attributable to their source question or session
- AI outputs should remain honest about Interview as a source class

---

## 11. Main implementation-facing risks

- transcript or AI-refined answers are treated as final without explicit confirmation
- Teresa-style guided capture exists without durable state or audit of what changed
- organization context is built from raw answers instead of approved meaning
- structured Interview search and vector retrieval are confused as the same thing

---

## 12. Related canonical docs

- `INTERVIEW_AGENT_GUIDED_RUNTIME_V8.md`
- `INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
- `INTERVIEW_ASSIGNMENT_REVIEW_AND_CONFIRMATION_RUNTIME_V8.md`
- `INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`

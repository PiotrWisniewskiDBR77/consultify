# Interview Integration And Export Contract v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: internal handoff, knowledge ingestion, export object classes and external delivery rules for Interview outputs

---

## 1. Why this document exists

Interview outputs are valuable only if they flow safely into the rest of the platform.

This is especially important for:

- organizational context
- vector knowledge
- tools and assessments
- initiatives and decisions

---

## 2. Canonical export object classes

Interview should export or promote:

- `InterviewFinding`
- `InterviewInsight`
- `InterviewEvidenceRef`
- `InterviewContextSnapshot`
- `InterviewKnowledgeObject`
- `InterviewActionProposal`

---

## 3. Internal handoff targets

Interview outputs should be able to feed:

- tools and assessments
- notebook and knowledge systems
- inbox and tasks
- decisions
- initiatives
- reports and presentations

---

## 4. Knowledge and vector ingestion doctrine

Interview should support a governed path into the organization knowledge base.

The canonical units should be:

- question and answer chunks
- transcript chunks
- evidence-derived text chunks
- approved insight chunks
- organization-context summary chunks

Each chunk should preserve metadata such as:

- `org_id`
- `session_id`
- `question_id`
- `template_version`
- `respondent_role`
- `source_type`
- `privacy_class`

Rule:

`Interview content may enter organizational vector knowledge only through explicit scope, privacy and provenance rules`

---

## 5. Anchored context enrichment

The Interview module should support context completion from:

- org facts
- project context
- prior interview findings
- synced external data where policy allows

This enrichment should be visible and attributable, not hidden.

---

## 6. Search and retrieval rule

The Interview module should distinguish:

- structured search over Interview data
- semantic retrieval over embedded knowledge

These are not the same product behavior and must not be confused.

---

## 7. Related canonical docs

- `INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md`
- `INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`

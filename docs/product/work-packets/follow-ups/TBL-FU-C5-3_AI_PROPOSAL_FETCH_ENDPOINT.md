# TBL-FU-C5-3 — Backend endpoint to fetch a proposal by id

**Filed during:** C-S5 (Block C · AI Operator frontend)
**Priority:** P1
**Owner:** Backend (table-platform)
**Status:** OPEN

## Context

`<ProposalDiffCard>` (C-S5) has a slot for an "operations preview"
that lists the structured ops the LLM produced. The data already
exists — `tp_schema_proposals.operations` is populated by
`TableAiEditorService.proposeEdit()`.

What's missing on the backend: a route to **read** a proposal by id
that returns the full envelope (operations, summary, warnings,
confidence, level, status). Today the AI Editor returns only
`{ proposalId, level, softWarn, handlerStatus }` from the propose
call, and the existing `chat-to-schema` proposal list endpoint
(`GET /workspaces/:id/schema/proposals`) returns a different shape.

## Scope

Add `GET /api/table-platform/ai-editor/proposals/:proposalId` that:

1. Resolves the proposal row by id.
2. Cross-checks the actor's organization through `tp_bases`.
3. Returns:
   ```json
   {
     "id": "...",
     "level": "cell",
     "status": "pending",
     "summary": "...",
     "operations": [{ "type": "op_cell_set", ... }, ...],
     "warnings": [...],
     "confidence": 0.82,
     "createdAt": "...",
     "createdBy": "...",
     "tableId": "..."
   }
   ```

Then, on the frontend, `<ProposalDiffCard>` calls this endpoint after
a successful propose so the operations preview list populates.

## Acceptance criteria

- `GET /api/table-platform/ai-editor/proposals/:proposalId` enforces
  auth + organization-scope.
- Response body matches the shape above.
- Frontend `<ProposalDiffCard>` reads `operations` and lists the first
  25 with a "+N more" rollup.
- Unit tests on the route cover happy path + cross-tenant 403 + 404.

## Why this is a follow-up, not part of C-S5

The propose / apply / reject pipeline is fully wired and audited.
C-S5's diff card already shows enough metadata (level, prompt,
proposalId, soft-warn, handler status) for the user to make a
go/no-go decision; the operations list is a nice-to-have that costs
one round-trip per proposal.

## Effort estimate

~2 hours backend + 1 hour frontend.

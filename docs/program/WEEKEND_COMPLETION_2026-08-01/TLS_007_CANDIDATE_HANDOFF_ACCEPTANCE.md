# TLS-07 — SWOT → canonical Candidate handoff

Status: `CODE_GO_FROZEN`

Date: 2026-08-02

Acceptance scope: local integration, no push and no deploy

## Accepted contract

- A Dynamic SWOT recommendation no longer creates an Initiative directly.
- The UI explicitly sends the recommendation to the Candidate Inbox and reports
  success only after the server confirms the durable write.
- The server accepts only an organization-owned `dynamic-swot` session.
- Candidate creation uses the shared `initiative_candidates` writer with
  `source_type='swot_recommendation'` and a stable
  `<toolSessionId>:<recommendationId>` source identity.
- Candidate and `swot_candidate_handoffs` receipt are written in one pinned
  PostgreSQL transaction.
- `(organization_id, tool_session_id, recommendation_id)` is the hard
  idempotency key; retries and concurrent clicks return the same Candidate.
- The SWOT surface does not mark the Candidate accepted and does not create an
  Initiative. The existing Candidate review/acceptance lifecycle remains owner
  of that transition.

## Evidence

- Real PostgreSQL acceptance: `8/8 PASS`
  - Candidate + durable receipt read-back;
  - retry returns the same Candidate without overwriting the first snapshot;
  - eight concurrent requests produce one Candidate and one receipt;
  - foreign tenant receives `404` and creates no row;
  - non-SWOT source is rejected;
  - HTTP first write `201`, retry `200`, same receipt and Candidate;
  - injected failure after Candidate insert rolls both Candidate and receipt back.
- Shared Candidate lifecycle regression: `38/38 PASS`.
- Full repository TypeScript check: `PASS`.
- Production Vite build: `PASS` (existing chunk-size warnings only).
- `git diff --check`: `PASS`.

## Files

- `server/migrations/20260802_tls007_swot_candidate_handoff.sql`
- `server/src/services/tools/swotCandidateHandoffService.ts`
- `server/src/controllers/ToolController.ts`
- `server/src/routes/tools.routes.ts`
- `src/services/api.ts`
- `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInsightsPhase.tsx`
- `tests/integration/tls-007-swot-candidate-handoff.realdb.test.ts`

## Remaining external gates

- Railway migration/deployment and demo smoke.
- No claim is made for `TLS-04`; that line remains independently owned and reviewed.

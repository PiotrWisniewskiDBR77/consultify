# P34-B — Policy gateway runtime verification (tests + staging proof)

Date: 2026-03-30
Branch: `ws/c-artifact-evidence`

## Scope
- Policy gateway runtime in `/api/ai/chat/stream`:
  - deny: refusal UX (+ “what to do next”)
  - allow: evidence posture for factful asks (citations or explicit uncertainty marker)
  - audit/log: policy decision + evidence validation notices
- Source ledger (P34-B):
  - `used_sources[]` + `blocked_sources[]` emitted as `type=source_ledger` (high-level, non-leaky)
  - explicit degraded marker when no sources in allowed scope
- Promotion workflow (P34-B, private→org):
  - `POST /api/v8/retrieval/memory/promotions` (submit)
  - `POST /api/v8/retrieval/memory/promotions/:requestId/resolve` (review/approve; admin-only)
- UI stream consumption: policy decision + notices propagated into message rendering.

## Evidence (local)

### Contract tests (decision payload)
- File: `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts`
- Command:

```bash
npx vitest run server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts
```

- Result: PASS (2026-03-30)
- Covers:
  - deny (prompt injection) → `allowed=false`, `rationale`, `refusal.nextSteps[]`
  - deny (sensitive data request) → `category=sensitive_data_request`
  - allow (factful ask) → `evidence.required=true`, `uncertaintyMarkerRequiredIfInsufficientEvidence=true`

### UI regression tests (refusal + uncertainty)
- File: `tests/components/AIChat/MessageRenderer.policy.test.tsx`
- Command: `npx vitest run tests/components/AIChat/MessageRenderer.policy.test.tsx`
- Result: PASS
- Covers:
  - deny: renders “Request blocked by policy” + “What to do next” + next steps
  - allow+uncertainty notice: renders “Uncertainty marker” + notice message
  - allow+no-sources notice: renders “No sources found” + non-leaky blocked-scope ledger

### V8 promotion route tests (private→org)
- File: `server/src/routes/v8/__tests__/retrieval.memory.routes.test.ts`
- Command:

```bash
npx vitest run server/src/routes/v8/__tests__/retrieval.memory.routes.test.ts
```

- Result: PASS (2026-03-30)

## Staging proof (script)

Target surface: AI chat streaming endpoint (`/api/ai/chat/stream`) via the app UI.

Staging script SSOT: `P34_B_SOURCE_LEDGER_AND_PROMOTION_RUNTIME_TESTS_AND_STAGING_PROOF_PLAN_2026-03-30.md`

### Steps 1–6 (contract-aligned)

1. Private-only query → verify `source_ledger` and non-leaky blocked scopes.
2. Org-only query → verify no private leakage.
3. Mixed query → verify explicit allowed vs blocked at high level.
4. Promotion submit → review → approve (private→org) with provenance.
5. Post-promotion query → verify promoted content is retrievable and ledger reflects it.
6. No-sources/no-access → verify explicit degraded marker + refusal UX.

## Known limits (bounded)
- Evidence policy is heuristic/bounded (focuses on “factful ask” detection + claim/citation coverage thresholds); it is additive (does not rewrite already-streamed content).


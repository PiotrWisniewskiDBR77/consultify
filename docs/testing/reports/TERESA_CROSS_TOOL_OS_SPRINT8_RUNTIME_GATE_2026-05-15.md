# Teresa Cross-Tool OS Sprint 8 Runtime Gate - 2026-05-15

## Verdict

`PASS_WITH_BUSINESS_MANUAL_FOLLOWUP`

Sprint 8 closes the developer-side runtime and contract preflight for Teresa cross-tool workflows. The P08 Teresa canon, service lifecycle, E2E lifecycle, V8 chat execution bridge, Wave 2 Anna/Teresa UI boundary, production build, and staging route/API probes pass.

Full Business Owner rehearsal remains intentionally open for logged-in conversational execution across Canvas, Tables, Documents, Presentations, Tasks, Initiatives, and Reports.

## Scope

- Teresa P08 canon: handoff targets, common context payload, proposal envelope, no silent writes, voice posture, citations, Anna/Teresa boundary, anti-duplicate gate, degraded posture, and acceptance checklist.
- Teresa runtime service: proposal creation, approval, rejection, execution, audit trail, write ownership, idempotency, degraded failure handling, and chat proposal envelopes.
- Cross-tool targets covered by P08: Radar, Initiatives, Calendar, Notebook, Interview, and Excele.
- V8 chat execution bridge: intent classification, context snapshot handoff, action proposal facade, org isolation, and auth enforcement.
- UI boundary: public Anna remains product-only; authenticated Teresa remains the tenant workspace assistant with honest voice UI.
- Staging route/API availability for Teresa and cross-tool surfaces.

## Validation Evidence

- Teresa backend gates -> `171/171 PASS`
  - `server/src/routes/v8/__tests__/p08-teresa-canon.test.ts`
  - `server/src/routes/v8/__tests__/p08-teresa-service.test.ts`
  - `server/src/routes/v8/__tests__/p08-teresa-e2e-lifecycle.test.ts`
  - `server/src/services/v8/__tests__/chatExecutionService.test.ts`
  - `server/src/services/v8/__tests__/chat-routes.test.ts`
- `npm run test:l4:local -- tests/e2e/smoke/wave-2-anna-teresa-voice.spec.ts` -> PASS
  - public Anna does not expose tenant context
  - authenticated `/chat` shows Teresa and honest voice UI
  - no raw ACL, tenant secret, or permission dump leaks in the UI
- Production build with `NODE_OPTIONS=--max-old-space-size=8192 npm run build` -> PASS

## Staging Route/API Probe

Target: `https://demo.consultify.ai`

- `GET /chat` -> `200`
- `GET /ai/chat` -> `200`
- `GET /my-work` -> `200`
- `GET /document-studio` -> `200`
- `GET /reports` -> `200`
- `GET /presentations` -> `200`
- `GET /execution` -> `200`
- `GET /initiatives` -> `200`
- `GET /api/v10/teresa/voice-config` unauthenticated -> `401 No token provided`
- `GET /api/v8/teresa/contract` unauthenticated -> `401 No token provided`
- `GET /api/v8/teresa/proposals` unauthenticated -> `401 No token provided`
- `GET /api/v8/chat/snapshots` unauthenticated -> `401 No token provided`
- `GET /api/v8/chat/handoffs?conversationId=__probe__` unauthenticated -> `401 No token provided`

The probe confirms the user-facing cross-tool surfaces render and Teresa/V8 chat APIs remain auth-gated.

## Remaining Risk

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` and raw Conversational Work OS notes remain part of Sprint 10 canon/documentation promotion work.
- The automated gate proves the governed Teresa contract and route availability, but not a full logged-in Business Owner conversational rehearsal across every target artifact type.
- Sprint 9 still needs Admin, Settings, RBAC denied-state UX, and governance control closeout before final global gate.

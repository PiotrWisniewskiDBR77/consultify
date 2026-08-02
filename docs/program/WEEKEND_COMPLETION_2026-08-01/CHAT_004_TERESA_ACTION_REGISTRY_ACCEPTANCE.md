# CHAT-04 — Teresa Action Registry acceptance

**Status:** `CODE_GO_FROZEN` (local acceptance)  
**Date:** 2026-08-02  
**Scope:** one governed executor for Teresa actions on the active Idea representation

## Accepted contract

- `IDEA_ACTION_REGISTRY` is the single catalog used to generate Teresa's tool manifest.
- The manifest is filtered by the currently open representation: Mind Map, Whiteboard, Process Flow or Table.
- The browser serializes OpenAI tool wrappers to the exact `{ name, description, parameters }` shape consumed by the server bridge.
- The server returns a client-tool call over SSE; the browser resolves it back to the registry and executes `runIdeaAction`, the same executor used by UI actions.
- Unknown/hallucinated tool names fail closed.
- Registry confirmation rules remain mandatory for Teresa-originated durable mutations.
- Governed transport is default ON on both frontend and backend. Legacy regex detectors are an explicit `false` kill-switch only and cannot intercept the same prompt while registry transport is enabled.

## Fixed gaps

1. Local Mind Map, Process Flow and Whiteboard regex handlers ran before the stream, so they bypassed the registry even when registry transport was enabled.
2. The transport's wrapper-to-server conversion was inline and untested; it is now an explicit, contract-tested boundary.
3. Both feature flags defaulted OFF, leaving the bypass as the operational path rather than a rollback path.

## Evidence

```text
tests/unit/actions/teresaActionManifest.test.ts
tests/unit/backend/featureFlagsTeresaIdeaActionsDefault.test.ts
tests/unit/mywork/ideaActionRegistryConfirmBeforeRun.test.ts
tests/unit/mywork/ideaActionRegistryElementAddLabel.test.ts
16 passed
```

The suite proves registry/manifest one-to-one parity, representation filtering, exact server transport shape, no simultaneous regex bypass, fail-closed unknown tools, default rollout posture and confirmation enforcement.

The full `UnifiedChatPanel` suite passes 30 functional tests; its one known split-resize assertion (`45` versus `64`) remains unrelated to CHAT-04 and is recorded rather than hidden.

## Remaining deployment gate

Railway requires an authenticated model-tool-call smoke on each representation and verification that both environment flags were not explicitly disabled. This is a deployment gate, not local code acceptance.

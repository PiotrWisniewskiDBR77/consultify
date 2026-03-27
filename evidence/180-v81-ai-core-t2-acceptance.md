# V8.1 Evidence - AI core T2 Acceptance

Date: 2026-03-26
Lane: `AI core`
Taxonomy: `T2`
Decision: `accepted`

## Acceptance basis

The promoted bounded `AI core` lane is now accepted because the active superadmin operator surface has a coherent
governed V8 read chain for the specific seam that justified promotion:

1. `AI Platform -> Operations` exposes a dedicated `AI core runtime` tab
2. the panel reads governed `environment` truth from `/api/v8/ai-core/environment`
3. the same panel reads the governed tool catalog from `/api/v8/ai-core/tools`
4. the same panel now reads effective tool policy from `/api/v8/ai-core/tools/:toolId/policy`
5. targeted regression protects the bounded operator-surface chain

This closes the promotion question for `AI core`: whether the existing governed runtime could be surfaced on a real
operator panel without reopening broader chat/AI architecture work.

## Accepted bounded scope

Accepted now:

- operator-facing `AI core` runtime summary
- operator-facing governed tool catalog
- operator-facing governed tool-policy readback

Explicitly not required for this bounded acceptance:

- trust/provenance workflow exposure
- broader chat-turn UI adoption
- policy-write tooling or deeper AI-operations lifecycle controls

## Evidence chain

- `evidence/177-v81-ai-core-split-brain-map.md`
- `evidence/178-v81-ai-core-runtime-operator-exposure-seam.md`
- `evidence/179-v81-ai-core-tool-policy-readback-seam.md`

## Verification

- `npx vitest run tests/components/Admin/AI/AICoreRuntimePanel.test.tsx tests/components/SuperAdmin/AIPlatformModule.test.tsx`

## Residual follow-up

Any further `AI core` work is now broader parity expansion, not a blocker for the bounded accepted lane.

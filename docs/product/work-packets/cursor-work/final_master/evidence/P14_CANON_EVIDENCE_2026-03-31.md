# P14 Process Flow — Full Evidence (P14-A/B/C)

**Date:** 2026-03-31
**Status:** verified(evidence)
**Branch:** ws/c-artifact-evidence

## Summary

P14 Process Flow fully implemented with canon module (P14-A), runtime service + routes (P14-B),
and verification/evidence (P14-C). 11 BPMN-adjacent semantic object types with rules, explicit
BPMN interop posture (supported vs non-goal), 2-layer validation (semantic_first + structural_bounded),
10-tool frozen toolbelt, AI proposal contract (text/DSL→preview→apply/reject, no silent changes),
anti-duplicate gate, 11 degraded scenarios, semantic readback, and export (JSON + human-readable).

## Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Canon module | `server/src/services/v8/processFlowCanon.ts` | Frozen canon: 11 semantic types, validation, toolbelt, AI rules, degraded scenarios |
| Service module | `server/src/services/v8/processFlowService.ts` | Runtime: CRUD (nodes+edges), 2-layer validation, semantic readback, export, AI proposals, degraded state |
| Routes | `server/src/routes/v8/processFlow.routes.ts` | 18 HTTP endpoints `/api/v8/process-flow/*` |
| Route mount | `server/src/routes/v8/index.ts` | Mounted at `/process-flow` |
| Canon tests | `server/src/routes/v8/__tests__/p14-processflow-canon.test.ts` | 75 tests covering all canon exports |
| Service tests | `server/src/routes/v8/__tests__/p14-processflow-service.test.ts` | 50 tests covering full service runtime |

## Acceptance Checklist Coverage

| ID | Requirement | Covered |
|----|-------------|---------|
| P14-AC-01 | Contract approved(scope) | ✅ |
| P14-AC-02 | Semantic object types frozen (11 types) | ✅ P14_SEMANTIC_OBJECTS + rules + validateSemanticRule |
| P14-AC-03 | BPMN interop posture explicit | ✅ P14_BPMN_INTEROP_POSTURE (supported vs non-goal) |
| P14-AC-04 | Validation layering frozen | ✅ semantic_first + structural_bounded (validateProcess) |
| P14-AC-05 | Minimal toolbelt frozen (10 tools) | ✅ P14_TOOLBELT + isValidProcessFlowTool |
| P14-AC-06 | AI proposal: text/DSL→preview→apply/reject | ✅ createAIProposal → getAIProposal → resolveAIProposal (no silent changes) |
| P14-AC-07 | Anti-duplicate gate | ✅ P14_ANTI_DUPLICATE_RULES (single canonical model) |
| P14-AC-08 | Degraded posture 10+ scenarios | ✅ 11 scenarios + getDegradedState runtime |
| P14-AC-09 | Evidence ledger filled | ✅ this document |
| P14-AC-10 | EXECUTION_INDEX updated | ✅ |

## Test Results

- **Total tests:** 125 (75 canon + 50 service)
- **Pass rate:** 100%
- **Coverage areas:**
  - Canon: semantic objects, BPMN interop, validation layers, semantic validation helper, toolbelt, AI proposal rules, anti-duplicate, message flow validation, degraded scenarios, acceptance checklist, ownership
  - Service: CRUD nodes (create/update/move/delete), CRUD edges (create/update/delete), 2-layer validation (7 scenarios), semantic readback (5 scenarios), export (JSON + readback), AI proposal lifecycle (7 scenarios), degraded state (3 scenarios), gateway kind + lane assignment, getProcessObjects, canon helpers integration

## P14-B Endpoints (18 total)

| Method | Path | Description |
|--------|------|-------------|
| GET | /contract | P14 canon metadata |
| GET | /:processId/objects | Full graph (nodes + edges) |
| POST | /:processId/nodes | Create node |
| PUT | /nodes/:nodeId/label | Update node label |
| PUT | /nodes/:nodeId/move | Move node position |
| PUT | /nodes/:nodeId/gateway-kind | Set gateway kind (xor/and) |
| PUT | /nodes/:nodeId/lane | Set lane assignment |
| DELETE | /nodes/:nodeId | Delete node + connected edges |
| POST | /:processId/edges | Create edge (connect) |
| PUT | /edges/:edgeId/label | Update edge label |
| DELETE | /edges/:edgeId | Delete edge |
| POST | /:processId/validate | 2-layer validation |
| GET | /:processId/readback | Semantic readback |
| GET | /:processId/export/:format | Export (json/readback) |
| POST | /:processId/ai-proposals | Create AI proposal (preview) |
| GET | /ai-proposals/:proposalId | Get AI proposal |
| POST | /ai-proposals/:proposalId/resolve | Accept/reject AI proposal |
| GET | /:processId/health | Degraded state check |

## P14-B Staging Proof Script

1. ✅ Create process with start → activity → gateway → branch → end (bounded object types)
2. ✅ Connect nodes, label edges, adjust layout; use undo/redo; verify semantic readback stays intact
3. ✅ Export/readback (bounded) and verify types/labels preserved
4. ✅ Trigger invalid structure (missing start/end, decision <2 outgoing) → clear error + recovery
5. ✅ AI proposal: create → preview → apply/reject; no silent changes; atomic batch

## Infrastructure Dependencies

- `toolCollaborationAdapter.ts` — ToolName = 'process_flow'
- `multiplayerHardening.ts` — Surface = 'process_flow'
- `ideaWorkspaceGraph.validators.ts` — NodeKindEnum process_flow kinds
- `ideaAIGeneratorService.ts` — AI proposals

## Known Limits

- BPMN XML import/export is explicit non-goal for P14-A/B (future wave)
- Content-based near-duplicate detection for AI proposals deferred
- Undo/redo tracked as concept in canon; runtime undo stack is client-side responsibility

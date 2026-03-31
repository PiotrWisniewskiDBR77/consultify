# P12-B/C Verification — Mindmap Builder Runtime Closure

**Date**: 2026-03-31
**Packet**: P12-B (builder toolbelt + state trust) + P12-C (verification)
**Status**: verified(evidence)

## Technical closure

### P12-B: Runtime Implementation

1. **Mindmap Service** — `server/src/services/v8/mindmapService.ts`
   - `getNodes` — fetch all nodes for a mindmap with degraded fallback
   - `createNode` — create root/child/sibling with CALM anchor rules
   - `renameNode` — inline rename with anchor preservation
   - `moveNode` — reparent with `wouldCreateCycle` validation
   - `deleteNode` — subtree delete with `resolveDeleteAnchor`
   - `toggleCollapse` — collapse/expand without data loss
   - `exportMindmap` — JSON + Markdown export via canon helpers
   - `createAIProposal` / `resolveAIProposal` — AI co-building lifecycle
   - `validateOperation` — pre-flight validation for all operations
   - `getDegradedState` — 500-node limit check + table existence
   - `getContract` — returns full P12 canon

2. **Mindmap Routes** — `server/src/routes/v8/mindmap.routes.ts` (12 endpoints)
   - `GET /:mindmapId/nodes` — list nodes
   - `POST /:mindmapId/nodes` — create node
   - `PUT /nodes/:nodeId/rename` — rename
   - `PUT /nodes/:nodeId/move` — move/reparent
   - `DELETE /nodes/:nodeId` — delete subtree
   - `PUT /nodes/:nodeId/collapse` — toggle collapse
   - `GET /:mindmapId/export/:format` — export
   - `POST /:mindmapId/ai-proposals` — create AI proposal
   - `POST /ai-proposals/:proposalId/resolve` — accept/reject
   - `POST /:mindmapId/validate` — validate operation
   - `GET /:mindmapId/health` — degraded state
   - `GET /contract` — full canon

3. **Migration** — `server/migrations/20260331_v8_mindmap_nodes_p12b.sql`
   - `v8_mindmap_nodes` — nodes with hierarchy, kind, collapse, metadata
   - `v8_mindmap_ai_proposals` — AI proposal storage

4. **Canon** — `server/src/services/v8/mindmapCanon.ts` (unchanged, already complete)
   - 8 node operations, 7 node kinds, 8 CALM loop rules
   - 2 export formats, 4 export rules
   - 6 AI co-building rules, 4 undo/redo rules
   - 9 degraded scenarios, 10 acceptance checklist items
   - Helpers: wouldCreateCycle, resolveDeleteAnchor, exportToMarkdown

### P12-C: Verification
- Contract tests: `tests/integration/p12-mindmap-builder.contract.test.ts` (21 tests)
- Existing canon tests: `server/src/routes/v8/__tests__/p12-mindmap-canon.test.ts` (15+ tests)

## Staging checklist
- [x] Create root + child + sibling nodes via API
- [x] Cycle detection blocks invalid reparent
- [x] Delete subtree with proper anchor resolution
- [x] Export JSON + Markdown preserves hierarchy
- [x] AI proposal create/resolve lifecycle
- [x] Degraded state detection (500-node limit, table missing)
- [x] Contract endpoint returns full canon

## Rollback plan
- Disable mindmap routes; preserve existing IdeaWorkspace mindmap UI
- No data destruction — migration is additive

## Known limits
None — all P12 contract §2.3 requirements implemented with runtime services.

# V8.1 Multiplayer / Collaboration Split-Brain Map

Date: 2026-03-26
Lane: `Multiplayer / collaboration`
Taxonomy: `T2`
Status: `active`

## Why this lane is promotable

Multiplayer already has a governed V8 read bridge plus staging continuity on a live operator-facing
surface, but active collaboration indicators and broader realtime behavior still mix persisted V8
substrate truth with legacy or bespoke polling semantics.

## Current split-brain map

1. Governed V8 collaboration substrate
   - `src/services/api/v8/multiplayer.ts`
   - `server/src/routes/v8/multiplayer.routes.ts`
   - governed reads already exist for room mappings, room binding, room presence, and active locks

2. Live operator continuity
   - `src/components/Admin/UnifiedSyncHub.tsx`
   - the `Sync Health` tab already renders governed collaboration substrate, workspace presence, and active locks
   - staging proof exists in `evidence/48-v8-multiplayer-presence-locks-ui-proof.md`

3. Legacy / bespoke collaboration indicator plane
   - `src/components/MyWork/table/CollaborationPresence.tsx`
   - `src/components/MyWork/IdeaTableTool.tsx`
   - `CollaborationPresence` still uses bespoke `Api.broadcastIdeaPresence()` and `Api.getIdeaPresence()` polling rather than the governed V8 multiplayer bridge

4. Broader realtime depth mismatch
   - `src/hooks/useAssessmentCollaboration.tsx`
   - websocket transport, heartbeats, editing semantics, and broader collaborative workflow behavior remain outside the current governed bridge
   - the current V8 namespace is a persisted read bridge, not full realtime parity

## Bounded first packet

Start with `workspace tool header presence indicator slice`:

- add one governed V8-first collaboration presence indicator on an active workspace header-level surface
- build on existing room-binding and presence reads from `/api/v8/multiplayer`
- keep websocket transport, lock mutations, and collaborative editing semantics outside this first packet

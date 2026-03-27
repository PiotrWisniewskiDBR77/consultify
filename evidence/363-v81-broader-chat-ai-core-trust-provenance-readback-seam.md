## V8.1 Evidence - broader `Chat / AI core` parity expansion - trust/provenance readback seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Chat / AI core` parity expansion
Status: `active`

### Packet

`trust/provenance readback seam`

### Why this packet

After the turn-level stream-session continuity closure, the next smallest honest broader chat/AI-core packet was not another write path. It was a visible operator readback seam: the governed V8 trust endpoints already existed, but the active AI-core runtime panel only exposed environment and tool-policy readback.

That left trust and provenance in a split-brain state:

1. runtime support already had governed V8 endpoints for audit-trail and provenance lookups
2. the active operator surface did not consume them
3. broader AI-core parity could therefore look more complete in backend contract space than in the actual superadmin runtime surface

This packet stays bounded because it adds read-only continuity to an existing operator panel without broadening into a full AI-platform redesign or new trust workflow.

### What changed

1. extended `src/components/Admin/AI/AICoreRuntimePanel.tsx` with a read-only `snapshotId` probe for governed trust readback
2. wired the panel to `V8AICoreApi.getAuditTrail()` and `V8AICoreApi.getProvenance()`
3. rendered bounded support-trace and provenance-ledger summaries on the existing operator surface
4. added focused regression coverage in `tests/components/Admin/AI/AICoreRuntimePanel.test.tsx` for snapshot-scoped trust/provenance readback

### Verification

- `npx vitest run tests/components/Admin/AI/AICoreRuntimePanel.test.tsx`
- `ReadLints` clean for:
  - `src/components/Admin/AI/AICoreRuntimePanel.tsx`
  - `tests/components/Admin/AI/AICoreRuntimePanel.test.tsx`

### Result

The active broader chat/AI-core lane now has a second real bounded packet. The existing AI-core runtime operator surface can read governed trust and provenance for a snapshot/output id instead of stopping at environment and tool-policy status, so backend trust authority and visible operator readback are now aligned on one bounded seam.

# TBL-FU-C6-2 — Automatic Pack Usage Counter from AI Editor

**Source sprint:** Block C / C-S6
**Filed:** 2026-05-08
**Priority:** P2
**Status:** `OPEN`
**Owner:** TBD (Agent A · backend)

## Why this exists

`SourcePackBuilderService.markPackUsed(packId, organizationId)` is wired but no caller invokes it yet. Pack analytics will stay at `used_count = 0` until we call it from the AI Editor when a proposal that references `payload.sourcePackId` is applied.

## Scope

1. In `TableAiEditorService.applyProposal(...)`, after successful application:
   - If the proposal payload contains `sourcePackId`, call `sourcePackBuilderService.markPackUsed(packId, organizationId)`.
   - Tolerate non-existent packs (log + continue) so AI apply never fails because of an analytics counter.
2. Add a unit test that verifies the counter is bumped exactly once per apply.
3. (Optional) surface a "Used N times" pill on the saved-pack list in `<TabeleSourcePackPanel>` after a refresh.

## Out of scope

- Per-record source attribution (the V8 snapshot already captures who/when).
- Reverting the counter on AI Editor `rejectProposal` — counter is "used in apply", not "considered".

## Definition of done

- AI Editor apply increments `tp_source_packs.used_count` exactly once per pack-bearing proposal.
- Unit tests cover both the success path and the "pack disappeared" path.

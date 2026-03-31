# P07-B/C Verification — Notebook Canon + Capture/Search/Linking

**Date**: 2026-03-31
**Packet**: P07-B (canon module + capture/search/linking) + P07-C (verification)
**Status**: verified(evidence)

## Technical closure

### P07-B: Canon Module + Service Closure

1. **Notebook Canon** — `server/src/services/v8/notebookCanon.ts`
   - §2.3.1: 11 bounded capture entries + 4 open entries + 2 forbidden patterns
   - §2.3.2: Durable identity via UUID `note_id` + stable deeplink contract
   - §2.3.3: Provenance language (`source`, `user_edit`, `ai_transform`) with no-silent-loss rules
   - §2.3.4: 6 attachment lifecycle states + 9 error taxonomy entries (retryable/non-retryable)
   - §2.3.5: 14 declared search filters + 7 operator hints + 10 result contract fields
   - §2.3.6: 3 handoff targets (Radar/Inicjatywy/Teresa) with 18 common fields + per-target extensions
   - §2.3.7: 4 anti-duplicate rules (attachments/search/inbox/links)
   - §2.3.8: 10 degraded scenarios with userVisibleState + nextAction
   - §2.3.9: 11-point acceptance checklist matching contract

2. **Existing Services** — verified coherent with canon:
   - `server/src/services/notebookService.ts` — capture (4 connectors), ingestion pipeline, semantic search, RAG, AI proposals, embed chips
   - `server/src/services/notebookAttachmentService.ts` — attachment CRUD, CAS mutations, retry (3 attempts), cleanup
   - `server/src/services/notebookSourceFileService.ts` — source file persistence
   - `server/src/services/notebookConversionService.ts` — conversion to task/decision/initiative/report/presentation/assessment
   - `server/src/routes/notebook.routes.ts` — V4 routes (capture/search/RAG/AI proposals/embed chips)

3. **Non-goals** — explicit:
   - No Notion "databases-as-product" parity
   - No new top-level module outside My Work
   - No silent AI writing
   - No full Evernote search grammar
   - No OCR/recognition without explicit scope extension

### P07-C: Verification

- Canon unit tests: `server/src/routes/v8/__tests__/p07-notebook-canon.test.ts`
  - 30+ test cases covering all 11 acceptance checklist items
  - Service integration tests with mock DB (capture, attachment, search)
  - Cross-coherence checks (canon ↔ service types)

## Staging checklist

- [x] Capture entries bounded and listed (§2.3.1)
- [x] note_id as durable identity + stable deeplink (§2.3.2)
- [x] Provenance language with "no silent loss" rules (§2.3.3)
- [x] Attachment lifecycle states + error taxonomy + retry (§2.3.4)
- [x] Search baseline with declared filters (§2.3.5)
- [x] Handoff payload for Radar/Inicjatywy/Teresa (§2.3.6)
- [x] Anti-duplicate gate (4 rules) (§2.3.7)
- [x] Degraded posture (10 scenarios) (§2.3.8)
- [x] Non-goals explicit (§2.2)
- [x] No parallel truth vs SSOT (§3)
- [x] Evidence ledger filled (§10)

## Rollback plan

- Disable notebook canon import; preserve existing notebook service
- No data destruction — canon is additive constants module

## Known limits

- Attachment lifecycle states in canon are a superset of current runtime states (existing service uses simpler model); runtime alignment is incremental
- Search operator hints are declared but not all implemented in current FTS path — bounded baseline for v8
- Handoff payloads are declared contracts; runtime handoff implementation depends on P06/P08/P11 availability

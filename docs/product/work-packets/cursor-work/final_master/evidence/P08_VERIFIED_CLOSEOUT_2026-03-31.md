# P08 Teresa (AI Copilot) — Verified Closeout

Date: 2026-03-31  
Status: `verified(evidence)`  
Branch: `ws/c-artifact-evidence`

## 1. Scope delivered

### P08-A — Teresa canon + boundaries (scope approval, docs-only)
- P0 handoff targets frozen (4): Radar/P06, Inicjatywy/P11, Kalendarz/P02, Notatki/P07
- Common payload (`teresa_handoff_context`) with 11 required fields
- Per-target required additions (bounded)
- Action governance envelope: proposal → pending_approval → approved → executing → completed → rejected
- Voice posture: availability/degraded/unavailable + fallback to text + 4 recovery grammar phrases
- Evidence/citations posture: cited or uncertain, no overclaim
- Hard boundary Teresa vs Anna (separate runtimes, no bypass)
- Module-owned writes: Teresa initiates, module writes
- Anti-duplicate gate: P17 grammar source, near-duplicate detection
- Degraded posture: 10 scenarios (exceeds 8 minimum)
- Acceptance checklist: 12 testable items

### P08-B — Cross-surface handoff + action governance closure
**New artifacts:**
- `server/src/services/v8/teresaCopilotCanon.ts` — canonical types and constants:
  - `TeresaHandoffContext` — common payload type
  - `RadarHandoffPayload`, `InitiativesHandoffPayload`, `CalendarHandoffPayload`, `NotebookHandoffPayload` — per-target types
  - `P08_HANDOFF_TARGETS` — frozen target definitions with required fields
  - `P08_ACTION_ENVELOPE_STATES` + `P08_ACTION_ENVELOPE_TRANSITIONS` — governance state machine
  - `P08_ACTION_ENVELOPE_RULES` — 6 hard rules (approve≠review, no silent writes, no parallel approvals, idempotency, truth-preserving failure, audit required)
  - `P08_VOICE_POSTURE` — availability states, fallback, recovery grammar
  - `P08_CITATION_POSTURE` — explicit sources, missing source boundary, uncertainty marker
  - `P08_ANNA_BOUNDARY` — Teresa vs Anna scope/can/cannot + no bypass
  - `P08_WRITE_OWNERSHIP` — initiator vs writer roles + forbidden patterns
  - `P08_ANTI_DUPLICATE_RULES` — grammar source, payload core, near-duplicate detection
  - `P08_DEGRADED_SCENARIOS` — 10 scenarios with visible state + safe next action
  - `P08_ACCEPTANCE_CHECKLIST` — 12 testable items
  - Helper functions: `validateHandoffContext()`, `validateTargetPayload()`, `isValidEnvelopeTransition()`, `resolveVoiceAvailability()`, `validateWriteOwnership()`

**Existing artifacts leveraged (not modified):**
- `server/src/services/ai/virtualWorkerService.ts` — worker CRUD (Teresa is a worker slug)
- `server/src/services/ai/virtualWorkerConversationLogger.ts` — conversation logging
- `server/src/services/ai/virtualWorkerKnowledgeService.ts` — knowledge assignments
- `server/src/services/ai/virtualWorkerInsightsEngine.ts` — insights generation
- `server/src/routes/virtual-workers.routes.ts` — admin routes
- `server/src/services/ai/promptAssistant.ts` — prompt assistant
- `src/components/AIChat/teresaRuntimeCopy.ts` — frontend runtime

### P08-C — Verification + rollout
- All 12 acceptance criteria checked (§2.3.8)
- Evidence ledger filled for P08-A/B/C
- 0 test failures

## 2. Test inventory

| Suite | Tests | Status |
|-------|-------|--------|
| P08 §2.3.1 — Handoff targets | 5 | PASS |
| P08 §2.3.1 — Payload validation | 4 | PASS |
| P08 §2.3.2 — Action governance envelope | 7 | PASS |
| P08 §2.3.3 — Voice posture | 6 | PASS |
| P08 §2.3.4 — Citations posture | 3 | PASS |
| P08 §2.3.5 — Teresa vs Anna boundary | 6 | PASS |
| P08 §2.3.6 — Anti-duplicate gate | 2 | PASS |
| P08 §2.3.7 — Degraded posture | 6 | PASS |
| P08 §2.3.8 — Acceptance checklist | 5 | PASS |
| P08 — Contract identity | 1 | PASS |
| **P08 subtotal** | **45** | **PASS** |

## 3. §2.3.8 Acceptance checklist (12/12)

1. [x] P0 targets list (3-5) frozen: Radar/P11/P02/P07
2. [x] Each target has required payload: common teresa_handoff_context + per-target additions
3. [x] Action envelope: proposal→explicit approval→execution→audit/traces (per P17)
4. [x] approve(run) ≠ review(artifact) is explicit; no silent writes
5. [x] No parallel approvals is a hard rule (anti-duplicate governance)
6. [x] Voice posture: availability + fallback to text + recovery grammar
7. [x] Evidence pointers/citations posture is explicit; missing source = uncertainty boundary
8. [x] Hard boundary vs Anna/public assistant is documented; no bypass
9. [x] Module-owned writes: Teresa initiates handoff, not owner of writes
10. [x] Degraded/error posture has minimum 8 scenarios with safe next action (10 delivered)
11. [x] Anti-duplicate: near-duplicate stop + merge/select-canonical
12. [x] Evidence ledger filled for P08

## 4. Known limits

- Voice runtime depends on browser MediaStream API and network conditions; availability is declared, not guaranteed
- Handoff depth to target modules depends on those modules' own readiness (P06/P11/P02/P07)
- Near-duplicate detection is contract-level; runtime implementation depends on embedding/similarity service
- Context compaction strategy for long conversations is declared but bounded to future iteration
- Recovery grammar phrases are frozen in Polish; i18n extension is a future task

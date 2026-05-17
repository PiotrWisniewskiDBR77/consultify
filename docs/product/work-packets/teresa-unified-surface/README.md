# Teresa Unified Conversation Surface — Work Packet Index

**Block ID:** `TERESA_UNIFIED_SURFACE_PHASE_1`
**Phase:** 1 of 5 (Binding layer; pre-removal of module-local UI)
**Created:** 2026-05-08
**Status:** `PLANNED — awaiting product go-ahead and Antygravity P2 prioritization`
**Owner (delivery):** Frontend / AI Surface
**Owning SSOT:** `DRD/consultify/docs/product/UNIFIED_CONVERSATION_SURFACE_TERESA_SSOT.md`

## Purpose

Architectural debt: today the app exposes three parallel conversation surfaces (Teresa, module-local prompts, in-tool "Agent AI" panels). Decision is locked in the SSOT above: there is exactly one conversation surface — Teresa. Every module that wants to "talk to AI" binds into Teresa instead of growing its own chat.

This packet plans **Phase 1** only: the binding layer that makes Teresa context-aware of the active module/artifact and lets modules publish suggested actions and intent handlers to her. **No module-local UI is removed in Phase 1.** Removal happens in Phase 2 (Prezentacje first), once the binding is live and proven.

The packet is the actionable plan agents follow when product approves Phase 1 kick-off. Until then it is a frozen design + decision register that prevents parallel teams from re-introducing local chats.

## Source-of-truth crosslinks (mandatory read order before edits)

1. `README.md` (repo root)
2. `.cursor/SOURCE_OF_TRUTH_INDEX.md`
3. `.cursor/REPO_STRUCTURE_AND_CLASSIFICATION.md`
4. `.cursor/CONSULTIFY_AI_DELIVERY_OS.md`
5. `.cursor/OPUS47_DELIVERY_PROCEDURE.md`
6. `.cursor/TASK_PACKET_TEMPLATE.md`
7. `.cursor/SPRINT_GATE_CHECKLIST.md`
8. `.cursor/BLOCK_CLOSEOUT_TEMPLATE.md`
9. Domain SoT (this packet):
   - `DRD/consultify/docs/product/UNIFIED_CONVERSATION_SURFACE_TERESA_SSOT.md` (canonical)
   - `DRD/consultify/docs/product/CANVAS_SOURCE_OF_TRUTH.md`
   - `DRD/consultify/docs/product/PREZENTACJE_V8_AI_GOVERNANCE.md` (gate present)
   - `DRD/consultify/docs/product/work-packets/follow-ups/TBL-FU-3_WORDY_EXCELE_PREZENTACJE_PRODUCTIONIZE.md` (gate present)
   - `DRD/UI_UX_SOURCE_OF_TRUTH.md`
   - `DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
   - `.cursor/rules/ai-actions-menu3.mdc`

## Files in this packet

| # | File | Purpose |
|---|---|---|
| — | `README.md` | This index |
| 00 | `00_TASK_PACKET.md` | Phase 1 task packet (goal/non-goals/scope/DoD) |
| 01 | `01_VALIDATION_MATRIX.md` | Test types × scopes × commands; maps SSOT §9 to concrete files |
| 02 | `02_RISK_REGISTER.md` | Technical / product / security risks + rollback |
| 03 | `03_DECISIONS_REQUIRED.md` | Three open questions from SSOT §12 with proposed answers (product approval needed) |
| 04 | `04_BLOCK_CLOSEOUT.md` | Placeholder for Phase 1 closeout report |

## Phase map (governed by SSOT §7)

| Phase | Scope | This packet covers |
|---|---|---|
| 0 | Freeze: SSOT + gates in adjacent SoTs | DONE (2026-05-08) |
| **1** | **Binding layer: `ChatSurfaceContext`, `useTeresaModuleBinding`, `ContextBadge` extension, `ChatSmartSuggestions` source swap. Additive only — no removal.** | **YES (this packet)** |
| 2 | Prezentacje first: remove `/prezentacje` module-local prompt, convert `DeckBuilder/AgentPanel` to passive history view | Out of scope |
| 3 | Wordy + Excele on the new contract | Out of scope |
| 4 | Tabele + Canvas + Document Studio | Out of scope |
| 5 | Cleanup: dead code removal, prop pruning, plan updates | Out of scope |

## Gate to enter Phase 1 execution

Phase 1 is **PLANNED**. Before any code is written, all of the following must be GREEN:

1. Product approval on `03_DECISIONS_REQUIRED.md` (three open questions resolved).
2. Antygravity P2 backlog from current presentations bug-bashes is prioritized — Phase 1 must not collide with a P0/P1 regression sprint.
3. SSOT §11 (Handoff) is acknowledged by every parallel agent currently working in Wordy / Excele / Tabele / DeckBuilder / Document Studio (read-receipt or PR comment is enough).
4. Validation matrix (`01_VALIDATION_MATRIX.md`) is reviewed by QA owner so test ownership is assigned before sprints start.

If any of (1)–(4) is RED, Phase 1 stays in `PLANNED` state. The packet itself stays valid; only the kick-off is deferred.

## Execution contract (binding for whichever agent picks Phase 1 up)

1. Follow `00_TASK_PACKET.md` exactly. No scope expansion into Phase 2 ("just remove the input while we're here") under any circumstances.
2. Do not touch files listed as "explicitly untouched" in `00_TASK_PACKET.md` §4.
3. No unrelated refactors.
4. Apply governance invariant: `proposal → approval → execution → audit`.
5. Enforce tenant/ACL boundaries on every action surfaced by Teresa (deny-by-default per `.cursor/rules/40-security-tenancy.mdc`).
6. Menu 3 placement (`ai-actions-menu3.mdc`) still applies for non-conversational AI actions; conversational entry is Teresa.
7. Run validation matrix before claiming PASS.
8. If a hard-stop condition appears (architecture change, scope expansion into Phase 2, security ambiguity, SoT conflict): STOP and request approval.

## Audit trail

- 2026-05-08 — Packet created. Phase 0 (freeze) closed in SSOT and adjacent gates. Phase 1 plan + decisions register prepared. Awaiting product go-ahead.

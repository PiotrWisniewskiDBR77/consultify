# STAGE-1 / DEC-539 fix — readback

Verdict: **READY FOR CTO REVIEW** for code, migration and RealPG behaviour. The saved browser matrix remains partial: the existing ON/light list capture is present; the current list and card were also inspected in the local built harness, but the browser controller refused persistence of additional captures.

## Regression closure from Wpis 105

- `reportInitiativeService` rejects an unknown lifecycle target before dereferencing it; server TypeScript is back to **0** errors.
- A status-only writer no longer lowers a precise stage inside the same seven-code group.
- A write to `ie_aggregate_state.payload_json.lifecycleState` synchronizes the persisted stage, so aggregate `SCHEDULED` wins over the lossy `APPROVED_BACKLOG` projection.
- `PENDING_APPROVAL -> READY_FOR_DECISION` and `CLOSED -> CLOSED` are aligned with the client mapping; the parity family covers 12->7, 7->12 and the legacy bridge.
- Backfill disables the compatibility trigger, captures the complete status denominator before/after, emits `STAGE-1 status counts before/after: unchanged`, and aborts on drift.
- `PROPOSED` and terminal `REJECTED` remain visible as dispositions when the twelve-stage UI is ON.
- `VITE_INITIATIVES_STAGES_12` is exact-true and default OFF; Docker ARG/ENV guard passes. OFF retains the seven-code list/Menu 3 contract, ON exposes the twelve stages plus dispositions.

## Real PostgreSQL

- Isolated database: `stage1_fix_fresh` on `cx-codex6-pg` (`6457`), recreated from the strict migrated `cx6_swieza` template.
- Fresh application: 12 existing initiatives mapped, zero compatibility-status changes.
- No-op rerun: aggregate update **0**, mapped update **0**, status counts unchanged, both triggers present exactly once.
- Behaviour suites: **3 files, 15/15 passed**, `--retry=0`: H1c lifecycle transition, H1d GO gate/auto-start and the two-store reconciliation family.
- The six W105 red behaviours are green: `SCHEDULED` is retained, no-GO remains blocked, the cron sees one scheduled candidate, current GO starts execution, and all four two-store assertions pass.

## Static and unit gates

- Importer/regression family: **10 files, 46/46 passed**, `--retry=0`.
- Frontend full TSC on base `9981c41c2d`: **169** errors; candidate: **167** errors. Delta: **-2**, no new TypeScript regression.
- Server full TSC: **0** errors.
- Docker flag gate: `analyzedFlags=195`, `dockerArgs=206`, `brakujace=0`.
- Per-file esbuild: nine changed runtime entry points passed.
- `git diff --check`: passed.

## Browser evidence

- Existing saved evidence: `initiatives-12-stage-dropdown-en-light-1440x900.png` (ON/light list, exact twelve-stage vocabulary).
- Local harness inspection: ON/light list and initiative card rendered from the current candidate at `http://localhost:4214`.
- **EVIDENCE_MISSING:** additional persisted ON dark list/card and OFF list captures. The in-app browser rendered the surfaces, but its security policy rejected the only available local transfer path for saving the controller screenshot bytes. No alternate UI automation was used.

No staging write, deployment, Railway change, or protected-branch push was performed.

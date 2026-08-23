# Consultify final MVP — remaining 9 control register

Date: 2026-08-23  
Branch: `codex/wave3-16-module-acceptance-20260821`  
Reconciled baseline: `04e094d1f54bcf513564673b91bc456c9c942944`  
Production and Railway mutation authority: `NOT_AUTHORIZED`

## Current control state

- The authoritative denominator remains `82`: `73 DONE_CURRENT_SHA / 9 PARTIAL`.
- Evidence packets are complete and structurally valid: `0` missing, `0` invalid.
- The recovered owner-fixture database denominator is `16/16 PASS`, with 16
  unique databases, 16 unique ownership nonces, `0600` manifests, durable SQL
  markers and `831` migrations each.
- The Wave 3 desktop browser denominator is `16/16` across the exact-SHA
  candidate lineage. This is technical evidence, not Piotr owner acceptance
  and not one frozen-final-SHA regression.
- The full transformation lineage was requalified on a fresh isolated
  831-migration PostgreSQL database: `6/6` files and `87/87` active tests PASS;
  one source-declared retired legacy test remained skipped.

## Remaining nine

| Task | Current truthful state | Repository work left | External gate | Next closure action |
| --- | --- | --- | --- | --- |
| `FIN-MVP-CUTOVER-001` | `PARTIAL / CODE_DENOMINATOR_CLOSED` | Exact registry proves `50/50` legacy mutation doors retired and `0` open. No new successor should be invented. | Authorized rollout/usage window and Finance–Results ownership decision. | Preserve cutover OFF/default-safe; prepare rollout telemetry packet, then request the exact owner decision before any environment change. |
| `FIN-UI-CANON-001` | `PARTIAL / CURRENT_STATEMENTS_PASS` | Run all five Finance workspaces, states and accessibility cells on one frozen final SHA. Current recovered Statements readback is PASS; older five-workspace G4 is historical. | Final owner/internal-beta acceptance boundary; production remains separate. | Include full Finance G4 in the final-candidate browser matrix. |
| `MAT-POL-001` | `PARTIAL / READY_FOR_RIGHTS_INPUT` | Fail-closed provenance/quarantine controls exist; no code can manufacture missing rights evidence. | Legal/Procurement approval for layout, fonts, images, redistribution, renderer, DPA/residency/SLA/cost. | Present a bounded rights matrix; keep unknown templates quarantined and external providers OFF. |
| `AUD-POL-001` | `PARTIAL / READY_FOR_EXTERNAL_GATE` | Current 831-migration requalification passed scheduler/cursor/fence controls `26/26`. Browser denial of every external-standard entry remains part of final acceptance. | Authorized environment flag, observed ticks/telemetry and Methodology/Rights/Legal acceptance. | Keep default OFF; prepare exact flag/telemetry runbook and owner sign-off packet. |
| `ADM-MVP-BACKUP-001` | `PARTIAL / LOCAL_DR_PASS` | Local encrypted backup/isolated restore and negative controls are implemented; current exact-SHA requalification remains to be folded into the final NFR/DR matrix. | Authorized staging scheduler/restore, environment key/object storage and release owner. | Re-run local DR on final SHA; execute staging rehearsal only after explicit target authorization. |
| `SET-MVP-DELETE-001` | `PARTIAL / DESTRUCTIVE_EXECUTION_APPROVED_OUT` | Request/cancel/status are present; destructive purge must remain unavailable. | Legal/Privacy retention, legal hold, backup and per-data-class action policy. | Preserve executor OFF; prepare the deletion-policy decision matrix without executing deletion. |
| `PRT-MVP-ACCRUAL-001` | `PARTIAL / ECONOMICS_APPROVED_OUT` | Technical ledger and policy gate exist; current Partner replay proves zero economics and disabled accrual/payout/self-approval. | Versioned Commercial + Finance + Legal policy and Partner IA decision. | Preserve economics OFF; present policy/IA decision packet, with no synthetic-policy promotion. |
| `FLOW-TRANSFORM-MVP-001` | `PARTIAL / LOCAL_FULL_LINEAGE_PASS` | Local full lineage is current and green; run signed desktop/mobile on the frozen final SHA and bind browser identities to the durable lineage. | Authorized deployed journey and rollback rehearsal. | Build final-candidate signed browser flow; do not enable deployment flags without authorization. |
| `REL-001-T01` | `PARTIAL / RELEASE_NOT_AUTHORIZED` | Generate and independently verify a new release bundle only after preceding gates are current on the frozen candidate. | Explicit Piotr release authorization; production is out of scope until then. | Keep `releaseGo=false`; no push/deploy/release action before the exact approval request. |

## Wave sequence from this checkpoint

### Wave 4 — freeze and owner-decision preparation

1. Freeze one clean candidate after evidence reconciliation.
2. Run the final five-workspace Finance G4 and signed FLOW desktop/mobile.
3. Produce four bounded decision packets: Materials rights, Audits restricted
   scope/flag, Settings deletion policy and Partner economics/IA.
4. Record Piotr observations as owner feedback; do not infer acceptance from
   technical green evidence.

### Wave 5 — NFR and disaster recovery

1. Re-run exact-candidate type/build/static/security and fresh/repeat/dry
   migration gates.
2. Re-run the repository-owned performance denominator and reconcile thresholds,
   write loss/duplicates, Web Vitals and telemetry.
3. Re-run local encrypted backup/restore with corruption, wrong-key,
   same-target and tenant-isolation negatives.
4. Prepare, but do not execute, environment-specific flag, storage, scheduler
   and rollback commands until the target is explicitly authorized.

### Wave 6 — final demo and release gate

1. Start a guarded final-demo runtime on the exact frozen SHA and named demo DB.
2. Execute all 16 golden journeys plus full transformation lineage and cold
   readback; reconcile browser/API/SQL identities.
3. Generate and independently verify the release candidate bundle with
   `releaseGo=false`.
4. Ask separately for the exact release target and authorization. Demo readiness
   never implies production readiness.

## Stop conditions

- Any SHA, migration, database, fixture-marker or environment mismatch.
- Any missing/invalid evidence packet or denominator drift from 82.
- Any request to mutate Railway, staging or production without verified target
  and explicit authority.
- Any destructive deletion, payout/accrual activation, external-standard
  publication or provider activation without its named policy decision.
- Any attempt to treat technical browser replay as owner acceptance.

# Consultify final MVP — remaining 9 control register

Date: 2026-08-23  
Branch: `codex/final-mvp-integration-20260823`
Qualified product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
Production and Railway mutation authority: `NOT_AUTHORIZED`

Product-source integration checkpoint: `3549e1752bb1` on
`codex/final-mvp-integration-20260823` (2026-08-24). Documentation-only
reconciliation may follow without changing that product tree. This is not
owner acceptance and not release authority.

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
| `FIN-UI-CANON-001` | `PARTIAL / CURRENT_FIVE_WORKSPACE_SIGNED_PASS` | Current WIP now has a fresh `831/831` isolated-PostgreSQL signed-browser PASS for literal Statements, Baseline, Prediction, Analysis and Valuation cold readback. Baseline, Prediction, Analysis and Valuation also prove canonical writes; Statement proves canonical read-only data. The complete state/accessibility matrix still requires one run on the frozen final SHA. | Final owner/internal-beta acceptance boundary; production remains separate. | Re-run this literal five-workspace G4 plus state/a11y cells on the frozen candidate; do not promote the current-WIP technical pass to owner acceptance. |
| `MAT-POL-001` | `PARTIAL / READY_FOR_RIGHTS_INPUT` | Fail-closed provenance/quarantine controls exist; no code can manufacture missing rights evidence. | Legal/Procurement approval for layout, fonts, images, redistribution, renderer, DPA/residency/SLA/cost. | Present a bounded rights matrix; keep unknown templates quarantined and external providers OFF. |
| `AUD-POL-001` | `PARTIAL / READY_FOR_EXTERNAL_GATE` | Current 831-migration requalification passed scheduler/cursor/fence controls `26/26`. Browser denial of every external-standard entry remains part of final acceptance. | Authorized environment flag, observed ticks/telemetry and Methodology/Rights/Legal acceptance. | Keep default OFF; prepare exact flag/telemetry runbook and owner sign-off packet. |
| `ADM-MVP-BACKUP-001` | `PARTIAL / LOCAL_DR_EXACT_PRODUCT_SHA_PASS` | Exact product SHA `bcfb01483a` passed `19/19` current RealPG encrypted backup/isolated-restore and durable lifecycle controls on two disposable PG16 databases, plus `13/13` scheduler/routes tests. Wrong-key, corruption, same-target, tenant isolation, rollback, append-only audit, fencing and compensation stayed fail-closed. Post-run residue was zero in both databases and storage. | Authorized staging scheduler/restore, environment key/object storage and release owner. | Preserve the proven local implementation; execute staging rehearsal only after explicit target authorization. |
| `SET-MVP-DELETE-001` | `PARTIAL / DESTRUCTIVE_EXECUTION_APPROVED_OUT` | Request/cancel/status are present; destructive purge must remain unavailable. The complete per-data-class decision and activation matrix is now recorded in `evidence/closure/codex/SET-MVP-DELETE-001/DECISION_PACKET.md`. | Legal/Privacy retention, legal hold, backup and per-data-class action policy. | Preserve executor OFF; obtain explicit answers to the packet and rerun its drifted focused tests on the frozen SHA before any executor is designed or enabled. |
| `PRT-MVP-ACCRUAL-001` | `PARTIAL / ECONOMICS_APPROVED_OUT` | Technical ledger and policy gate exist; current Partner replay proves zero economics and disabled accrual/payout/self-approval. The complete commercial policy and activation matrix is now recorded in `evidence/closure/codex/PRT-MVP-ACCRUAL-001/DECISION_PACKET.md`. | Versioned Commercial + Finance + Legal policy and Partner IA decision. | Preserve economics OFF; obtain explicit answers to the packet and requalify the drifted route/service paths on the frozen SHA, with no synthetic-policy promotion. |
| `FLOW-TRANSFORM-MVP-001` | `PARTIAL / LOCAL_LINEAGE_AND_ADOPTION_EXACT_PRODUCT_SHA_PASS` | Exact product SHA `bcfb01483a` passes the preserved `6/6`, `87/87` full lineage and fresh focused RealPG adoption `3/3` plus four-source lineage `7/7`. The new adoption receipt is transactionally bound to exact tenant, candidate, Initiative, project, handoff, output, version, hash and status; wrong-project, tenant forgery, ambiguity, immutability and conflict controls fail closed. Browser evidence is still empty. | Signed end-user desktop/mobile journey on this product SHA lineage, plus an explicitly authorized deployed journey and rollback rehearsal. | Build the signed browser flow and bind browser/API/SQL identities to the durable lineage; do not enable deployment flags or claim release/owner acceptance. |
| `REL-001-T01` | `PARTIAL / MIGRATION_CLASSIFICATION_CLOSED / BUNDLE_REGENERATION_PENDING` | Integration checkpoint `744b9dc42b8b` reduces the migration denominator from 81 findings in 36 files to exactly `0` non-ALLOW signals across all `40` migrations added since baseline `e6ca206c0035`. The verifier remains fail-closed for standalone DROP/UPDATE/DELETE, unsafe `DO`, historical mutation and missing reconstruction pairs; focused verifier tests pass `6/6`. Existing bundle receipts still belong to the earlier product SHA and must not be promoted. | Regeneration of every exact-SHA receipt and bundle, all preceding gates, explicit Piotr release authorization; production remains out of scope. | Freeze the final source candidate only after the other eight rows are reconciled, regenerate all receipts and independently verify the new bundle with `releaseGo=false`; no push/deploy/release before exact approval. |

## Wave sequence from this checkpoint

### Wave 4 — freeze and owner-decision preparation

1. Freeze one clean candidate after evidence reconciliation.
2. Run the final five-workspace Finance G4 and signed FLOW desktop/mobile.
3. Produce four bounded decision packets: Materials rights, Audits restricted
   scope/flag, Settings deletion policy and Partner economics/IA.
4. Record Piotr observations as owner feedback; do not infer acceptance from
   technical green evidence.

### Wave 5 — NFR and disaster recovery (`LOCAL EXACT-SHA PASS`)

1. Exact-candidate typecheck and frontend/backend build are PASS (frontend uses
   the established 8 GB heap ceiling).
2. Repository-owned performance denominator is PASS: 30 minutes, 50 users,
   111,400 requests, 0 errors, 0 write loss/duplicates/tenant false-successes,
   signed desktop/mobile Web Vitals PASS.
3. Local encrypted backup/restore is PASS: `19/19` RealPG plus `13/13`
   scheduler/routes, including corruption, wrong-key, same-target and
   tenant-isolation negatives.
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

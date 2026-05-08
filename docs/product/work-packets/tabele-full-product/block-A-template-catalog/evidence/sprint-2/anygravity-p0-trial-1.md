# Anygravity P0 Trial #1 — Tabele Consulting Pack v1.0.0

**Trial ID:** `tabele-consulting-pack-v1-trial-1`
**Block:** Block A · EPIC-T5 · Sprint 2
**Date filed:** 2026-05-08
**Date executed:** _PENDING_
**Outcome:** _PENDING_
**Owner:** Orchestrator (CTO mode) — execution gated on staging deploy
**Procedure:** `DRD/testy_antygravity/ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md`

---

## 1. Why this trial

The Tabele module ships with a 30-template consulting catalog (12 approved +
18 draft). Before either the catalog or the lifecycle service is exposed to
real consultants, a P0 Anygravity trial verifies that:

1. The seeder runs idempotently against a real staging Postgres (idempotency
   key: `governance_rules.seed_id`).
2. Every approved template can be instantiated end-to-end (`POST /templates/:id/use`)
   into a real workspace and produces a base + tables + fields whose shape
   matches the seed `schema_snapshot`.
3. The new lifecycle endpoints (`GET /templates/lifecycle`, `POST /templates/:id/{approve,deprecate}`)
   are tenant-correct and super-admin-gated under realistic load.
4. EN + PL i18n strings render in the Tabele module home for all 30 entries
   without missing-key fallbacks.

## 2. Scope (what the trial covers)

- **Tenants under test:** Anygravity DEMO + Anygravity STAGING tenants.
- **Actor matrix:**
  - super-admin (`isSuperAdmin=true`) for lifecycle writes.
  - data_editor org member for `/templates/:id/use` flow.
  - viewer org member to verify read-only access on approved templates.
- **Templates exercised:** all 12 approved + a 5-template sample of the 18 drafts.
- **Workload:** seed → instantiate × 17 templates × 2 tenants = 34 base creations,
  followed by lifecycle promote of 5 drafts and deprecate of 1 approved.
- **Performance budget:** seeder run < 5 s; full lifecycle smoke < 90 s.

## 3. Out of scope

- AI Editor proposals (Block C).
- QA Engine publish-gate (Block C).
- Form embed publishing (Block D).
- Frontend MELS shell (Block A · EPIC-T16, Sprint 4).

## 4. Pre-flight checklist

- [ ] Block A migration `20260508_block_a_template_lifecycle.sql` applied on staging.
- [ ] Block B migration `20260508_block_b_record_provenance.sql` applied on staging.
- [ ] `tabeleConsultingTemplatesSeeder.seed()` invoked on boot or via ops script.
- [ ] `TABLE_TEMPLATE_CATALOG_V1.md` reviewed by domain lead (consulting catalog ownership).
- [ ] Staging contains the merged commit `feat(tabele): land block A lifecycle + block B provenance backbone` (`8dc2ae211`) and the follow-up A-S2 commit.
- [ ] EN + PL i18n files deployed (no CDN-cache stale issues).

## 5. Trial steps (execution-time)

1. **Cold seed.** Truncate any prior Tabele consulting rows in `tp_base_templates`
   on the staging slot (where `governance_rules ->> 'seed_id'` LIKE `tab-%`).
   Run `tabeleConsultingTemplatesSeeder.seed()`. Expect `inserted=30, updated=0`.
2. **Re-seed (idempotency).** Re-run `seed()`. Expect `inserted=0, updated=30`.
3. **Lifecycle list (any actor).** `GET /api/table-platform/templates/lifecycle?status=approved`.
   Expect 12 rows; spot-check `version='1.0.0'` and `schema_snapshot.tables[0].fields.length >= 5`.
4. **Instantiate (data_editor).** For each of 17 trial templates call
   `POST /api/table-platform/templates/:templateId/use` with a fresh `workspaceId`.
   Verify created base + tables + fields match the seed `schema_snapshot`.
5. **Promote draft (super-admin).** `POST /api/table-platform/templates/:id/approve`
   on 5 draft templates. Expect 200, `status='approved'`, `approval_history`
   appended with the actor.
6. **Deprecate approved (super-admin).** `POST /api/table-platform/templates/:id/deprecate`
   on 1 approved template. Expect 200, `status='deprecated'`.
7. **Re-seed after lifecycle drift.** Run `seed()` again. The deprecated row
   MUST keep `status='deprecated'` (the UPDATE clause refuses to demote).
8. **Cross-tenant probe.** From a different tenant, repeat step 4 with a
   `workspaceId` that does not belong to the actor's org. Expect 403.
9. **i18n smoke.** Open Tabele module home in EN and PL; confirm all 30 titles
   render through the new namespace without `key.missing` fallback.

## 6. Pass criteria

- Steps 1–9 all pass.
- No 5xx responses anywhere in the trial.
- `tp_audit_events` shows `record_source` events for every lifecycle write.
- Seeder run time + lifecycle smoke total < 90 s.

## 7. Fail handling

If any step fails, the trial halts and the orchestrator files a finding card
under `evidence/sprint-2/anygravity-p0-trial-1-findings/<step>.md` per
`ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md`. Block A is paused at S2 until
the finding is mitigated.

---

## 8. Execution log

| Date | Step | Result | Notes |
|---|---|---|---|
| _pending_ | _all_ | _pending_ | _to be filled at execution_ |

## 9. Sign-off

- Orchestrator: ___
- Domain lead (consulting): ___
- Security reviewer: ___
- Date: ___

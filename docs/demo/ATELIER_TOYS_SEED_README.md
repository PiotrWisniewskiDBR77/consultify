# Atelier Toys — canonical demo seed (README)

**One coherent company across the whole golden path.** Atelier Toys is the
reference demo tenant: a French toy manufacturer running a "Ateliertoy Forward
(2015)" digital transformation. The same story flows, with the same stable IDs,
through every module: **org context → interviews & insights → DRD assessment →
initiatives → execution/rollout → results/KPIs → ROI → deliverables**.

This document is the map of what the seed materializes, how it stays idempotent,
and exactly how to run it safely.

---

## 1. Where the data lives (single source of truth)

| Concern | File |
|---|---|
| Materialization engine (writes to DB) | `server/src/services/demo/demoSeedService.ts` |
| Narrative template (org, people, initiatives, insights, KPIs, deliverables) | `server/src/services/demo/atelierToysDemoTemplate.ts` |
| Bilingual (EN/PL) localization | `server/src/services/demo/atelierToysDemoLocalization.ts` |
| Runnable build script (dry-run + write) | `server/scripts/build-demo-dataset.ts` |
| Coherence test (spine links) | `server/src/services/demo/__tests__/atelierSpineCoherence.test.ts` |
| Idempotency test (2× = same state) | `server/src/services/demo/__tests__/atelierSeedIdempotency.test.ts` |

The public entry points on the engine are:

- `seedAtelierToysDemoDataset({ organizationId, anchorDate?, locale?, viewerUserId? })`
  — **pure upsert**, no deletes. Safe to re-run against a live tenant.
- `deleteDemoDatasetForOrganization(organizationId)` — destructive cleanup used
  only by the full-rebuild path. **Not** part of the idempotent seed itself.

> Any other `seed-*.ts` under `server/scripts/` is legacy/manual and does **not**
> define canonical Atelier truth. Use only the two files above.

---

## 2. The golden path (what gets seeded, in story order)

| Stage | Story beat | Main tables |
|---|---|---|
| 16 | Company + leadership + org context (Teresa becomes context-aware) | `organizations`, `users`, `teams`, org-context claims |
| 02 | Portfolio of projects | `projects`, `project_users` |
| 03 | Discovery: 5 completed interviews → insights → findings → **handoffs to initiatives** | `interview_sessions`, `interview_insights`, `interview_insight_findings`, `interview_insight_handoffs` |
| 04 | **DRD assessment baseline** (7 axes, overall 3.3 → target 5.0, gap 1.7), APPROVED report + 3 sections | `assessments`, `assessment_reports`, `assessment_report_sections` |
| 05 | Initiative portfolio (flagship: Line 3 Digital Twin, Procurement Control Tower, Atelier Digital Growth) with tasks, milestones, dependencies, decisions | `initiatives`, `initiative_milestones`, `initiative_dependencies`, `tasks`, `decisions` |
| 06 | Execution / rollout artifacts | `rollout_kpis`, `rollout_risks`, `rollout_changes`, `rollout_closures` |
| 07 | Results / KPIs with historical trend (OEE 74 → 80, target 82) | `project_kpis` |
| 08b | Financial model + ROI (NPV / ROI% / payback) linked to the flagship initiative | `financial_models`, `analysis_financials` |
| 09 | Deliverables (report + presentation) linked back to the flagship initiative | `v8_output_artifacts`, `v8_output_exports` |

The end-to-end invariant (asserted by the coherence test): **the flagship
initiative id `…--initiative--line-3-digital-twin` appears in every spine stage**
— reached from an insight handoff, carried into the financial model and ROI
analysis, tracked as an OEE result under its project, executed via rollout
artifacts, and closed out as a shared deliverable.

The DRD assessment (stage 04) hangs off the same tenant spine: it is owned by the
`…--project--forward-pmo` project, its report is `APPROVED`, and its score
summary reconciles with the transformation thesis (top gaps = OT cyber, value
evidence discipline, AI operating model — the same gaps the initiatives address).

---

## 3. Idempotency contract ("2× = same state")

Every id-bearing write in the seed is an **`INSERT … ON CONFLICT(<stable key>)
DO UPDATE`** keyed on a deterministic id from `makeId(orgId, entityType, slug)`
(format `orgId--entityType--slug`). Conflict keys are usually `id`, sometimes a
domain key (`artifact_id`, `export_id`) or a composite (`(user_id, idea_id)`).

Consequences:

- Re-running the seed against the **same org id** updates rows in place. It never
  duplicates business objects and never orphans links.
- The seed **does not delete** anything. Re-running it on a live tenant is
  additive/updating only — it will not remove the 39 stray test rows in the demo
  org (those are hidden by the M17 filters and are intentionally left alone).

This is proven, with no live Postgres, by
`atelierSeedIdempotency.test.ts`, which seeds twice against an in-memory capture
of every write and asserts run #2 targets exactly the same set of stable ids as
run #1 (zero net-new, zero dropped), across every table and every spine stage.

---

## 4. How to run it

### 4.1 Dry-run (safe anywhere — no writes)

Prints the dataset it *would* build against a throwaway `-preview` org and then
removes that preview. Nothing touches the real demo org.

```bash
DB_TYPE=postgres npx tsx server/scripts/build-demo-dataset.ts
```

### 4.2 Canonical write (rebuild — deletes then reseeds the target org)

There is a ready npm script with all guardrails wired in:

```bash
npm run db:seed:atelier
```

which expands to:

```bash
ALLOW_NONDEFAULT_DEMO_ORG=1 ALLOW_BRANDED_DEMO_ORG=1 ALLOW_ATELIER_AS_DEMO_ORG=1 \
DEMO_ORG_ID=atelier DEMO_ORG_NAME="Atelier Toys" \
DEMO_DATASET_CONFIRM=REBUILD_CANONICAL_DEMO \
DB_TYPE=postgres npx tsx server/scripts/build-demo-dataset.ts --write
```

Guardrails enforced before any write:

- `--write` is required (default is dry-run).
- `DEMO_DATASET_CONFIRM=REBUILD_CANONICAL_DEMO` is required.
- A non-default / branded `DEMO_ORG_ID` requires the explicit approval flags
  (`ALLOW_NONDEFAULT_DEMO_ORG`, `ALLOW_BRANDED_DEMO_ORG`, `ALLOW_ATELIER_AS_DEMO_ORG`).
- The database target is logged (source/target evidence) before writing.

> ⚠️ The `--write` path calls `deleteDemoDatasetForOrganization(DEMO_ORG_ID)`
> first, so it is a **full rebuild** of that org. Point `DEMO_ORG_ID` only at a
> disposable demo tenant. It is not a production data path.

### 4.3 Additive re-seed on a live tenant (no delete)

If you only want to refresh/repair the Atelier story on an existing tenant
**without** wiping it, call the engine directly (upsert-only path — skip the
delete). This is the non-destructive option:

```ts
import { seedAtelierToysDemoDataset } from './server/src/services/demo/demoSeedService.js';
await seedAtelierToysDemoDataset({ organizationId: 'atelier', locale: 'en' });
```

Because every write is an upsert on a stable id, this converges the tenant to the
canonical Atelier state and is safe to run repeatedly.

### 4.4 Verify locally (no DB needed)

```bash
npx vitest run server/src/services/demo/__tests__/
```

Runs both the spine-coherence test (cross-module links) and the idempotency test
(2× = same state).

---

## 5. Related narrative docs

- `docs/demo/ATELIER_TOYS_INTERVIEW_FINDINGS_REPORT_GAMMA.md` — the discovery report.
- `docs/demo/ATELIER_TOYS_DIGITAL_TRANSFORMATION_PROGRAM_GAMMA.md` — the program narrative.
- `docs/product/ATELIER_FULL_DATASET_BUSINESS_ROLLOUT_MAP.md` — the dataset contract + gate model.
- `docs/product/ATELIER_FULL_DATASET_QUALITY_GATES.md` — GO/NO-GO gates.

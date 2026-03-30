# P21-B Evidence — Reports runtime E2E (2 templates) + sources/no-web posture
Date: 2026-03-30  
Packet: **P21-B**  
State: delivered (tests + staging proof script) — local integration test green

## Context pack (max 5, SSOT order)
1. Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
2. Contract: `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_21_RAPORTY_2026-03-29.md`
3. Authority chain: P21 contract §3 (Wave2 docs + builder scope)
4. Benchmark / Softs: P21 contract §4 (Gamma template-first; KIMI long-form; Perplexity tools/fallback posture)
5. Dependencies/boundaries: P21 contract §2.3 + P21-A evidence doc below

Related scope freeze (P21-A):
- `docs/product/work-packets/cursor-work/final_master/evidence/P21_REPORTS_TEMPLATE_FIRST_CANON_AND_SOURCES_POSTURE_2026-03-30.md`

---

## Automated tests (run locally)

### Test batch (expected green)

```bash
npx vitest run \
  tests/integration/routes/artifact-runs.routes.sqlite.integration.test.ts \
  tests/integration/routes/artifacts.routes.test.ts \
  tests/integration/routes/report-builder.sessions.routes.test.ts \
  tests/integration/routes/report-builder.share.routes.test.ts \
  tests/integration/routes/report-builder-public.docx.routes.test.ts \
  tests/e2e/smoke/deploy-gate-api-report-builder.spec.ts
```

### P21-B additions (to be implemented in this packet)

After the runtime changes land, the P21-B proof run must also include:

```bash
npx vitest run \
  tests/integration/routes/p21b-reports-template-artifactrun-e2e.sqlite.integration.test.ts
```

Expected (P21-B): proves **two** report templates materialize through governed ArtifactRun into:
- canonical Outputs Library artifact (`/api/artifacts` lists them),
- report builder open target (`/reports/builder/:id`),
- export audit trace (`/api/artifacts/:id/trust-state` includes export history after export),
- explicit **no-web degraded posture** (flag present; user-visible banner copy on export/editor surface — bounded),
- explicit **sources ledger posture** (at minimum: report keeps explicit source grounding in metadata; no fabricated evidence pointers).

---

## Staging proof script (runtime checklist)

Environment prerequisites:
- Authenticated user in an org that has:
  - at least **two report templates** available in `report_builder_templates` (system or org).
  - at least one source that can be used to create a report (bounded: `INTERVIEW` source, or any available source supported by your org’s data).

### A) Template → plan → approve(run) → artifact → library (governed ArtifactRun)

1. Open **Chat** (governed V8 chat surface).
2. Capture a V8 snapshot (if not already present) using the artifact-run control.
3. Plan an output with type **Document** (report lane) and a clear goal (e.g. “Create R1 Weekly Execution report from <source>”).
4. Click **Accept plan** → confirm proposal is created (run state shows proposal created).
5. Click **Submit review** → then **Approve review** (this is **approve(run)**; must remain separate from report artifact review).
6. Click **Materialize** and provide:
   - `templateId` = template #1
   - `sourceType/sourceId/sourceName` (if required by your data posture)
   - `config` includes an explicit no-web posture flag for this run (bounded)
7. Confirm:
   - Materialize returns a run with `artifactId`
   - The generated artifact appears in Outputs Library (`/presentations` → All/Mine)
   - The artifact’s action-target open path points to report builder (`/reports/builder/:reportId`)

Repeat steps 3–7 using **template #2**.

### B) Reopen / continue → export + audit trace

For each of the two reports:

1. Open from Outputs Library.
2. Make a small edit (bounded: change report title or edit one section content).
3. Export (PDF) from the report surface.
4. Confirm audit trace:
   - Preview / trust-state shows export history for the artifact (`/api/artifacts/:artifactId/trust-state`).

### C) Honest no-web degraded path (explicit)

1. For at least one of the two generated reports, ensure the no-web posture is explicit:
   - Report/editor/export surface must show a clear “generated without web sources” limitation.
2. Confirm **no overclaim**: there must be no fabricated URLs/citations when web tools were not used.

Capture:
- short screen recording (or screenshots) of A+B+C.
- optional: API trace snippet for the artifact trust-state export history.

---

## Rollback posture (P21-B scope)
- Revert only P21-B commits that add report-lane wiring and metadata; artifact substrate tables and existing report builder tables remain intact.
- No destructive DB operations are allowed; rollback must preserve already-created artifacts and exports.

---

## Known limits (explicit, for honesty)
- This packet is **bounded to two report templates** and the governed ArtifactRun → Outputs Library lane.
- “Sources ledger” in this packet is **posture-first**: we require explicit grounding metadata and explicit no-web limitation; full web evidence extraction and section-level URL attribution is a later expansion packet (not P21-B).

# Atelier Full Dataset - Execution Sequence

Status: Immediate execution sequence
Horizon: 3 sprints

---

## Step 0 - Scope Lock

Deliver exactly this outcome:

- one canonical Atelier dataset path,
- consulting-grade narrative coherence,
- production-safe promotion readiness.

No unrelated refactors.

---

## Sprint 1 - Canonical Seed Unification (Highest Priority)

### Objective

Make `demoSeedService` the single source of truth for full business coverage.

### Work package

1. Integrate Results layer into canonical seed:
   - KPI definitions
   - KPI time series
   - initiative-KPI mappings
   - ROI assumptions
   - ROI realized values
   - deviation cases/actions
2. Integrate executive artifacts runtime layer:
   - report snapshots
   - deck/runtime artifact records where available
3. Add canonical release metadata output:
   - dataset version
   - seed hash
   - anchor date
   - module-level counts

### Exit gate

- Rebuild command produces complete multi-module dataset with no critical holes.

---

## Sprint 2 - Promotion Hardening

### Objective

Establish deterministic staging->production promotion path.

### Work package

1. Build dedicated promotion script with:
   - dry-run mode
   - write mode with explicit confirmation
   - target DB proof in logs
2. Add post-promotion verification suite:
   - key count checks
   - critical API readbacks
   - role-based smoke checks

### Exit gate

- Promotion can be executed and verified without manual intervention scripts.

---

## Sprint 3 - Operational Quality and Monitoring

### Objective

Keep dataset quality stable after release.

### Work package

1. Add recurring quality checks:
   - module coverage
   - stale artifact detection
   - linkage drift checks
2. Add release evidence output suitable for operations and governance.

### Exit gate

- Dataset quality can be monitored continuously and audited.

---

## Immediate Next Execution Step

Start Sprint 1 by implementing canonical Results + artifact integration in:

- `server/src/services/demo/demoSeedService.ts`
- `server/scripts/build-demo-dataset.ts`

and validate against `ATELIER_FULL_DATASET_QUALITY_GATES.md` Gate B + Gate C.

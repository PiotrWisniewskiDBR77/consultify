# P18-C — Provenance / trust-state closeout (2026-03-31)

Packet: **P18-C**  
Depends on:
- **P18-B delivered**: `354be3330c`
- **Verification baseline in this session**: `98bf75bf8a`

## 1) Automated verification

Command:

```bash
npx vitest run \
  tests/integration/routes/artifacts.routes.test.ts \
  tests/integration/routes/v8.execution.routes.test.ts
```

Result: **PASS** on 2026-03-31
- Test files: **2/2 passed**
- Tests: **21/21 passed**

## 2) What this closeout verified

- `GET /api/artifacts/:id/trust-state` remains the single trust-state authority.
- Execution and artifact-review axes remain separated.
- Visible runs expose tool usage and output pointers; non-visible runs fail closed with no leakage.
- Export-trace and trust-state payloads remain stable for consumer surfaces.

## 3) Rollback posture

- The bounded rollback posture preserves read-only lineage while disabling newer exposure surfaces if needed.
- No permissions redesign or destructive visibility changes are required.

## 4) Known limits

- This closeout verifies the bounded trust-state and visibility contract through integration tests rather than a multi-user staging capture.
- Reports tab and Presentations tab previews fetch trust-state for review-gating logic but do not render the full trust-state badge panel that the Outputs "All" tab preview shows. Surface consistency is partial until `TrustStatePreviewSection` is shared across all preview surfaces (contract §2.3 follow-up).
- List rows use registry-denormalized governance; `lineagePaths` is only available after preview selection triggers `GET /api/artifacts/:id/trust-state`. This two-tier model is architecturally intentional (performance) but creates a transient gap between list and preview truth.

## 5) Frontend trust-state consumers (reference)

Canonical consumers of `GET /api/artifacts/:id/trust-state` in `src/`:
- `src/components/ReportsAndPresentations/OutputsAggregateTabContent.tsx` — full trust preview + lineage dialog
- `src/components/ReportsAndPresentations/ReportsTabContent.tsx` — merged governance for review gating
- `src/components/ReportsAndPresentations/PresentationsTabContent.tsx` — merged governance for review gating

Supporting types and mapping:
- `src/components/ReportsAndPresentations/types.ts` — `ArtifactGovernanceSummary` (single TS shape)
- `src/components/ReportsAndPresentations/useRapData.ts` — `mapArtifactGovernance` (list-derived baseline)
- `src/components/ReportsAndPresentations/artifactNavigation.ts` — `openPath` routing from governance

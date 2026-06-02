# Documentation Owner Registry

Status: `ACTIVE`
Date: 2026-05-07

This is the canonical mapping of every controlled doc to its owner role and named delegate.
It is used:

- by `DOCUMENTATION_CHANGE_CONTROL.md` (process flow, rejection criteria),
- by `DOC_CHANGE_TEMPLATE.md` (Reviewer field),
- by `docChangeControlValidatorService.ts` (`parseOwnerRegistry` parses this table; future
  iterations will cross-check the changelog `Reviewer` field against this list).

**Named owners are placeholders** in this scaffold (e.g. `<Product Lead>`). They are
intentionally not real names — assigning real humans is a separate ratification step,
documented in the governance backlog.

---

| Doc | Owner role | Named owner | Delegate |
| --- | --- | --- | --- |
| `docs/product/PRESENTATION_ARTIFACT_ENGINE_SYSTEM_AND_BACKLOG.md` | Product | `<Product Lead>` | `<Product Lead Delegate>` |
| `docs/product/PRESENTATION_ARTIFACT_ENGINE_REFERENCE.md` | Product | `<Product Lead>` | `<Product Lead Delegate>` |
| `docs/product/PRESENTATION_RUNTIME_AND_CONFIDENTIALITY_ROLLOUT_RUNBOOK.md` | Ops | `<Ops Lead>` | `<Ops Lead Delegate>` |
| `docs/product/PRESENTATION_RBAC_MATRIX.md` | Security | `<Security Lead>` | `<Security Lead Delegate>` |
| `docs/testing/PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md` | Product | `<Product Lead>` | `<QA Lead>` |
| `docs/testing/PRESENTATION_SLI_SLO.md` | Ops | `<Ops Lead>` | `<SRE Lead>` |
| `docs/product/EXECUTION_TASK_METADATA_STANDARD.md` | PMO | `<PMO Lead>` | `<Delivery Owner>` |
| `docs/product/PRESENTATION_STAGE_GATE_WORKFLOW.md` | PMO | `<PMO Lead>` | `<Delivery Owner>` |
| `DRD/UI_UX_SOURCE_OF_TRUTH.md` | Design | `<Design Lead>` | `<Design Lead Delegate>` |

---

## Adding a new controlled doc

1. Append a row to the table above.
2. Create `CHANGELOG_<basename>.md` next to this file (use the existing changelog files as
   the template).
3. Seed the first entry referencing the rationale ("added to controlled-docs registry").
4. Update the in-scope list in `DOCUMENTATION_CHANGE_CONTROL.md` section 2.
5. Run `npm run docs:check` to confirm the new changelog passes the validator.

## Replacing a placeholder owner with a real name

This is a low-risk edit but still goes through Documentation Change Control:

1. Add a `CHANGELOG_DOC_OWNER_REGISTRY.md` entry the first time the registry itself
   becomes a controlled doc.
2. Update the row in this file.
3. PR review by current PMO Lead.

# TPL-1b v2 — W224 receipt

## Verdict

READY FOR CTO REVIEW. The W221 blockers are closed on top of the current integration line `e1e9f5d17651095d29bc1b9c1670a2737308ee50`.

## Scope

- `GovernedTemplateBuilderFlow.tsx`: all six `ArtifactRightPanelSection` entries now pass their body as the required `children` property.
- `server/migrations/rollback/20262273_deliverable_template_workflow.down.sql`: explicit, idempotent rollback drops test receipts before their workflow parent table.
- `materialsMenuStandard.contract.test.tsx`: the obsolete frozen CTA contract is replaced with the accepted DEC-558 contract. The enabled CTA must open the governed full-screen builder. The test and commit retain `[ODMROZENIE 11_MATERIALS DEC-558]`.
- No Track A files, deployment, staging write, Railway change, or public-origin backup.

## Behavior evidence

The actual dev-render harness was loaded at 1440×1000 in Chromium after the fix. For both light and dark themes:

- right-panel sections: `6`;
- rendered section bodies: `6`;
- panel text includes metadata, inherited formatting, sources, default assignment, independent approval and history;
- document overflow: `x=0`, `y=0`;
- browser console/page errors: `0`.

Reviewed images:

- `evidence/new-template-light.png`
- `evidence/new-template-dark.png`

## Automated evidence

- `materialsMenuStandard.contract.test.tsx`: 21/21 PASS, including enabled CTA → governed builder.
- Frontend `npm run type-check -- --pretty false`: repository baseline `156` errors, `0` diagnostics in TPL-1b touched files. The six W221 `TS2353` errors are gone.
- `git diff --check`: PASS.

The broader workflow/service/RealPG evidence remains in `docs/program/TPL_1B_W215_20260917/RECEIPT.md`; W221 explicitly did not require repeating it.

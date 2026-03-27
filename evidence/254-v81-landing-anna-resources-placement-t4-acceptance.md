# V8.1 Evidence - Landing Anna resources placement T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna resources placement`
Taxonomy: `T4`
Status: `accepted`

## Acceptance basis

This bounded `Landing Anna resources placement` lane is ready for `T4` acceptance because `ResourcesPage` now exposes the same
public Anna assistant pattern already accepted on canonical `/` and shared-shell marketing pages.

1. `ResourcesPage` now mounts `AnnaAssistantWidget`
2. Anna uses the page's existing demo/trial/contact authority
3. focused regression proves Anna is present while topbar CTA authority remains intact
4. existing Anna widget regressions remain green

## Why this is sufficient

The lane was explicitly scoped as one bespoke-shell placement cut for `ResourcesPage`, not as full rollout across every
remaining custom public page. Within that scope, the `ResourcesPage` split-brain is closed.

Any future placement on `Tools`, `Audits`, legal pages, pricing pages, or broader Anna analytics/prompt work remains visible
backlog and should re-enter execution only through a new explicit promotion.

## Evidence chain

1. `evidence/252-v81-landing-anna-resources-placement-split-brain-map.md`
2. `evidence/253-v81-landing-anna-resources-placement-seam.md`

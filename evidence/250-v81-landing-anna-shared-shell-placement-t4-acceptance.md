# V8.1 Evidence - Landing Anna shared-shell placement T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna shared-shell placement`
Taxonomy: `T4`
Status: `accepted`

## Acceptance basis

This bounded `Landing Anna shared-shell placement` lane is ready for `T4` acceptance because Anna is no longer limited to
canonical `/` and now appears on public pages that use the shared `MarketingLayout`.

1. `MarketingLayout` now mounts `AnnaAssistantWidget`
2. shared-shell pages inherit Anna's existing demo/trial/contact handoff authority
3. focused regression proves a marketing page using the shared shell now exposes Anna
4. existing Anna behavior regressions remain green

## Why this is sufficient

The lane was explicitly scoped as a shared-shell placement cut, not as full landing-IA rollout. Within that scope, the shared
public shell split-brain is closed.

Any future bespoke-shell placement on `Resources`, `Tools`, `Audits`, or broader Anna analytics/prompt work remains visible
backlog and should re-enter execution only through a new explicit promotion.

## Evidence chain

1. `evidence/248-v81-landing-anna-shared-shell-placement-split-brain-map.md`
2. `evidence/249-v81-landing-anna-shared-shell-placement-seam.md`

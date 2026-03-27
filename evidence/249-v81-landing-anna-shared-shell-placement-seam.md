# V8.1 Evidence - Landing Anna shared-shell placement Seam

Date: 2026-03-26
Lane: `Landing Anna shared-shell placement`
Taxonomy: `T4`
Packet: `marketing-layout assistant placement continuity`

## Goal

Close the bounded Anna placement seam where canonical `/` exposed the public assistant, but shared-shell marketing pages still
omitted Anna entirely.

## What changed

1. `src/components/Landing/MarketingLayout.tsx`
   - mounts `AnnaAssistantWidget` in the shared marketing shell
   - routes `Demo`, `Trial`, and `Contact` handoffs through the layout's shared public authority
2. `tests/components/BecomePartnerView.marketing-shell.test.tsx`
   - verifies a page using the shared `MarketingLayout` now exposes the public Anna entry point
3. existing Anna widget regressions remain green to prove the shared placement still uses the same bounded behavior contract

## Why it matters

Before this packet, Anna existed only on canonical `/`, even though several public landing pages already shared a common
marketing shell.

After this packet, those shared-shell pages inherit the same assistant placement and handoff authority without bespoke
page-level duplication.

## Verification

- `npm exec vitest run tests/components/BecomePartnerView.marketing-shell.test.tsx tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx tests/components/ProductEntryPage.kb-preview.test.tsx`

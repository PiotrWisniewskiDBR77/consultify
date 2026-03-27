# V8.1 Evidence - Landing Anna resources placement Seam

Date: 2026-03-26
Lane: `Landing Anna resources placement`
Taxonomy: `T4`
Packet: `resources-page assistant placement continuity`

## Goal

Close the bounded Anna placement seam where `ResourcesPage` still exposed landing conversion chrome without exposing the public
assistant.

## What changed

1. `src/views/ResourcesPage.tsx`
   - mounts `AnnaAssistantWidget` on the bespoke `ResourcesPage` shell
   - routes `Demo`, `Trial`, and `Contact` handoffs through the page's existing authority
2. `tests/components/ResourcesPage.cta-authority.test.tsx`
   - verifies `ResourcesPage` still routes topbar actions through the shared modal contract
   - verifies the page now exposes the public Anna entry point

## Why it matters

Before this packet, a visitor could move from canonical `/` or a shared-shell marketing page to `ResourcesPage` and lose access
to Anna completely.

After this packet, `ResourcesPage` preserves the same bounded assistant availability and handoff continuity as the rest of the
accepted landing slices.

## Verification

- `npm exec vitest run tests/components/ResourcesPage.cta-authority.test.tsx tests/components/BecomePartnerView.marketing-shell.test.tsx tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

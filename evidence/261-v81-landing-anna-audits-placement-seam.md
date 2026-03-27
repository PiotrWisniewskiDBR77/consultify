# V8.1 Evidence - Landing Anna audits placement Seam

Date: 2026-03-26
Lane: `Landing Anna audits placement`
Taxonomy: `T4`
Packet: `audits-page assistant placement continuity`

## Goal

Close the bounded Anna placement seam where `AuditsShowcasePage` still exposed landing conversion chrome without exposing the
public assistant.

## What changed

1. `src/views/AuditsShowcasePage.tsx`
   - mounts `AnnaAssistantWidget` on the bespoke `AuditsShowcasePage` shell
   - routes `Demo`, `Trial`, and `Contact` handoffs through the page's existing authority
2. `tests/components/AuditsShowcasePage.cta-authority.test.tsx`
   - verifies `AuditsShowcasePage` still routes topbar actions through the shared modal contract
   - verifies the page now exposes the public Anna entry point

## Why it matters

Before this packet, a visitor could move from canonical `/`, shared-shell pages, `ResourcesPage`, or `ToolsShowcasePage` to
`AuditsShowcasePage` and lose access to Anna completely.

After this packet, `AuditsShowcasePage` preserves the same bounded assistant availability and handoff continuity as the rest of
the accepted landing slices.

## Verification

- `npm exec vitest run tests/components/AuditsShowcasePage.cta-authority.test.tsx tests/components/ToolsShowcasePage.cta-authority.test.tsx tests/components/ResourcesPage.cta-authority.test.tsx tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

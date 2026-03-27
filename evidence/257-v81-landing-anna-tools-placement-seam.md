# V8.1 Evidence - Landing Anna tools placement Seam

Date: 2026-03-26
Lane: `Landing Anna tools placement`
Taxonomy: `T4`
Packet: `tools-page assistant placement continuity`

## Goal

Close the bounded Anna placement seam where `ToolsShowcasePage` still exposed landing conversion chrome without exposing the
public assistant.

## What changed

1. `src/views/ToolsShowcasePage.tsx`
   - mounts `AnnaAssistantWidget` on the bespoke `ToolsShowcasePage` shell
   - routes `Demo`, `Trial`, and `Contact` handoffs through the page's existing authority
2. `tests/components/ToolsShowcasePage.cta-authority.test.tsx`
   - verifies `ToolsShowcasePage` still routes topbar actions through the shared modal contract
   - verifies the page now exposes the public Anna entry point

## Why it matters

Before this packet, a visitor could move from canonical `/`, shared-shell pages, or `ResourcesPage` to `ToolsShowcasePage`
and lose access to Anna completely.

After this packet, `ToolsShowcasePage` preserves the same bounded assistant availability and handoff continuity as the rest of
the accepted landing slices.

## Verification

- `npm exec vitest run tests/components/ToolsShowcasePage.cta-authority.test.tsx tests/components/ResourcesPage.cta-authority.test.tsx tests/components/BecomePartnerView.marketing-shell.test.tsx tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

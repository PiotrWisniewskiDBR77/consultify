# V8.1 Evidence - Landing Anna handoff CTA Authority Seam

Date: 2026-03-26
Lane: `Landing Anna handoff`
Taxonomy: `T4`
Packet: `anna widget CTA handoff authority`

## Goal

Close the bounded landing assistant seam where Anna's public contract promises visible `Demo`, `Trial`, and `Contact`
handoffs, but the live widget exposes only suggestion chips and chat input.

## What changed

1. `src/components/Landing/AnnaAssistantWidget.tsx`
   - adds explicit `Demo`, `Trial`, and `Contact` handoff controls inside the widget
   - routes those controls through shared callbacks when provided
   - keeps bounded fallback navigation for `/demo`, `/trial`, and `/contact`
   - adds an explicit `aria-label` for the launcher button so the widget has stable accessibility authority
2. `src/views/ProductEntryPage.tsx`
   - passes canonical homepage `onDemoClick`, `onTrialClick`, and `onContactClick` handlers into Anna
   - keeps Anna aligned with the same modal-backed landing conversion contract already used by topbar, hero, KB preview, and
     footer
3. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`
   - verifies shared callback authority
   - verifies canonical fallback navigation when callbacks are absent
4. `tests/components/ProductEntryPage.kb-preview.test.tsx`
   - verifies canonical `/` now wires Anna to all three landing handoff callbacks

## Why it matters

Before this packet, Anna could talk about demo/trial/contact paths but could not expose them as first-class public actions on
the widget surface itself. That left the contract true in docs but incomplete in the UI.

After this packet, Anna's public landing surface now exposes governed handoff controls and canonical `/` routes them through
the same conversion authority already used elsewhere on the landing page.

## Verification

- `npm exec vitest run tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx tests/components/ProductEntryPage.kb-preview.test.tsx`

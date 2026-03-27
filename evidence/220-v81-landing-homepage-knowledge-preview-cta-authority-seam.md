# V8.1 Evidence - Landing homepage IA Knowledge Preview CTA Authority Seam

Date: 2026-03-26
Lane: `Landing homepage IA`
Taxonomy: `T4`
Packet: `knowledge preview CTA authority`

## Goal

Close the next bounded `Landing homepage IA` seam by aligning `KnowledgePreviewSection` on the canonical `/` page with the
same shared trial conversion contract used by the rest of the homepage.

## What changed

1. `src/components/Landing/KnowledgePreviewSection.tsx`
   - adds an optional shared `onTrialClick` callback
   - routes landing article and footer CTAs through that callback when provided
   - keeps a safe fallback to canonical `ROUTES.TRIAL_ENTRY` for other surfaces
2. `src/views/ProductEntryPage.tsx`
   - passes the homepage shared trial handler into `KnowledgePreviewSection`
3. `tests/components/KnowledgePreviewSection.cta-authority.test.tsx`
   - proves the section uses the shared trial callback on landing
   - proves the fallback still routes to canonical `/trial` when the callback is absent

## Why it matters

Before this packet, the canonical `/` homepage used a shared modal-backed conversion contract in its hero and topbar but the
knowledge preview area still bypassed that contract with raw `/trial` navigation.

After this packet, the section follows the same homepage conversion authority without breaking compatibility for other public
surfaces that still reuse the component.

## Verification

- `npx vitest run tests/components/KnowledgePreviewSection.cta-authority.test.tsx --maxWorkers=1 --maxConcurrency=2`

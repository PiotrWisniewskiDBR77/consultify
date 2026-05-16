# My Work > Radar Backlog

Status: `ACTIVE`
Date: 2026-05-01
Screen: `My Work > Radar`
Current focus: UI/UX review and migration only.

## Purpose

This file captures non-UI/UX items discovered while reviewing `My Work > Radar`.

UI/UX findings belong in:

- `../UI_UX_MIGRATION_AUDIT.md`
- approved implementation tasks for the current screen

Non-UI/UX items belong here.

## Items

### BLG-20260501-001 - Radar content is not ready for UI/UX approval

Status: `new`
Source screen: `My Work > Radar`
Type: `product-idea`
Priority: `P1`
Owner: `Product / UX / AI`

Observation:
- Piotr marked the current Radar content as "dramat obecnie".
- The current pass should improve surrounding chrome and controls only: Menu 1, breadcrumb, Menu 3 button treatment.
- The actual Radar content, information architecture, signal quality, hierarchy and card composition need a separate review.

Why it is not handled now:
- We are standardizing UI/UX module by module and should not turn this pass into a full product/content redesign of Radar.
- Radar content likely depends on product decisions, AI signal logic and data truth, not only visual styling.

Next action:
- Schedule a dedicated Radar content review after shell/chrome corrections are accepted.
- Decide what Radar should communicate, which blocks are useful, which blocks should be removed, and what target dashboard pattern should be frozen.

Links:
- `src/components/MyWork/Home/HomeView.tsx`
- `src/components/MyWork/Home/RadarTriageCard.tsx`
- `src/components/MyWork/Home/useHomeData.ts`

## Review Notes

Use this area during the Radar pass to keep temporary notes before turning them into backlog items.

- UI/UX scope: layout, shell, Menu 2, Menu 3, cards/tables, empty states, density, hierarchy, typography, buttons, filters, AI action placement.
- Backlog scope: broken data, missing business logic, wrong permissions, new features, performance, copy/content strategy, analytics, backend/API issues.

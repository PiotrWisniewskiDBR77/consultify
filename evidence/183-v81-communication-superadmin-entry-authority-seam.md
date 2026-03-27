# V8.1 Evidence - Communication Superadmin Entry Authority Seam

Date: 2026-03-26
Lane: `Communication`
Taxonomy: `T4`
Packet: `communication superadmin entry authority`

## Goal

Close the first bounded `Communication` split-brain seam by giving the existing superadmin communication center a real
route / AppView authority instead of leaving it accessible only as tab state inside `CustomersModule`.

## What changed

1. Added `AppView.SUPERADMIN_COMMUNICATION` as a dedicated communication entry authority.
2. Added the canonical route `/superadmin/customers/communication`.
3. Aligned route and navigation helpers so the new communication entry resolves coherently through:
   - `APP_VIEW_TO_ROUTE`
   - `getAppViewFromRoute()`
   - `getAppViewFromPath()`
   - superadmin sidebar section mapping
   - view-to-module/help mapping
   - `SuperAdminView` legacy-tab redirect logic
4. Replaced the placeholder `CustomersModule` test with a real regression proving that
   `initialTab="communication"` opens the communication center.

## Why it matters

Before this packet, the communication center already had a real backend contract, but no first-class operator entry
authority. That meant the communication lane started from tab-state drift rather than a canonical routed surface.

After this packet, `Communication` now has a bounded user-facing authority seam that can be promoted honestly without
pretending the broader communication runtime is complete.

## Verification

- `npx vitest run tests/unit/routes/routeConfig.test.ts tests/integration/superAdminNavigation.test.ts tests/integration/superAdminNavigation.test.tsx tests/components/SuperAdmin/CustomersModule.test.tsx`

## Residual risk

- The communication runtime itself is still broader than this packet.
- Stakeholder communication, notifications, and channel-routing breadth remain separate follow-up candidates.

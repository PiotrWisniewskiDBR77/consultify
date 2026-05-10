---
module_id: MODULE_PARTNER_PORTAL
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Portal Partnerski

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `PARTNER_PORTAL` global menu item
- Launch AppView: `AppView.PARTNER_LANDING`
- Launch route: `/partner/*`
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- Canonical ownership note: Canonical portal ownership is protected `/partner/*`; public partner acquisition routes remain related but not portal-internal ownership.

## Routed Components

- `src/routes/AppRoutes.tsx` -> `ROUTES.PARTNER.LANDING` renders `PartnerPortalViewNew` under `ProtectedRoute`
- `src/views/partner/PartnerPortalView.tsx` is active portal root
- Public related surfaces: `/become-partner`, `/become-partner/apply`, `/partner/pricing`

## Relevant Services / Types

- `src/services/funnelAnalytics.ts` (public-to-portal journey analytics)
- `src/types/core.ts` (partner AppView family)
- `src/types/core.ts` keeps enum identity for `AppView.PARTNER_LANDING`.

## Current Runtime Status

- Classification: `real + partial`
- This codemap is As-Is only and reflects currently mounted route behavior.

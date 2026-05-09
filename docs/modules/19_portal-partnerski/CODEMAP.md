---
module_id: MODULE_PARTNER_PORTAL
doc_kind: CODEMAP
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Codemap — Portal partnerski

## Route / AppView / Entry component

Źródło routingowe: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`.

- **Partner portal root**: `/partner/*`
  - **Entry component**: `PartnerPortalViewNew` (`src/views/partner/PartnerPortalView`)
- **Public recruitment / apply**:
  - `/become-partner` → `BecomePartnerView`
  - `/become-partner/apply` → `PartnerApplicationView`
- **Route config**: `src/routes/routeConfig.ts` (`ROUTES.PARTNER`, `ROUTES.BECOME_PARTNER`)
- **Router mount**: `src/routes/AppRoutes.tsx`
- **AppView enum**: `src/types/core.ts` (`PARTNER_*`)

## Implementation notes

Kontrakt produktowy P29 jest kanoniczny dla lifecycle/ledger/roles, nawet jeśli bieżący routing UI jest węższy niż doc‑scope.


---
module_id: MODULE_PARTNER_PORTAL
doc_kind: META
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# META — Portal partnerski

## Purpose

Ten plik definiuje metadane kontraktu modułu `Portal partnerski` i jego miejsce w systemie.

## Identity

- **Sidebar label**: Portal partnerski
- **Folder**: `19_portal-partnerski`
- **Module id**: `MODULE_PARTNER_PORTAL`

## Canonicality

- **Contract status**: draft (w trakcie migracji z istniejących SoT)
- **Primary SSOT map**: `SSOT.md`

## Open questions (max 3)

1. Jakie API jest kanoniczne dla ledger/payouts (P29 opisuje semantykę, ale nie widzimy tu listy endpointów w repo)?
2. Jak wygląda model “partner roles” w kodzie (Partner member/admin) i jak jest mapowany na `currentUser`?
3. Jakie elementy operator tower dla partner program są już zamontowane w `/superadmin/*` i gdzie jest ich SSOT w repo (w `SUPERADMIN_V8_SSOT.md` brakuje plików)?


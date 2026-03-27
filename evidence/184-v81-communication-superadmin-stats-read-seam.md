# V8.1 Evidence - Communication Superadmin Stats Read Seam

Date: 2026-03-26
Lane: `Communication`
Taxonomy: `T4`
Packet: `communication superadmin stats read continuity`

## Goal

Close the next bounded communication packet on the same superadmin communication surface by surfacing the existing
communication stats contract in the live `CustomerCommunicationView`.

## What changed

1. `CustomerCommunicationView` now reads `Api.getCommunicationStats()` together with the existing communications list.
2. The live communication center now renders a compact runtime summary strip for:
   - total messages
   - sent messages
   - average open rate
3. Added a real component regression proving the view consumes the existing stats contract and renders the returned
   values on the active communication surface.

## Why it matters

Before this packet, the communication center had a real list/send contract and even an existing backend stats route, but
the live operator surface ignored that runtime summary entirely.

After this packet, the same active communication surface now has:

- canonical entry authority
- live message list continuity
- live communication stats continuity

without broadening into deeper communication runtime completion.

## Verification

- `npx vitest run tests/components/SuperAdmin/CustomerCommunicationView.test.tsx tests/components/SuperAdmin/CustomersModule.test.tsx tests/unit/routes/routeConfig.test.ts tests/integration/superAdminNavigation.test.ts tests/integration/superAdminNavigation.test.tsx`

## Residual risk

- The broader communication domain still exceeds the current bounded superadmin surface.
- The clearest next candidate is the separate `stakeholder-comm` runtime slice rather than more minor superadmin polish.

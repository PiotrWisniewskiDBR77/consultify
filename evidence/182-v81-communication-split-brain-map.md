# V8.1 Evidence - Communication Split-Brain Map

Date: 2026-03-26
Lane: `Communication`
Taxonomy: `T4`
Status: `active`

## Why this lane is promoted now

`Communication` was previously grouped into the deferred `T4` parking lot. After explicit unlock, the lane needs a
bounded starting point that does not pretend to complete the full Communication v8 package.

## Canonical product scope

`docs/product/COMMUNICATION_V8_SSOT.md` defines Communication v8 as the governed layer spanning internal and external
communication, notifications, routing, and message-to-work conversion. It explicitly does not replace `Chat`, `Inbox`,
or `Sync`.

`docs/product/COMMUNICATION_V8_READINESS_AUDIT.md` says the main remaining gaps are implementation-facing:

- no complete communication runtime implementation
- no full channel routing UX
- no complete connector-backed external communication flow
- no complete client-safe delivery review flow

## Surface truth before promotion

The clearest existing user-facing communication surface is the superadmin customer communication center:

- `src/views/superadmin/customers/CustomerCommunicationView.tsx`
- `src/views/superadmin/CustomersModule.tsx`

That surface already uses a real backend contract:

- `Api.getCommunications()`
- `Api.createCommunication()`
- `Api.sendCommunication()`

but it does not have a dedicated route / AppView authority. It is reachable only as tab state inside the broader
`CustomersModule`.

## Bounded first packet

Packet 1 is narrowed to:

1. create a dedicated superadmin communication entry authority
2. canonicalize the route to `/superadmin/customers/communication`
3. align AppView, route mapping, sidebar/module mapping, and `CustomersModule` initial-tab continuity
4. add bounded regression

## Explicitly not this packet

- broad communication-runtime completion
- stakeholder communication plans and SteerCo packs
- notification-system consolidation
- connector-backed external delivery routing
- partner outreach or wider campaign systems

## Why this is the right first slice

This is the smallest real product-facing communication seam that:

- already has a live UI surface
- already has a real backend contract
- still has obvious authority drift

so it reduces split-brain without falsely claiming broad Communication v8 completion.

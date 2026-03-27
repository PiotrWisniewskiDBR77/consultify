# T4 Charter - Communication

Date: 2026-03-26
Lane: `Communication`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`Communication` was previously deferred inside the `T4` parking lot and required explicit product unlock. That unlock is
now granted. The smallest honest starting point is not broad communication-runtime completion, but one user-facing
authority seam around the existing superadmin communication center.

## Goal

Promote one bounded communication slice that reduces mixed truth across:

- the operator-facing communication entry surface
- route / AppView / module authority for `Customers -> Communication`
- the already-existing customer communication center and its backend contract

## In scope

1. one bounded communication packet at a time
2. split-brain map for frontend surfaces, runtime contracts, and evidence
3. canonical entry authority for the first visible communication surface
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. full Communication v8 runtime completion
2. stakeholder communication / PMO plan runtime convergence
3. notification-system consolidation
4. connector-backed channel routing completion
5. broader chat, inbox, sync, or partner outreach expansion

## Initial bounded packet

Packet 1:

- canonicalize the superadmin customer communication entry to a dedicated route / AppView authority
- let `CustomersModule` open the `communication` tab through a real communication-specific entry point
- keep the existing communication send/list runtime intact

Why this first:

- it is the smallest user-facing split-brain cut
- the `CustomerCommunicationView` and backend contract already exist
- the main gap is that the surface is only reachable as tab state inside `CustomersModule`, not as a first-class
  communication entry

Recorded in:

- `evidence/182-v81-communication-split-brain-map.md`

## Packet 1

Completed:

- add `SUPERADMIN_COMMUNICATION` as a dedicated superadmin communication entry authority
- add canonical route `/superadmin/customers/communication`
- align route, AppView, sidebar section mapping, module/help mapping, and `CustomersModule` initial-tab continuity
- add bounded regression for route mapping and communication-tab entry

Recorded in:

- `evidence/183-v81-communication-superadmin-entry-authority-seam.md`

## Packet 2

Completed:

- add one bounded read continuity slice for the existing communication stats contract on the active superadmin
  communication surface
- let `CustomerCommunicationView` render total, sent, and average open-rate summary directly from
  `/superadmin/communications/stats`
- add bounded regression for the communication stats strip

Recorded in:

- `evidence/184-v81-communication-superadmin-stats-read-seam.md`

## Packet 3

Completed:

- move the next bounded communication packet into the separate stakeholder communication runtime
- replace raw `/api/stakeholder-comm/*` reads inside `PeopleChangeWorkspace` with a shared API client seam
- add bounded regression proving stakeholder communication reads now load through the shared client path

Recorded in:

- `evidence/185-v81-communication-stakeholder-runtime-read-seam.md`

## Packet 4

Completed:

- add one bounded visible stakeholder communication write workflow on the active `PeopleChangeWorkspace` surface
- expose the next pending communication plan item with a `Send now` action
- route plan-item read + send continuity through shared API client seams with regression coverage

Recorded in:

- `evidence/186-v81-communication-stakeholder-plan-item-send-seam.md`

## Packet 5

Completed:

- expose steerco-pack runtime continuity on the active stakeholder communication surface
- render steerco-pack rows inside `PeopleChangeWorkspace`
- add bounded `Distribute now` continuity through a shared API seam with regression coverage

Recorded in:

- `evidence/187-v81-communication-steerco-pack-distribution-seam.md`

## Acceptance decision

`Communication` is accepted as a bounded `T4` lane.

Why:

- the superadmin communication surface now has canonical entry authority plus list/stats continuity
- the stakeholder communication surface now has shared-client read continuity plus visible `plan-item send` and
  `steerco-pack distribution` continuity
- no active visible communication surface in the promoted lane still depends on raw direct route fetches or lacks a
  bounded operator-facing path

Recorded in:

- `evidence/188-v81-communication-t4-acceptance.md`

## Next bounded candidate

1. none inside the accepted bounded `Communication` lane
2. keep broader communication-runtime completion out of scope unless explicitly rechartered

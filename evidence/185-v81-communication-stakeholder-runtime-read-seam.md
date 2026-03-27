# V8.1 Evidence - Communication Stakeholder Runtime Read Seam

Date: 2026-03-26
Lane: `Communication`
Taxonomy: `T4`
Packet: `stakeholder communication runtime read seam`

## Goal

Move the next bounded communication packet into the separate stakeholder communication runtime by replacing raw
`PeopleChangeWorkspace` communication reads with a shared API client seam.

## What changed

1. Added shared `Api` methods for stakeholder communication reads:
   - `getStakeholderSegments()`
   - `getStakeholderPlans()`
   - `getStakeholderOverduePlans()`
   - `getStakeholderSendLog()`
2. Replaced raw `/api/stakeholder-comm/*` fetches inside `PeopleChangeWorkspace` communication tab with those shared
   methods.
3. Added a real component regression proving the communication tab now loads its stakeholder communication reads through
   the shared client seam rather than direct route fetches.

## Why it matters

Before this packet, the communication lane had already established superadmin entry authority and bounded stats/list
continuity, but the separate stakeholder communication runtime inside `PeopleChangeWorkspace` still bypassed the shared
client layer with direct route fetches.

After this packet, the communication lane now spans two coherent bounded read surfaces:

- superadmin communication center authority and summary continuity
- stakeholder communication runtime read continuity through a shared client seam

without yet broadening into deeper communication workflow writes.

## Verification

- `npx vitest run tests/components/Execution/PeopleChangeWorkspace.communication.test.tsx tests/components/SuperAdmin/CustomerCommunicationView.test.tsx`

## Next bounded candidate

- stakeholder communication write continuity for a visible workflow such as plan-item send or steerco-pack distribution

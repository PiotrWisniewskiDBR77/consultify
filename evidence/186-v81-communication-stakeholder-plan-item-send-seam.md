# V8.1 Evidence - Communication Stakeholder Plan Item Send Seam

Date: 2026-03-26
Lane: `Communication`
Taxonomy: `T4`
Packet: `stakeholder communication plan-item send seam`

## Goal

Close the next bounded stakeholder communication write packet by exposing a visible `plan-item send` action on the
active `PeopleChangeWorkspace` communication surface and routing it through a shared API seam.

## What changed

1. Added shared stakeholder communication plan-item API methods:
   - `getStakeholderPlanItems()`
   - `sendStakeholderPlanItem()`
2. `PeopleChangeWorkspace` communication tab now reads plan items for each visible communication plan.
3. The active communication tab now exposes a bounded `Send now` action for the next pending plan item on a plan.
4. Sending a plan item now goes through the shared client seam and refreshes the communication surface state.
5. Added regression proving both the stakeholder read path and the new send action use the shared API seam rather than
   raw `/api/stakeholder-comm/*` fetches.

## Why it matters

Before this packet, the stakeholder communication runtime had bounded read continuity, but no visible write continuity
on the active workspace surface.

After this packet, the communication lane now has:

- superadmin communication entry authority
- superadmin stats/list continuity
- stakeholder runtime read continuity
- stakeholder runtime plan-item send continuity

on real operator-facing surfaces, without broadening into full communication-program management.

## Verification

- `npx vitest run tests/components/Execution/PeopleChangeWorkspace.communication.test.tsx tests/components/SuperAdmin/CustomerCommunicationView.test.tsx`

## Next bounded candidate

- add a bounded `steerco-pack` distribution packet if the lane should continue deeper into stakeholder communication
  workflows

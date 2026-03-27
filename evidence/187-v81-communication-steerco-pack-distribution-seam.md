# V8.1 Evidence - Communication SteerCo Pack Distribution Seam

Date: 2026-03-26
Lane: `Communication`
Taxonomy: `T4`
Packet: `steerco-pack distribution continuity`

## Goal

Close the next bounded stakeholder communication workflow packet by exposing steerco-pack distribution continuity on the
active `PeopleChangeWorkspace` communication surface.

## What changed

1. Added shared API seam methods for steerco packs:
   - `getSteercoPacks()`
   - `distributeSteercoPack()`
2. `PeopleChangeWorkspace` communication tab now renders a `SteerCo Packs` section from the existing runtime contract.
3. Draft steerco packs now expose a visible `Distribute now` action on the active stakeholder communication surface.
4. Distribution is routed through the shared client seam and refreshes the communication tab state after completion.
5. Regression coverage now proves steerco-pack distribution also avoids raw `/api/stakeholder-comm/*` fetches.

## Why it matters

Before this packet, stakeholder communication already had bounded read continuity plus plan-item send continuity, but
the adjacent steerco-pack distribution workflow still had no operator-facing path on the active communication surface.

After this packet, the same bounded stakeholder communication surface now covers:

- shared-client reads
- plan-item send continuity
- steerco-pack distribution continuity

without broadening into full communication program administration.

## Verification

- `npx vitest run tests/components/Execution/PeopleChangeWorkspace.communication.test.tsx`

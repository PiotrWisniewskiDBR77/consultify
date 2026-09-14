# Canonical Gantt measurement — DEC-497 P2

Measured before implementation at base `13070169a439985e34db2d8daa9807cb26870599`.

Canonical component: `src/components/Initiatives/gantt/InitiativeGantt.tsx`.

The component already exposes the projection contract needed by later P2 stages:

- `GanttDependency { fromId, toId }` for directed dependency connectors;
- `dependencies?: GanttDependency[]` on `InitiativeGanttProps`;
- `criticalPathIds?: string[]` for highlighted bars and connectors;
- day, week, and month zoom modes;
- one normalized `ScheduleItem[]` time source and the supplied canonical writer callback for rescheduling.

Decision: E2/E3 must adapt accepted dependency observations and critical-path IDs into this component. No additional Gantt component is justified or created by E1.

E1 contains no user-facing UI. Light/dark screenshots are therefore not applicable at this checkpoint; they remain an E2/E3 acceptance gate.

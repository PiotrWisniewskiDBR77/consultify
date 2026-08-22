# Admin — owner feedback register

Date opened: `2026-08-21`

Intake status: `OWNER_REVIEW_IN_PROGRESS / CAPTURED_UNRECONCILED`

## ADM-OWN-001 — Reconstruct the complete Admin panel

- Module: `Admin`
- Scope: seven visible Admin areas and eight supplied screenshots; routes
  `NOT VERIFIED`
- Category: `UI / UX / CX / INFORMATION ARCHITECTURE / FUNCTIONAL READINESS`
- Piotr's original wording: preserved in full in
  [`ADM-OWN-001_SEVEN_TASK_BLUEPRINT.md`](ADM-OWN-001_SEVEN_TASK_BLUEPRINT.md).
- Current behavior:
  - seven entries use inconsistent screen structures and interaction patterns;
  - the menu mixes user tasks, technical surfaces and an ambiguous command
    center metaphor;
  - several screens expose different headers, tabs, cards, tables, form widths
    and save/action placement;
  - screenshots show controls and data surfaces, but do not prove actual
    permission enforcement, persistence, provider connections or readback.
- Expected experience:
  - rebuild the Admin IA around seven clear administrator tasks;
  - each menu module expands into screen-level children using the Settings
    navigation and visual standard;
  - define every screen, control, permission, state and destructive safeguard;
  - separate Command Center aggregation from technical System Health;
  - separate team/role administration from identity/security policies;
  - preserve a single canonical edit location for every administrative object.
- Importance: `CRITICAL / CROSS-CUTTING`
- Functional readiness: `NOT VERIFIED`
- Evidence: `ADM-EVD-001` through `ADM-EVD-008`, `XMOD-EVD-001`
- Detailed plan: [`ADM-OWN-001_SEVEN_TASK_BLUEPRINT.md`](ADM-OWN-001_SEVEN_TASK_BLUEPRINT.md)
- Open questions: `ADM-Q-001` through `ADM-Q-005`
- Status: `CAPTURED_UNRECONCILED`

## Open questions

### ADM-Q-001 — Admin role model

Confirm Owner, Admin, Billing Admin, AI Admin, Security/Audit Admin, Operations
Admin and read-only Auditor permissions, including dual approval and break-glass.

- Decision control: `ADM-DEC-001`
- Status: `OPEN_UNRECONCILED`

### ADM-Q-002 — Customer Admin versus platform Operations

Define which Health actions a customer administrator may perform and which
belong only to platform operators.

- Decision control: `ADM-DEC-002`
- Status: `OPEN_UNRECONCILED`

### ADM-Q-003 — Billing capability scope

Confirm whether self-service plan/payment mutation is intended or whether the
surface remains read-only/contact-sales for enterprise plans.

- Decision control: `ADM-DEC-003`
- Status: `OPEN_UNRECONCILED`

### ADM-Q-004 — Command Center scope

Confirm dashboard aggregation sources, freshness requirements and role-based
visibility; Command Center must not become another configuration surface.

- Decision control: `ADM-DEC-004`
- Status: `OPEN_UNRECONCILED`

### ADM-Q-005 — Organization and Settings ownership

Confirm which configuration belongs to Admin versus personal Settings versus
business Organization context, with no duplicate write locations.

- Decision control: `ADM-DEC-005`
- Status: `OPEN_UNRECONCILED`

## Counters

- Observations: `1`
- Evidence items: `8` Admin + `1` cross-module reference
- Open questions: `5`
- Fixed: `0`
- Accepted: `0`

# UI/UX Migration Backlog

Status: `ACTIVE`
Date: 2026-05-01
Parent process: `../UI_UX_MIGRATION_PLAN.md`
Parent standard: `../CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`

## Purpose

This folder captures everything discovered while reviewing Consultify module by module that should not interrupt the current UI/UX migration flow.

The rule is simple:

- If it is part of the current screen's UI/UX standardization, handle it in the current migration pass.
- If it is a bug, product idea, technical debt, data issue, permission issue, copy question, workflow question or future enhancement, add it to backlog and keep moving.

This prevents losing context without turning UI/UX migration into an uncontrolled refactor.

## Working Formula

For each function/screen:

1. Identify location and current UI.
2. Compare with Golden Standard.
3. Decide UI/UX changes for this pass.
4. Log non-UI topics in backlog.
5. Implement approved UI/UX changes only.
6. Piotr reviews the screen.
7. Approved pattern is frozen or marked as migration debt.

## Backlog Item Format

Use this structure:

```md
### BLG-YYYYMMDD-XXX — Short title

Status: `new | triaged | planned | in_progress | done | rejected`
Source screen: `Module > Function`
Type: `bug | product-idea | tech-debt | data | permissions | workflow | copy | future-standard`
Priority: `P0 | P1 | P2 | P3`
Owner: `Product | Engineering | UX | AI | TBD`

Observation:
- What was noticed.

Why it is not handled now:
- Why it should not block the current UI/UX migration pass.

Next action:
- What should happen later.

Links:
- Code/docs/screenshots if relevant.
```

## Files

- `GLOBAL_BACKLOG.md` - cross-module issues and ideas.
- `MY_WORK_RADAR.md` - backlog and notes while reviewing `My Work > Radar`.

## Status Rules

- `new` - captured, not yet analyzed.
- `triaged` - understood and categorized.
- `planned` - accepted for future work.
- `in_progress` - currently being worked.
- `done` - resolved.
- `rejected` - consciously not doing.

## Priority Rules

- `P0` - blocks UI/UX migration or creates serious user harm.
- `P1` - important, should be planned soon.
- `P2` - valuable, not urgent.
- `P3` - idea/debt for later.

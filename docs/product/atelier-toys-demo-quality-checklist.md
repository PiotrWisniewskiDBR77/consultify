# Atelier Toys Demo Quality Checklist

## Canonical Story
- `Atelier Toys` is presented as a 250-person EdTech/STEM manufacturer in Lyon.
- Leadership personas match the public narrative: CEO, CFO, CTO, Plant, Procurement, Maintenance, QA, Sales, Marketing, Senior Advisor.
- The core story ties together `Atelier Forward`, Digital Twin, IRIS, SaaS growth, and governance.

## Dynamic Dates
- Seeded tasks, milestones, decisions, and reports are materialized from `relative date` specs.
- The demo remains believable when rebuilt weeks or months later.
- Board-gate and quarter-boundary records move with the anchor date instead of hardcoded calendar years.

## Session Isolation
- Enabling demo creates a fresh `demo_sessions` record plus a dedicated `session_org_id`.
- API requests in demo mode carry `X-Demo-Session-Org`.
- Interactive writes target the session tenant, not the canonical base tenant.
- Disabling demo or TTL expiry removes the session tenant dataset.

## Tool Coverage
- Executive overview shows projects, initiatives, reports, decisions, and ROI narrative.
- Factory operations shows Line 3 Digital Twin, maintenance tasks, and ops milestones.
- PMO/portfolio shows dependencies, milestones, task ownership, and governance.
- AI workspace has seeded prompts and knowledge docs with role-aware context.

## Release Smoke Checks
- `server/scripts/build-demo-dataset.ts --write` rebuilds the canonical base org without relying on legacy clone scripts.
- `/api/demo/toggle` returns `demoSession.organizationId`.
- `/api/demo/status` preserves the same active session until TTL/exit.
- `/api/demo/organization` returns Atelier Toys scenarios and coverage map.

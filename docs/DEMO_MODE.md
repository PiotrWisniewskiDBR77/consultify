# Demo Mode - Documentation

## Overview

Consultify supports two demo experiences built on the same seeded `Atelier Toys` sample workspace:

1. **Sales demo**
   Used from public landing and trial entry points. This flow can still contain conversion messaging.

2. **Workspace demo**
   Used by logged-in users from the profile menu. This flow is intentionally read-only and educational. Its goal is to help users understand how work happens in Consultify on realistic sample data, not to push them into sales or trial actions.

## Current sample workspace

### Demo company: Atelier Toys

A sample manufacturing and transformation environment designed to show how strategy, execution, AI, and reporting connect.

### Included demo data

| Module              | Content                                                          |
| ------------------- | ---------------------------------------------------------------- |
| **Assessments**     | Multiple maturity and operating baseline examples                |
| **Projects**        | Cross-functional transformation projects                         |
| **Initiatives**     | Strategic initiatives with owners, progress, and milestones      |
| **Tasks**           | Execution follow-up with statuses and assignees                  |
| **Decisions**       | Decision records linked to portfolio work                        |
| **Reports**         | Executive and operational reporting examples                     |
| **AI Context**      | Sample prompts, recommendations, and generated supporting output |

## Workspace demo principles

When a logged-in user opens demo from the profile menu:

- the user enters a **sample workspace**, not a sales funnel
- the workspace is **read-only**
- prompts should explain **how to use the product**
- UI should point toward **how to repeat the same workflow in the user’s own workspace**
- conversion CTAs such as `Start Trial`, `Upgrade`, `Schedule Demo`, or `Contact Sales` should not appear in this flow

## What users can do

- browse dashboards, projects, initiatives, and reports
- inspect linked execution flows across modules
- use guided onboarding to understand typical role-based scenarios
- interact with AI within demo guardrails
- compare the sample workflow with what they later want to do in their own workspace

## Limitations

- changes are session-scoped and do not persist as live work
- write operations are blocked or simulated depending on the route
- AI usage may still be limited by demo/session constraints
- notifications and integrations should not be treated as production behavior

## Entry points

### Workspace demo

1. Open the user profile menu
2. Select `Open Sample Workspace`
3. Review the onboarding walkthrough and scenario cards
4. Exit back to the user’s own workspace when ready

### Sales demo

Public landing and trial flows may still enter the same seeded environment, but with a different product purpose and telemetry classification.

## Technical implementation

### Frontend

- `src/store/slices/demoSlice.ts`
  Stores demo session state, locale, and demo experience type.
- `src/hooks/useDemo.ts`
  Syncs demo status from the backend and exposes toggle/exit actions.
- `src/components/demo/DemoSessionManager.tsx`
  Orchestrates onboarding and conditional demo UI.
- `src/components/demo/DemoWelcomeTour.tsx`
  Provides scenario-based onboarding.
- `src/components/layout/UserProfileMenu.tsx`
  Main entry point for workspace demo.
- `src/components/layout/DemoModeBanner.tsx`
  Shows contextual read-only and next-step guidance.

### Backend

- `server/src/routes/demo.routes.ts`
  Returns demo state and now classifies demo experience type.
- `server/src/services/demo/demoSessionService.ts`
  Creates and resolves isolated session workspaces.
- `server/src/middleware/demoGuard.middleware.ts`
  Protects writes in demo mode.
- `server/src/services/demoTrialTelemetryService.ts`
  Records demo-related telemetry, with workspace demo separated from sales funnel mapping.

## Data model

Demo data is stored in isolated session organizations created from the Atelier Toys template.

- base demo org: `DEMO_ORG_ID`
- active user session org: generated per session in `demo_sessions`
- demo sessions expire automatically and are cleaned up

## Configuration

```env
DEMO_MODE_ENABLED=true
DEMO_SESSION_DURATION=24
DEMO_ALLOW_WRITES=false
```

## Maintenance notes

- workspace demo should be reviewed primarily as a **product enablement surface**
- sales demo should be reviewed primarily as a **public acquisition surface**
- changes to copy, prompts, and telemetry must preserve that separation

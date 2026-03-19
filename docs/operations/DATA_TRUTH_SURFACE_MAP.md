# Data Truth Surface Map

## Purpose

This document is the operational map for answering one question before release:

`What exact data source, scope, and fallback behavior is the user looking at on this screen?`

## Critical Screens

| Screen | Frontend entry | Backend/API | Primary tables | Backend scope | Frontend scope | Demo/fallback |
| --- | --- | --- | --- | --- | --- | --- |
| My Work > Tasks | `src/components/MyWork/MyTasksListContent.tsx` | `GET /api/my-work/personal-tasks` | `tasks`, `users` | `organization_id`, owner scope, `task_type='personal'`, hides `done/completed/validated` by default | search, urgent/new presets, table filters | Demo banner only; no silent sample rows outside demo mode |
| Legacy My Work compact tasks | `src/components/MyWork/MyTasksList.tsx` | `GET /api/my-work/personal-tasks` | `tasks` | same as above | time-group buckets | No silent sample rows |
| Initiatives | `src/components/Initiatives/InitiativesHub.tsx` | `GET /api/initiatives/portfolio`, fallback `GET /api/initiatives` | `initiatives`, related joins | `organization_id`, status filters, optional project filter | search, status chips, priority filters | Showcase merge allowed only in demo mode |
| Finance > Statements / Models / Analysis / Valuation | `src/components/Economics/hooks/useFinanceData.ts` | `/api/finance-statements/packs`, `/api/financial-modeling/models`, `/api/economics/*` | finance statement tables, models, analyses, valuations, budgets | org-scoped finance endpoints | tab-local search and status filters | Sample finance records allowed only in demo mode |
| Reports & Presentations | `src/components/ReportsAndPresentations/useRapData.ts` | `/api/report-builder*`, `/api/presentations*` | report/deck/template tables | org/application scope per endpoint | search and topbar filters | Sample content allowed only in demo mode |
| Interview | `src/components/Interview/InterviewHub.tsx` | `/api/interview/*` | interview sessions, assignments, insights, templates | org/user scope with permissions | tab-specific filters and previews | Demo dataset allowed only in demo mode |
| Demo banner / data context | `src/components/layout/DemoBanner.tsx` | `GET /api/health/data-context` | runtime config + auth context | resolved DB target, active org, demo context | global banner | Explicitly visible |

## Task Semantics

### Personal tasks

- Endpoint: `GET /api/my-work/personal-tasks`
- Source table: `tasks`
- Required semantics:
  - `task_type='personal'`
  - scoped by active organization
  - scoped by assignee identity
  - hides `done`, `completed`, `validated` unless `includeDone=true`

### General tasks

- Endpoint family: `/api/tasks`
- Source table: `tasks`
- Semantics:
  - broader operational/project scope
  - not interchangeable with the personal tasks view

## Demo Rules

- Demo mode may change active organization context through `X-Demo-Mode`.
- Business modules must behave as:
  - real data when API returns rows
  - empty state when API returns no rows
  - error state when API fails
  - sample/demo data only when demo mode is explicitly active

## Operator Commands

```bash
npm run db:inventory
npm run db:audit:truth
npm run release:gate:data-truth
```

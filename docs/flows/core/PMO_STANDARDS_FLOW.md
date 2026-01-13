# FLOW-PMO-001: PMO Standards Configuration

> **ID:** FLOW-PMO-001 | **Status:** ✅ Complete | **Priority:** P0

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Konfiguracja standardów PMO per organizacja/projekt: PRINCE2, PMBOK, Agile, SAFe, Custom.

## Supported Standards

| Standard    | Full Name                            | Origin            |
| ----------- | ------------------------------------ | ----------------- |
| **PRINCE2** | Projects IN Controlled Environments  | UK Government     |
| **PMBOK**   | Project Management Body of Knowledge | PMI               |
| **AGILE**   | Agile/Scrum                          | Agile Alliance    |
| **SAFE**    | Scaled Agile Framework               | Scaled Agile Inc. |
| **CUSTOM**  | Custom/Organization-defined          | Client-specific   |

## Role Mapping

Each standard defines different project roles:

### PRINCE2 Roles

| Role            | Description                   | Level |
| --------------- | ----------------------------- | ----- |
| Executive       | Ultimate decision maker       | 0     |
| Senior User     | Represents user interests     | 1     |
| Senior Supplier | Represents supplier interests | 1     |
| Project Manager | Day-to-day management         | 2     |
| Team Manager    | Manages team delivery         | 3     |
| Team Member     | Executes work packages        | 4     |

### PMBOK Roles

| Role            | Description                    | Level |
| --------------- | ------------------------------ | ----- |
| Sponsor         | Provides resources and support | 0     |
| Project Manager | Leads the project              | 1     |
| Team Lead       | Leads functional team          | 2     |
| Team Member     | Executes tasks                 | 3     |
| Stakeholder     | Interested party               | 4     |

### Agile/Scrum Roles

| Role             | Description          | Level |
| ---------------- | -------------------- | ----- |
| Product Owner    | Owns product backlog | 0     |
| Scrum Master     | Facilitates process  | 1     |
| Development Team | Delivers increment   | 2     |

### SAFe Roles

| Role                   | Description          | Level |
| ---------------------- | -------------------- | ----- |
| Release Train Engineer | Facilitates ART      | 0     |
| Product Manager        | Owns program backlog | 1     |
| System Architect       | Technical guidance   | 2     |
| Product Owner          | Team-level PO        | 3     |
| Team Member            | Agile team member    | 4     |

## Configuration Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                     ORGANIZATION LEVEL                             │
│  Settings → PMO Standards → Select Default: [PMBOK ▼]             │
│  ☑ Allow project-level override                                    │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                      PROJECT LEVEL                                 │
│  Project Settings → PMO Standard: [Use Org Default] [PRINCE2]     │
│  This determines: Role names, Permissions, Workflows              │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                    ROLE ASSIGNMENT                                 │
│  Team → Assign PMO Role → [Select from standard roles]            │
│  John Smith → Project Manager (PMBOK) ✓                           │
└────────────────────────────────────────────────────────────────────┘
```

## Database Schema

Created in migration `245_project_enhancements.sql`:

### pmo_standards

```sql
id TEXT PRIMARY KEY
name TEXT NOT NULL UNIQUE
display_name TEXT NOT NULL
description TEXT
is_active INTEGER DEFAULT 1
```

### pmo_role_definitions

```sql
id TEXT PRIMARY KEY
standard_id TEXT NOT NULL
role_key TEXT NOT NULL
display_name TEXT NOT NULL
description TEXT
permissions TEXT -- JSON array
level INTEGER DEFAULT 0
is_required INTEGER DEFAULT 0
UNIQUE(standard_id, role_key)
```

### project_role_assignments

```sql
id TEXT PRIMARY KEY
project_id TEXT NOT NULL
user_id TEXT NOT NULL
pmo_role_key TEXT NOT NULL
assigned_by TEXT
assigned_at TIMESTAMP
notes TEXT
UNIQUE(project_id, user_id, pmo_role_key)
```

## API Endpoints

| Method | Endpoint                          | Description                  |
| ------ | --------------------------------- | ---------------------------- |
| GET    | `/api/pmo/standards`              | List available PMO standards |
| GET    | `/api/pmo/standards/:id/roles`    | Get roles for a standard     |
| GET    | `/api/projects/:id/pmo-roles`     | Get PMO roles for project    |
| POST   | `/api/projects/:id/pmo-roles`     | Assign PMO role              |
| DELETE | `/api/projects/:id/pmo-roles/:id` | Remove assignment            |

## Organization Settings Integration

```typescript
// Organization PMO Settings
interface OrgPMOSettings {
  defaultStandard: 'prince2' | 'pmbok' | 'agile' | 'safe' | 'custom';
  allowProjectOverride: boolean;
  customRoles?: CustomRoleDefinition[];
}
```

## Permission Mapping

Each PMO role can have associated permissions:

```json
{
  "PROJECT_MANAGER": {
    "permissions": [
      "project.view",
      "project.edit",
      "initiative.create",
      "initiative.edit",
      "task.create",
      "task.assign",
      "decision.create",
      "decision.view",
      "report.generate"
    ]
  },
  "TEAM_MEMBER": {
    "permissions": ["project.view", "task.view", "task.update_assigned", "decision.view"]
  }
}
```

## Stage Gates (PRINCE2-specific)

PRINCE2 defines stage gates that can be decision points:

```
Project Start → Stage 1 → [GATE] → Stage 2 → [GATE] → Stage 3 → Close
                            ↓                   ↓
                        Decision:           Decision:
                        Continue?           Continue?
```

Integration with Decision System:

- Stage gate creates automatic decision request
- Decision makers = Executive, Senior User
- Type = GO_NO_GO

## AI Integration

AI adapts behavior based on PMO standard:

| Standard | AI Behavior                              |
| -------- | ---------------------------------------- |
| PRINCE2  | Focus on control, documents, stage gates |
| PMBOK    | Focus on knowledge areas, processes      |
| Agile    | Focus on user stories, sprints, velocity |
| SAFe     | Focus on ARTs, PIs, program increments   |

## Implementation Status

- ✅ Database schema (migration 245)
- ✅ PMO standards seed data
- ✅ Role definitions seed data
- ✅ Project role assignments
- ✅ API endpoints (in ProjectController)
- ✅ Project-level PMO standard field

## Related Flows

- FLOW-PROJECT-001: Projects use PMO standards
- FLOW-DECISION-001: Stage gates create decisions
- FLOW-TEAM-001: Team roles mapped to PMO roles

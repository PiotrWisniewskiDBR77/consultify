# FLOW-PROJECT-001: Project Lifecycle

> **ID:** FLOW-PROJECT-001 | **Status:** ✅ Complete | **Priority:** P0

## Overview

| Metric                    | Value                                  |
| ------------------------- | -------------------------------------- |
| **Completeness**          | 90%                                    |
| **Gaps Identified**       | 3                                      |
| **Implementation Status** | Mostly implemented, needs enhancements |

## Purpose
Manage the lifecycle of a project (create, configure, archive, move), including role scoping and governance defaults.

Canonical references:
- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
- `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`

## Triggers

| Trigger         | Description                           |
| --------------- | ------------------------------------- |
| Create Project  | Owner/Admin creates a new project |
| Update Project  | Admin or authorized user updates project settings |
| Archive Project | Completed/cancelled project is archived |
| Delete Project  | Usunięcie (soft delete)               |

## Outcomes

- Projekt utworzony z wybranym standardem PMO
- Zespół przypisany
- Inicjatywy powiązane
- Projekt zarchiwizowany po zakończeniu

## Actors

| Actor | Role                          |
| ----- | ----------------------------- |
| Owner | System owner; full access |
| Admin | System administration and project setup |
| User | Access based on project role assignment |

## Involved Modules

### Frontend

| Component              | Location                                     | Responsibility     |
| ---------------------- | -------------------------------------------- | ------------------ |
| ProjectDetailsView     | `src/views/admin/ProjectDetailsView.tsx`     | Szczegóły projektu |
| PortfolioView          | `src/views/PortfolioView.tsx`                | Lista projektów    |
| AdminProjectManagement | `src/views/admin/AdminProjectManagement.tsx` | Zarządzanie        |

### Backend

| Service/Route      | Location                                      | Responsibility |
| ------------------ | --------------------------------------------- | -------------- |
| projects.routes.ts | `server/src/routes/pmo/projects.routes.ts`    | CRUD endpoints |
| ProjectController  | `server/src/controllers/ProjectController.ts` | Business logic |
| projectCQRS        | `server/src/services/cqrs/project/`           | CQRS handlers  |

### Database

| Table              | Description           |
| ------------------ | --------------------- |
| `projects`         | Project data          |
| `project_members`  | Team assignments      |
| `project_settings` | Notification settings |

## Current Status Machine

```
┌─────────┐     ┌─────────┐     ┌───────────┐
│  DRAFT  │────►│ ACTIVE  │────►│ COMPLETED │
└─────────┘     └────┬────┘     └───────────┘
                     │
                     ▼
               ┌──────────┐     ┌───────────┐
               │ ON_HOLD  │────►│ CANCELLED │
               └──────────┘     └───────────┘
```

> Note: Project lifecycle is separate from initiative lifecycle. Initiatives remain “one object = one lifecycle” within a project context.

### Proposed Addition: ARCHIVED

```
COMPLETED ──► ARCHIVED
CANCELLED ──► ARCHIVED
```

## Sequence Diagram

```
┌──────────┐     ┌────────────┐     ┌──────────┐     ┌──────────┐
│  Owner   │     │ Controller │     │  Service │     │ Database │
└────┬─────┘     └─────┬──────┘     └────┬─────┘     └────┬─────┘
     │                 │                 │                │
     │ Create Project  │                 │                │
     │────────────────►│                 │                │
     │                 │ Validate        │                │
     │                 │────────────────►│                │
     │                 │                 │ Check limits   │
     │                 │                 │───────────────►│
     │                 │                 │◄───────────────│
     │                 │                 │ INSERT         │
     │                 │                 │───────────────►│
     │                 │◄────────────────│                │
     │◄────────────────│                 │                │
     │  {project}      │                 │                │
     │                 │                 │                │
     │ Update Status   │                 │                │
     │────────────────►│                 │                │
     │                 │ Validate trans. │                │
     │                 │────────────────►│                │
     │                 │                 │ UPDATE         │
     │                 │                 │───────────────►│
     │◄────────────────│◄────────────────│◄───────────────│
```

## Gap Analysis

### GAP-PROJECT-001: Brak statusu ARCHIVED

| Attribute    | Value                                                    |
| ------------ | -------------------------------------------------------- |
| **Priority** | MEDIUM                                                   |
| **Effort**   | 2h                                                       |
| **Impact**   | Projekty completed/cancelled nie mogą być zarchiwizowane |

**Solution:**

- Dodać status `archived` do enum
- Endpoint: `POST /api/projects/:id/archive`
- UI: Przycisk "Archive" dla completed/cancelled

---

### GAP-PROJECT-002: Brak wyboru PMO Standard per project

| Attribute    | Value                                       |
| ------------ | ------------------------------------------- |
| **Priority** | HIGH                                        |
| **Effort**   | 4h                                          |
| **Impact**   | Role projektowe nie są mapowane na standard |

**Solution:**

- Kolumna `pmo_standard` w projects (PRINCE2, PMBOK, AGILE, SAFE, CUSTOM)
- Tabela `pmo_role_mappings` z mapowaniem ról
- UI: Dropdown przy tworzeniu projektu

---

### GAP-PROJECT-003: Brak powiązania z Location

| Attribute    | Value                                           |
| ------------ | ----------------------------------------------- |
| **Priority** | MEDIUM                                          |
| **Effort**   | 3h                                              |
| **Impact**   | Projekty nie mogą być filtrowane po lokalizacji |

**Solution:**

- Kolumna `location_id` w projects (nullable FK)
- Filtrowanie po lokalizacji w listach
- Permissions check per location

---

## Implementation Tasks

- [x] Basic CRUD endpoints
- [x] Status transitions (draft, active, on_hold, completed, cancelled)
- [x] Team management (project_members)
- [x] Notification settings
- [x] AI Role management
- [ ] Add `archived` status
- [ ] Add `pmo_standard` field
- [ ] Add `location_id` field
- [ ] Archive/Unarchive endpoints
- [ ] PMO role mapping

## API Endpoints

### Existing

| Method | Endpoint            | Description    |
| ------ | ------------------- | -------------- |
| GET    | `/api/projects`     | List projects  |
| POST   | `/api/projects`     | Create project |
| GET    | `/api/projects/:id` | Get project    |
| PUT    | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

### To Add

| Method | Endpoint                      | Description               |
| ------ | ----------------------------- | ------------------------- |
| POST   | `/api/projects/:id/archive`   | Archive project           |
| POST   | `/api/projects/:id/unarchive` | Unarchive project         |
| GET    | `/api/projects/:id/pmo-roles` | Get PMO roles for project |

## Related Flows

- FLOW-INITIATIVE-001: Initiatives belong to projects
- FLOW-TEAM-001: Team permissions per project
- FLOW-PMO-001: PMO standards configuration

# Project Management Module - Comprehensive Plan

## Executive Summary

This document outlines the complete redesign and enhancement of the Project Management module in Consultify's Admin panel. The module is the primary workspace for managing transformation projects, aligned with PMO standards (ISO 21500, PMBOK 7, PRINCE2).

---

## 1. Current State Analysis

### ✅ What Works
- Grid/List view toggle
- Project creation (basic: name, description, goal)
- Project deletion with confirmation
- Navigation to Project Details view
- Project Governance settings modal

### ❌ Issues Identified
1. **Project Details** - Was returning 404 (FIXED)
2. **PMO Context API** - SQL error with missing column (FIXED)
3. **AI Role endpoint** - Double `/api/api/` prefix (FIXED)

### 🔧 Missing Features
1. Edit project inline (not just in details view)
2. Project status workflow management
3. Advanced filtering (status, owner, date range)
4. Project templates
5. Archive/Clone functionality
6. Progress indicators on cards
7. Timeline/Gantt mini-preview
8. Bulk operations

---

## 2. Proposed Architecture

### 2.1 Project Entity Structure

```typescript
interface Project {
  // Identity
  id: string;
  name: string;
  code: string;              // NEW: Short code like "DT-2026"
  description?: string;
  
  // Hierarchy
  organizationId: string;
  parentProjectId?: string;  // NEW: For sub-projects
  programId?: string;        // NEW: Portfolio/Program grouping
  
  // Strategy & Goals
  goal?: string;             // CEL - strategic objective
  successCriteria?: string[];
  businessCase?: string;
  
  // Lifecycle
  status: ProjectStatus;
  phase: ProjectPhase;       // NEW: Initiation, Planning, Execution, Closure
  healthStatus: 'GREEN' | 'AMBER' | 'RED';
  
  // Dates
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  
  // Resources
  budget?: number;
  currency?: string;
  effortHours?: number;
  
  // PMO Settings
  methodology: 'AGILE' | 'WATERFALL' | 'HYBRID';
  aiProcessingEnabled: boolean;
  visibility: 'ORG_WIDE' | 'TEAM_ONLY' | 'PRIVATE';
  
  // Ownership
  ownerId: string;
  sponsorId?: string;
  projectManagerId?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

type ProjectStatus = 
  | 'DRAFT'      // Not started, still being defined
  | 'ACTIVE'     // In progress
  | 'ON_HOLD'    // Temporarily paused
  | 'COMPLETED'  // Finished successfully
  | 'CANCELLED'  // Terminated before completion
  | 'ARCHIVED';  // Stored for reference

type ProjectPhase =
  | 'INITIATION'
  | 'PLANNING'
  | 'EXECUTION'
  | 'MONITORING'
  | 'CLOSURE';
```

### 2.2 Database Schema Updates

```sql
-- Add new columns to projects table
ALTER TABLE projects ADD COLUMN code TEXT;
ALTER TABLE projects ADD COLUMN parent_project_id TEXT;
ALTER TABLE projects ADD COLUMN program_id TEXT;
ALTER TABLE projects ADD COLUMN success_criteria TEXT DEFAULT '[]';
ALTER TABLE projects ADD COLUMN business_case TEXT;
ALTER TABLE projects ADD COLUMN phase TEXT DEFAULT 'INITIATION';
ALTER TABLE projects ADD COLUMN health_status TEXT DEFAULT 'GREEN';
ALTER TABLE projects ADD COLUMN planned_start_date DATETIME;
ALTER TABLE projects ADD COLUMN planned_end_date DATETIME;
ALTER TABLE projects ADD COLUMN actual_start_date DATETIME;
ALTER TABLE projects ADD COLUMN actual_end_date DATETIME;
ALTER TABLE projects ADD COLUMN budget REAL;
ALTER TABLE projects ADD COLUMN currency TEXT DEFAULT 'USD';
ALTER TABLE projects ADD COLUMN effort_hours INTEGER;
ALTER TABLE projects ADD COLUMN methodology TEXT DEFAULT 'HYBRID';
ALTER TABLE projects ADD COLUMN sponsor_id TEXT;
ALTER TABLE projects ADD COLUMN project_manager_id TEXT;
ALTER TABLE projects ADD COLUMN archived_at DATETIME;

-- Create project templates table
CREATE TABLE IF NOT EXISTS project_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_methodology TEXT DEFAULT 'HYBRID',
  default_workstreams TEXT DEFAULT '[]',
  default_milestones TEXT DEFAULT '[]',
  default_risk_categories TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(organization_id) REFERENCES organizations(id)
);

-- Create project programs (portfolio) table
CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(organization_id) REFERENCES organizations(id)
);
```

---

## 3. UI/UX Design

### 3.1 Project Card (Grid View)

```
┌──────────────────────────────────────────────┐
│ ┌──────┐  AI Supply Chain Optimization       │
│ │ 🏭  │  DT-2026                             │
│ └──────┘  ─────────────────────────────────  │
│                                              │
│  Active  │  🟢 Healthy  │  EXECUTION Phase   │
│                                              │
│  ───────────────────────────────────────     │
│  Progress: ████████░░░░░░░░░ 65%            │
│  ───────────────────────────────────────     │
│                                              │
│  👥 12 Members   🎯 8 Initiatives            │
│  📊 3 Assessments   📄 24 Documents          │
│                                              │
│  ───────────────────────────────────────     │
│  📅 Q1 2026 - Q4 2026                        │
│  Owner: John Smith                           │
│                                              │
│  [⚙️ Settings] [📋 Edit] [📁 Archive]       │
└──────────────────────────────────────────────┘
```

### 3.2 Project Card Visible Information

| Field | Description | Priority |
|-------|-------------|----------|
| Name | Project title | HIGH |
| Code | Short identifier (e.g., DT-2026) | HIGH |
| Status | DRAFT/ACTIVE/ON_HOLD/COMPLETED/CANCELLED | HIGH |
| Health | GREEN/AMBER/RED indicator | HIGH |
| Phase | INITIATION/PLANNING/EXECUTION/CLOSURE | MEDIUM |
| Progress | Percentage bar based on initiatives | HIGH |
| Team Count | Number of members | MEDIUM |
| Initiative Count | Number of initiatives | MEDIUM |
| Date Range | Planned start - end dates | MEDIUM |
| Owner | Project owner name/avatar | LOW |

### 3.3 Action Buttons

| Action | Icon | Description | Permission |
|--------|------|-------------|------------|
| View Details | → | Navigate to full project view | All users |
| Edit | ✏️ | Open edit modal | canEdit |
| Settings | ⚙️ | Governance & AI settings | canEdit |
| Archive | 📁 | Move to archive | canDelete |
| Clone | 📋 | Create copy | canCreate |
| Delete | 🗑️ | Permanent deletion | canDelete + confirm |

---

## 4. Create/Edit Project Modal

### 4.1 Tabs Structure

```
[ Basic Info ] [ Planning ] [ Team ] [ PMO Settings ]
```

### 4.2 Basic Info Tab

```
┌─────────────────────────────────────────────────────┐
│  PROJECT IDENTITY                                    │
│  ─────────────────────────────────────────────────  │
│  Name*: [________________________]                  │
│  Code:  [_______] (auto-generated or custom)        │
│                                                     │
│  STRATEGIC CONTEXT                                  │
│  ─────────────────────────────────────────────────  │
│  Description:                                       │
│  [                                                ] │
│  [                                                ] │
│                                                     │
│  Master Goal (CEL)*:                                │
│  [________________________]                        │
│                                                     │
│  Business Case:                                     │
│  [                                                ] │
│                                                     │
│  Success Criteria:                                  │
│  + Add criteria                                     │
│  • Reduce operational costs by 20%                  │
│  • Improve delivery time by 15%                     │
│                                                     │
│  CATEGORIZATION                                     │
│  ─────────────────────────────────────────────────  │
│  Program: [ Select program... ▼ ]                   │
│  Status:  [ Active ▼ ]                              │
└─────────────────────────────────────────────────────┘
```

### 4.3 Planning Tab

```
┌─────────────────────────────────────────────────────┐
│  TIMELINE                                           │
│  ─────────────────────────────────────────────────  │
│  Planned Start: [📅 01/01/2026]                    │
│  Planned End:   [📅 31/12/2026]                    │
│                                                     │
│  RESOURCES                                          │
│  ─────────────────────────────────────────────────  │
│  Budget: [$_________] [USD ▼]                       │
│  Effort: [_________] hours                          │
│                                                     │
│  METHODOLOGY                                        │
│  ─────────────────────────────────────────────────  │
│  ○ Agile   ● Hybrid   ○ Waterfall                  │
│                                                     │
│  [ ] Use project template                           │
│       [ Select template... ▼ ]                      │
└─────────────────────────────────────────────────────┘
```

### 4.4 Team Tab

```
┌─────────────────────────────────────────────────────┐
│  PROJECT LEADERSHIP                                 │
│  ─────────────────────────────────────────────────  │
│  Project Owner*:   [ Select user... ▼ ]            │
│  Project Manager:  [ Select user... ▼ ]            │
│  Sponsor:          [ Select user... ▼ ]            │
│                                                     │
│  INITIAL TEAM                                       │
│  ─────────────────────────────────────────────────  │
│  + Add team member                                  │
│  + Add existing team                                │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ 👤 Anna Kowalska - Team Lead                   │ │
│  │ 👤 Jan Nowak - Team Member                     │ │
│  │ 🏢 Engineering Team (5 members)                │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 4.5 PMO Settings Tab

```
┌─────────────────────────────────────────────────────┐
│  GOVERNANCE                                         │
│  ─────────────────────────────────────────────────  │
│  Visibility:  ○ Organization-wide                   │
│               ● Team-only                           │
│               ○ Private                             │
│                                                     │
│  AI CONFIGURATION                                   │
│  ─────────────────────────────────────────────────  │
│  [✓] Enable AI Processing                           │
│  AI Role: [ Advisor ▼ ]                             │
│                                                     │
│  Data Residency: [ EU (AWS) ▼ ]                    │
│                                                     │
│  NOTIFICATIONS                                      │
│  ─────────────────────────────────────────────────  │
│  [✓] Milestone reminders                            │
│  [✓] Weekly progress digest                         │
│  [ ] Daily standup prompts                          │
└─────────────────────────────────────────────────────┘
```

---

## 5. Implementation Plan

### Phase 1: Fix & Stabilize (DONE)
- [x] Fix PMO context SQL error
- [x] Fix double `/api/api/` prefix
- [x] Verify project details loading

### Phase 2: Database & API Updates
- [ ] Add new columns to projects table
- [ ] Create project_templates table
- [ ] Create programs table
- [ ] Update API endpoints for new fields
- [ ] Add validation for new fields

### Phase 3: Enhanced Project Cards
- [ ] Add progress indicator
- [ ] Add health status badge
- [ ] Add phase indicator
- [ ] Add date range display
- [ ] Add project code

### Phase 4: Create/Edit Modal Redesign
- [ ] Multi-tab modal structure
- [ ] Basic Info tab
- [ ] Planning tab
- [ ] Team assignment tab
- [ ] PMO Settings tab

### Phase 5: List View Enhancements
- [ ] Advanced filters (status, owner, date)
- [ ] Sort options
- [ ] Bulk selection
- [ ] Bulk actions (archive, change status)

### Phase 6: Additional Features
- [ ] Project templates
- [ ] Clone project
- [ ] Archive functionality
- [ ] Program/Portfolio grouping

---

## 6. API Endpoints

### Projects API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project details |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/:id/archive` | Archive project |
| POST | `/api/projects/:id/clone` | Clone project |
| PATCH | `/api/projects/:id/status` | Change status |

### Templates API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/project-templates` | List templates |
| POST | `/api/project-templates` | Create template |
| GET | `/api/project-templates/:id` | Get template |
| DELETE | `/api/project-templates/:id` | Delete template |
| POST | `/api/projects/from-template/:id` | Create from template |

### Programs API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/programs` | List programs |
| POST | `/api/programs` | Create program |
| PUT | `/api/programs/:id` | Update program |
| DELETE | `/api/programs/:id` | Delete program |

---

## 7. Permissions Matrix

| Action | OWNER | ADMIN | USER | CONSULTANT |
|--------|-------|-------|------|------------|
| View project list | ✓ | ✓ | ✓* | ✓* |
| View project details | ✓ | ✓ | ✓* | ✓* |
| Create project | ✓ | ✓ | ✗ | ✗ |
| Edit project | ✓ | ✓ | ✗ | ✗ |
| Delete project | ✓ | ✓ | ✗ | ✗ |
| Archive project | ✓ | ✓ | ✗ | ✗ |
| Manage team | ✓ | ✓ | PM only | ✗ |
| Change governance | ✓ | ✓ | ✗ | ✗ |

\* Only for assigned projects

---

## 8. Success Metrics

1. **Performance**: Project list loads in < 500ms
2. **Usability**: Create project in < 2 minutes
3. **Data Quality**: 100% of projects have owner assigned
4. **Adoption**: 80% of projects have description and goal set

---

## 9. Dependencies

- `types.ts` - Project type definitions
- `services/api.ts` - API client methods
- `server/routes/projects.js` - Backend routes
- `hooks/useUserCan.ts` - Permission checks
- `store/useAppStore.ts` - Global state

---

## 10. Notes

### PMO Compliance
All project management features align with:
- **ISO 21500:2021** - Project governance and lifecycle
- **PMBOK 7** - Performance domains
- **PRINCE2** - Organization theme and product-based planning

### Integration Points
- Projects connect to: Initiatives, Assessments, Tasks, Knowledge Base
- Teams can be assigned to multiple projects
- Consultants have project-level access only













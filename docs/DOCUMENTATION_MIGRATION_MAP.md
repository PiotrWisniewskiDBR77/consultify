# Documentation Migration Map

This document maps old documentation locations to their new organized structure, created during the January 2026 documentation cleanup.

## Root Directory Changes

### Deleted (Duplicates)

Many files with " 2" suffix were duplicates and were removed during cleanup.

**Important:** the canonical rule across this repo is: **prefer the version without a “ 2” suffix**.  
Some “ 2” files may still exist (historical leftovers or parallel drafts) and should be treated as **non-canonical** unless explicitly referenced by a newer SSOT doc.

- `AGENTS_100_PERCENT 2.md` ❌ (duplicate removed)
- `AGENT_INSTRUCTIONS 2.md` ❌ (duplicate removed)
- `BACKLOG_P0 2.md` ❌ (duplicate removed)
- `FINAL_PUSH_TASKS 2.md` ❌ (duplicate removed)
- `FINAL_STATUS 2.md` ❌ (duplicate removed)
- `QUALITY_REPORT 2.md` ❌ (duplicate removed)
- `TEST_STATUS_REPORT 2.md` ❌ (duplicate removed)
- `junit 2.xml` ❌ (duplicate removed)
- `package-lock 2.json` ❌ (duplicate removed)
- And others...

### Moved to /docs

| Old Location     | New Location                      |
| ---------------- | --------------------------------- |
| `DEVELOPMENT.md` | `docs/development/DEVELOPMENT.md` |
| `QUICK_START.md` | `docs/development/QUICK_START.md` |

## /docs Directory Reorganization

### Development Documentation

| Old Path                                 | New Path                                             |
| ---------------------------------------- | ---------------------------------------------------- |
| `docs/DEVELOPMENT_WORKFLOW.md`           | `docs/development/DEVELOPMENT_WORKFLOW.md`           |
| `docs/LOCAL_DEVELOPMENT_IMPROVEMENTS.md` | `docs/development/LOCAL_DEVELOPMENT_IMPROVEMENTS.md` |
| `docs/LLM_PROVIDER_SETUP.md`             | `docs/development/LLM_PROVIDER_SETUP.md`             |
| `docs/GITHUB_SETUP_CHECKLIST.md`         | `docs/development/GITHUB_SETUP_CHECKLIST.md`         |
| `docs/BRANCH_PROTECTION_SETUP.md`        | `docs/development/BRANCH_PROTECTION_SETUP.md`        |
| `docs/typescript-migration-guide.md`     | `docs/development/typescript-migration-guide.md`     |
| `docs/build-optimization-guide.md`       | `docs/development/build-optimization-guide.md`       |
| `docs/migration-verification-report.md`  | `docs/development/migration-verification-report.md`  |

### Operations Documentation

| Old Path                                  | New Path                                             |
| ----------------------------------------- | ---------------------------------------------------- |
| `docs/DEPLOYMENT_GUIDE.md`                | `docs/operations/DEPLOYMENT_GUIDE.md`                |
| `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` | `docs/operations/PRODUCTION_DEPLOYMENT_CHECKLIST.md` |
| `docs/DISASTER_RECOVERY.md`               | `docs/operations/DISASTER_RECOVERY.md`               |
| `docs/MONITORING_DASHBOARD.md`            | `docs/operations/MONITORING_DASHBOARD.md`            |
| `docs/INCIDENT_RESPONSE_PLAYBOOK.md`      | `docs/operations/INCIDENT_RESPONSE_PLAYBOOK.md`      |
| `docs/LOAD_TESTING_GUIDE.md`              | `docs/operations/LOAD_TESTING_GUIDE.md`              |

### Security Documentation

| Old Path                                | New Path                                                    |
| --------------------------------------- | ----------------------------------------------------------- |
| `docs/ENCRYPTION_CONFIGURATION.md`      | `docs/security-compliance/ENCRYPTION_CONFIGURATION.md`      |
| `docs/SECURITY_RUNBOOKS.md`             | `docs/security-compliance/SECURITY_RUNBOOKS.md`             |
| `docs/SECURITY_MOCK_ENDPOINTS.md`       | `docs/security-compliance/SECURITY_MOCK_ENDPOINTS.md`       |
| `docs/RBAC_AUDIT_REPORT.md`             | `docs/security-compliance/RBAC_AUDIT_REPORT.md`             |
| `docs/SECURITY_MODULE_AUDIT.md`         | `docs/security-compliance/SECURITY_MODULE_AUDIT.md`         |
| `docs/SECURITY_VERIFICATION_REQUEST.md` | `docs/security-compliance/SECURITY_VERIFICATION_REQUEST.md` |

### Module Documentation

#### Admin Module

All `docs/ADMIN_*.md` files moved to `docs/modules/admin/`:

- `ADMIN_DASHBOARD_DEEP_ANALYSIS.md` → `docs/modules/admin/ADMIN_DASHBOARD_DEEP_ANALYSIS.md`
- `ADMIN_MODULE_ENTERPRISE_READINESS_REPORT.md` → `docs/modules/admin/ADMIN_MODULE_ENTERPRISE_READINESS_REPORT.md`
- `ADMIN_ORGANIZATION_MODULE_FINAL.md` → `docs/modules/admin/ADMIN_ORGANIZATION_MODULE_FINAL.md`
- `ADMIN_TEAM_MODULE_FINAL.md` → `docs/modules/admin/ADMIN_TEAM_MODULE_FINAL.md`
- `ADMIN_WORKSPACE_MODULE_FINAL.md` → `docs/modules/admin/ADMIN_WORKSPACE_MODULE_FINAL.md`
- And others...

#### AI Module

All `docs/AI_*.md` files moved to `docs/modules/ai/`:

- `AI_INFRASTRUCTURE_MODULE.md` → `docs/modules/ai/AI_INFRASTRUCTURE_MODULE.md`
- `AI_OPERATIONS_MODULE.md` → `docs/modules/ai/AI_OPERATIONS_MODULE.md`
- `AI_MODULE_AUDIT_FINAL.md` → `docs/modules/ai/AI_MODULE_AUDIT_FINAL.md`
- `AI_PLATFORM_ENTERPRISE_ROADMAP.md` → `docs/modules/ai/AI_PLATFORM_ENTERPRISE_ROADMAP.md`

#### Partner Module

All `docs/PARTNER_*.md` files moved to `docs/modules/partner/`:

- `PARTNER_MODULE_AUDIT.md` → `docs/modules/partner/PARTNER_MODULE_AUDIT.md`
- `PARTNER_PORTAL_MODULE.md` → `docs/modules/partner/PARTNER_PORTAL_MODULE.md`
- `PARTNER_REFERRAL_SYSTEM.md` → `docs/modules/partner/PARTNER_REFERRAL_SYSTEM.md`
- `PARTNER_ILLUSTRATIONS_BRIEF.md` → `docs/modules/partner/PARTNER_ILLUSTRATIONS_BRIEF.md`

#### Revenue/Billing Module

| Old Path                                       | New Path                                                       |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `docs/REVENUE_BILLING_MODULE_AUDIT.md`         | `docs/modules/revenue/REVENUE_BILLING_MODULE_AUDIT.md`         |
| `docs/BILLING_PHASE2_IMPLEMENTATION_REPORT.md` | `docs/modules/revenue/BILLING_PHASE2_IMPLEMENTATION_REPORT.md` |

#### Analytics Module

| Old Path                         | New Path                                           |
| -------------------------------- | -------------------------------------------------- |
| `docs/ANALYTICS_MODULE_AUDIT.md` | `docs/modules/analytics/ANALYTICS_MODULE_AUDIT.md` |

#### Content Module

| Old Path                       | New Path                                       |
| ------------------------------ | ---------------------------------------------- |
| `docs/CONTENT_MODULE_AUDIT.md` | `docs/modules/content/CONTENT_MODULE_AUDIT.md` |

### Archive - Test & Migration Reports

Historical documentation from the 2025-2026 VC DD journey moved to `docs/archive/2025-2026-audit-journey/`:

#### Audit Reports

| Old Path                          | New Path                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `docs/TESTS_AUDIT_REPORT.md`      | `docs/archive/2025-2026-audit-journey/audit-reports/TESTS_AUDIT_REPORT.md`      |
| `docs/VC_TECH_AUDIT_PLAN.md`      | `docs/archive/2025-2026-audit-journey/audit-reports/VC_TECH_AUDIT_PLAN.md`      |
| `docs/EXCLUDED_TESTS_ANALYSIS.md` | `docs/archive/2025-2026-audit-journey/audit-reports/EXCLUDED_TESTS_ANALYSIS.md` |
| `docs/TEST_*.md`                  | `docs/archive/2025-2026-audit-journey/audit-reports/TEST_*.md`                  |

#### Migration Reports

| Old Path                               | New Path                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `docs/MIGRATION_*.md`                  | `docs/archive/2025-2026-audit-journey/migration-reports/MIGRATION_*.md`                  |
| `docs/TYPESCRIPT_MIGRATION_SUMMARY.md` | `docs/archive/2025-2026-audit-journey/migration-reports/TYPESCRIPT_MIGRATION_SUMMARY.md` |
| `docs/ENTRY_POINT_MIGRATION_REPORT.md` | `docs/archive/2025-2026-audit-journey/migration-reports/ENTRY_POINT_MIGRATION_REPORT.md` |
| `docs/TS_ERROR_REDUCTION_REPORT.md`    | `docs/archive/2025-2026-audit-journey/migration-reports/TS_ERROR_REDUCTION_REPORT.md`    |
| `docs/typescript-migration-plan.md`    | `docs/archive/2025-2026-audit-journey/migration-reports/typescript-migration-plan.md`    |

#### Status Reports (Polish Planning Docs)

| Old Path                     | New Path                                                                    |
| ---------------------------- | --------------------------------------------------------------------------- |
| `docs/ETAP*.md`              | `docs/archive/2025-2026-audit-journey/status-reports/ETAP*.md`              |
| `docs/FAZA_*.md`             | `docs/archive/2025-2026-audit-journey/status-reports/FAZA_*.md`             |
| `docs/PLAN_*.md`             | `docs/archive/2025-2026-audit-journey/status-reports/PLAN_*.md`             |
| `docs/ALL_TASKS_COMPLETE.md` | `docs/archive/2025-2026-audit-journey/status-reports/ALL_TASKS_COMPLETE.md` |
| `docs/FINAL_COMPLETION.md`   | `docs/archive/2025-2026-audit-journey/status-reports/FINAL_COMPLETION.md`   |
| `docs/*_PROGRESS*.md`        | `docs/archive/2025-2026-audit-journey/status-reports/*_PROGRESS*.md`        |
| `docs/*_COMPLETE*.md`        | `docs/archive/2025-2026-audit-journey/status-reports/*_COMPLETE*.md`        |

## README Updates

### Main README.md

Updated references from:

- `consultinity/50_operations/LOCAL_SETUP.md` → `docs/development/DEVELOPMENT.md`
- Added link to `docs/README.md` for full documentation index

Removed entire "Consultinity Perfect Standard" 8-pillar structure (referenced non-existent paths).

Added new "Documentation" section with:

- Quick Links for Developers
- Quick Links for Operations
- Architecture & API links
- Module Documentation links
- Testing & Quality metrics

## New Files Created

| Path                                  | Description                                               |
| ------------------------------------- | --------------------------------------------------------- |
| `docs/README.md`                      | Comprehensive documentation index with navigation by role |
| `docs/DOCUMENTATION_MIGRATION_MAP.md` | This file - mapping old → new paths                       |

## UI/UX Standards Consolidation (2026-02-14)

**Jedyne kanoniczne źródło:** `docs/ui-standards/README.md`

Wszystkie dokumenty UI/UX skonsolidowane w `docs/ui-standards/`:

| Stara lokalizacja                                      | Nowa lokalizacja                                          |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `docs/00_foundation/COLOR_SYSTEM_STANDARD.md`          | `docs/ui-standards/00-foundation/color-system.md`         |
| `docs/00_foundation/DBR77_VISUAL_LANGUAGE_STANDARD.md` | `docs/ui-standards/00-foundation/visual-language.md`      |
| `docs/ui-standards/artifact-shell-future-standard.md`  | `docs/ui-standards/01-shell-layout/artifact-shell.md`     |
| `docs/ui-standards/detail-view-presentation-modes.md`  | `docs/ui-standards/01-shell-layout/presentation-modes.md` |
| `docs/ui-standards/shared-nmode-sections-standard.md`  | `docs/ui-standards/02-components/shared-sections.md`      |
| `docs/TASK_PANEL_SPECIFICATION.md`                     | `docs/ui-standards/02-components/task-panel.md`           |
| `docs/DECISION_PANEL_SPECIFICATION.md`                 | `docs/ui-standards/02-components/decision-panel.md`       |
| `docs/ui-standards/notification-detail-view.md`        | `docs/ui-standards/02-components/notification-panel.md`   |
| `docs/ui-standards/task-detail-view.md`                | `docs/ui-standards/02-components/task-panel.md` (merged)  |
| `docs/UI_UX_MODULE_STANDARD.md`                        | `docs/ui-standards/03-modules/module-hub-standard.md`     |
| `docs/ui-standards/app-table-standard.md`              | `docs/ui-standards/03-modules/app-table-standard.md`      |

**Nowe pliki:** `docs/ui-standards/02-components/building-blocks.md`, `initiative-sections.md`

---

## Key Navigation Points

Start here for documentation:

1. **[docs/README.md](docs/README.md)** - Main documentation index
2. **[README.md](../README.md)** - Project README with quickstart
3. **[docs/development/DEVELOPMENT.md](docs/development/DEVELOPMENT.md)** - Development guide

---

**Migration Date**: January 10, 2026  
**Total Files Reorganized**: 120+  
**Duplicates Removed**: 120+  
**New Directory Structure**: ✅ Implemented  
**Documentation Index**: ✅ Created

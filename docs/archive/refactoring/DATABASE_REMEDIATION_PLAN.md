# Database Remediation & Mock Removal Plan
**Phase**: 4 - Database Realization
**Status**: DRAFT

## 🎯 Objective
Transition the application from mock-driven to database-driven. ensure the "DBR77" organization has a fully populated, persistent state in English.

## 📋 Execution Stages

### Stage 1: Schema Synchronization
*Goal: Ensure the SQLite database structure matches the application's domain model.*
- [ ] **Analyze Mocks**: Review `server/services/` for implicit schemas in mock objects.
- [ ] **Update Seed Script**: Expand `seed_dbr77.js` to include missing tables found in mocks (e.g., `risks`, `kpis`, `assessments`, `comments`).
- [ ] **Schema Validation**: Ensure `types/schema.ts` (if available) aligns with `CREATE TABLE` statements.

### Stage 2: Service Layer Migration
*Goal: Replace `const MOCK_DATA = ...` with fully wired `db.all()` / `db.get()` calls.*
- [ ] **Priority Services**:
    - `TaskService` (likely partially wired, needs verification)
    - `InitiativeService`
    - `AssessmentService`
    - `ReportService`
- [ ] **Pattern**: 
    - Inject `Database` dependency.
    - Replace in-memory array methods (`find`, `filter`) with SQL queries (`SELECT WHERE`).
    - Remove placeholder comments.

### Stage 3: DBR77 Data Seeding (English)
*Goal: Populate the "DBR77" organization with rich, realistic content.*
- [ ] **Organization**: "Consultinity / DBR77" (Enterprise Plan).
- [ ] **Users**: Ensure `admin@dbr77.com` (SuperAdmin) and `piotr.wisniewski@dbr77.com` (Admin).
- [ ] **Content**:
    - **Initiatives**: 5-10 realistic transformation initiatives (e.g., "AI Customer Support", "Predictive Maintenance").
    - **Tasks**: 20+ tasks across phases (Design, Execution).
    - **KPIs**: Sample metrics connected to initiatives.

### Stage 4: Verification
- [ ] **Backend Tests**: Run integration tests to verify DB persistence.
- [ ] **UI Verification**: Log in as Piotr and verify data appears in "My Work" and "PMO" dashboards.

## 📅 Timeline
- **Stage 1 & 3**: Immediate (Seed script update).
- **Stage 2**: Iterative (Service by Service).

## ⚠️ Risks
- **Data Loss**: Re-running seed script destroys existing local data (Acceptable for dev environment).
- **Broken Tests**: Unit tests relying on internal service mocks might fail if services are converted to use real DB without updated test mocks.

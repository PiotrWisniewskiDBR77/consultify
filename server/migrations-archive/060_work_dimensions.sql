-- ============================================
-- WORK DIMENSIONS SYSTEM MIGRATION
-- ============================================
-- This migration implements the complete Work Dimensions system:
-- 1. Organization Work Mode configuration
-- 2. User-to-Facility assignments
-- 3. PMO Role Definitions (PRINCE2/PMBOK aligned)
-- 4. Granular Capabilities system
-- 5. Task visibility by facility
--
-- Compliant with: ISO 21500:2021, PMI PMBOK 7th Edition, PRINCE2
-- See: docs/architecture/WORK_DIMENSIONS.md
-- ============================================

-- ============================================
-- 1. ORGANIZATION WORK MODE COLUMNS
-- ============================================
-- Configures how the organization structures its work

-- Work mode: SIMPLE (single team), LOCATION_BASED, PROJECT_BASED, FULL (matrix)
ALTER TABLE organizations ADD COLUMN work_mode TEXT DEFAULT 'SIMPLE' 
    CHECK(work_mode IN ('SIMPLE', 'LOCATION_BASED', 'PROJECT_BASED', 'FULL'));

-- Feature flags
ALTER TABLE organizations ADD COLUMN has_projects BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN has_locations BOOLEAN DEFAULT FALSE;

-- Custom labels for terminology
ALTER TABLE organizations ADD COLUMN project_label TEXT DEFAULT 'Project';
ALTER TABLE organizations ADD COLUMN location_label TEXT DEFAULT 'Location';
ALTER TABLE organizations ADD COLUMN team_label TEXT DEFAULT 'Team';

-- ============================================
-- 2. EXTEND ORGANIZATION_FACILITIES TABLE
-- ============================================
-- Add hierarchy and status fields if not exist

-- Hierarchy support
ALTER TABLE organization_facilities ADD COLUMN parent_facility_id TEXT 
    REFERENCES organization_facilities(id) ON DELETE SET NULL;
ALTER TABLE organization_facilities ADD COLUMN level INTEGER DEFAULT 0;
ALTER TABLE organization_facilities ADD COLUMN code TEXT;

-- Address field
ALTER TABLE organization_facilities ADD COLUMN address TEXT;

-- Status tracking
ALTER TABLE organization_facilities ADD COLUMN status TEXT DEFAULT 'active' 
    CHECK(status IN ('active', 'inactive', 'closed'));
ALTER TABLE organization_facilities ADD COLUMN is_headquarters BOOLEAN DEFAULT FALSE;

-- Timestamps
ALTER TABLE organization_facilities ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_facilities_parent ON organization_facilities(parent_facility_id);
CREATE INDEX IF NOT EXISTS idx_facilities_status ON organization_facilities(status);
CREATE INDEX IF NOT EXISTS idx_facilities_code ON organization_facilities(code);

-- ============================================
-- 3. FACILITY_USERS TABLE
-- ============================================
-- Assigns users to facilities (locations)

CREATE TABLE IF NOT EXISTS facility_users (
    facility_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Assignment type
    assignment_type TEXT DEFAULT 'primary' 
        CHECK(assignment_type IN ('primary', 'secondary', 'temporary')),
    
    -- Role within facility
    role TEXT DEFAULT 'member'
        CHECK(role IN ('manager', 'lead', 'member', 'viewer')),
    
    -- Access control flags
    can_view_all_tasks BOOLEAN DEFAULT FALSE,
    can_manage_users BOOLEAN DEFAULT FALSE,
    can_edit_facility BOOLEAN DEFAULT FALSE,
    
    -- Assignment metadata
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_by TEXT,
    valid_until DATETIME,
    notes TEXT,
    
    PRIMARY KEY(facility_id, user_id),
    FOREIGN KEY(facility_id) REFERENCES organization_facilities(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_facility_users_user ON facility_users(user_id);
CREATE INDEX IF NOT EXISTS idx_facility_users_type ON facility_users(assignment_type);
CREATE INDEX IF NOT EXISTS idx_facility_users_role ON facility_users(role);

-- ============================================
-- 4. PMO ROLE DEFINITIONS TABLE
-- ============================================
-- Registry of PMO roles aligned with PRINCE2 and PMBOK standards

CREATE TABLE IF NOT EXISTS pmo_role_definitions (
    id TEXT PRIMARY KEY,
    
    -- Role identity
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_pl TEXT,
    
    -- PMO Standards mapping
    prince2_role TEXT,
    pmbok_role TEXT,
    iso21500_reference TEXT,
    
    -- Hierarchy (0=Executive, 1=Manager, 2=Lead, 3=Member, 4=Stakeholder)
    level INTEGER DEFAULT 0,
    reports_to_code TEXT,
    
    -- Default capabilities (JSON array)
    default_capabilities TEXT DEFAULT '[]',
    
    -- Configuration
    is_required BOOLEAN DEFAULT FALSE,
    max_per_project INTEGER,
    can_be_external BOOLEAN DEFAULT FALSE,
    
    -- Descriptions
    description TEXT,
    description_pl TEXT,
    
    -- System flag (TRUE=built-in, FALSE=custom)
    is_system BOOLEAN DEFAULT TRUE,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pmo_roles_code ON pmo_role_definitions(code);
CREATE INDEX IF NOT EXISTS idx_pmo_roles_level ON pmo_role_definitions(level);

-- ============================================
-- 5. CAPABILITIES TABLE
-- ============================================
-- Granular permissions for fine-grained access control

CREATE TABLE IF NOT EXISTS capabilities (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_pl TEXT,
    category TEXT,
    description TEXT,
    description_pl TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capabilities_code ON capabilities(code);
CREATE INDEX IF NOT EXISTS idx_capabilities_category ON capabilities(category);

-- ============================================
-- 6. PMO ROLE CAPABILITIES MAPPING
-- ============================================
-- Links PMO roles to their granted capabilities

CREATE TABLE IF NOT EXISTS pmo_role_capabilities (
    pmo_role_id TEXT NOT NULL,
    capability_id TEXT NOT NULL,
    
    -- Scope: 'assigned' (only assigned items), 'project', 'all'
    scope TEXT DEFAULT 'assigned'
        CHECK(scope IN ('assigned', 'project', 'all')),
    
    PRIMARY KEY(pmo_role_id, capability_id),
    FOREIGN KEY(pmo_role_id) REFERENCES pmo_role_definitions(id) ON DELETE CASCADE,
    FOREIGN KEY(capability_id) REFERENCES capabilities(id) ON DELETE CASCADE
);

-- ============================================
-- 7. EXTEND PROJECT_MEMBERS TABLE
-- ============================================
-- Add PMO role reference to existing project_members

ALTER TABLE project_members ADD COLUMN pmo_role_id TEXT 
    REFERENCES pmo_role_definitions(id) ON DELETE SET NULL;

ALTER TABLE project_members ADD COLUMN responsibilities TEXT DEFAULT '[]';
ALTER TABLE project_members ADD COLUMN notes TEXT;

CREATE INDEX IF NOT EXISTS idx_project_members_pmo_role ON project_members(pmo_role_id);

-- ============================================
-- 8. EXTEND TASKS TABLE
-- ============================================
-- Add facility assignment for location-based visibility

ALTER TABLE tasks ADD COLUMN facility_id TEXT 
    REFERENCES organization_facilities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_facility ON tasks(facility_id);

-- ============================================
-- 9. SEED PMO ROLE DEFINITIONS
-- ============================================
-- Insert PRINCE2/PMBOK aligned roles

-- Executive Level (0)
INSERT INTO pmo_role_definitions (id, code, name, name_pl, prince2_role, pmbok_role, iso21500_reference, level, default_capabilities, is_required, description, description_pl) VALUES
('pmo-role-exec', 'PROJECT_EXECUTIVE', 'Project Executive', 'Dyrektor Projektu', 
 'Executive', 'Project Sponsor', 'ISO 21500 Clause 4.3.2', 0::integer, 
 '["approve_business_case","approve_stage_gates","authorize_budget","escalate_decisions"]', 
 (TRUE::boolean)::integer, 'Ultimate authority for the project. Approves business case and major decisions.',
 'Najwyższa władza w projekcie. Zatwierdza business case i kluczowe decyzje.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO pmo_role_definitions (id, code, name, name_pl, prince2_role, pmbok_role, iso21500_reference, level, default_capabilities, is_required, description, description_pl) VALUES
('pmo-role-sponsor', 'SENIOR_USER', 'Senior User / Business Owner', 'Właściciel Biznesowy', 
 'Senior User', 'Business Owner', 'ISO 21500 Clause 4.3.5', 0::integer, 
 '["define_requirements","accept_deliverables","represent_users","specify_benefits"]', 
 (TRUE::boolean)::integer, 'Represents users who will use the products. Defines requirements and acceptance criteria.',
 'Reprezentuje użytkowników produktów. Definiuje wymagania i kryteria akceptacji.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO pmo_role_definitions (id, code, name, name_pl, prince2_role, pmbok_role, iso21500_reference, level, default_capabilities, is_required, description, description_pl) VALUES
('pmo-role-supplier', 'SENIOR_SUPPLIER', 'Senior Supplier', 'Główny Dostawca', 
 'Senior Supplier', 'Resource Manager', 'ISO 21500 Clause 4.6.2', 0::integer, 
 '["provide_resources","technical_expertise","supplier_commitments"]', 
 (FALSE::boolean)::integer, 'Represents suppliers providing resources or expertise.',
 'Reprezentuje dostawców zasobów lub ekspertyzy.')
ON CONFLICT (code) DO NOTHING;

-- Manager Level (1)
INSERT INTO pmo_role_definitions (id, code, name, name_pl, prince2_role, pmbok_role, iso21500_reference, level, default_capabilities, is_required, description, description_pl) VALUES
('pmo-role-pm', 'PROJECT_MANAGER', 'Project Manager', 'Kierownik Projektu', 
 'Project Manager', 'Project Manager', 'ISO 21500 Clause 4.3.3', 1::integer, 
 '["manage_project","create_plans","assign_tasks","manage_risks","manage_issues","report_progress","manage_scope","manage_schedule"]', 
 (TRUE::boolean)::integer, 'Day-to-day management of the project within agreed tolerances.',
 'Bieżące zarządzanie projektem w uzgodnionych tolerancjach.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO pmo_role_definitions (id, code, name, name_pl, prince2_role, pmbok_role, iso21500_reference, level, default_capabilities, is_required, description, description_pl) VALUES
('pmo-role-pmo', 'PMO_SUPPORT', 'PMO Support', 'Wsparcie PMO', 
 'Project Support', 'PMO Analyst', 'ISO 21500 Clause 4.3.6', 1::integer, 
 '["maintain_documentation","track_metrics","quality_assurance","admin_support"]', 
 (FALSE::boolean)::integer, 'Administrative support for project management activities.',
 'Wsparcie administracyjne dla działań zarządzania projektem.')
ON CONFLICT (code) DO NOTHING;

-- Lead Level (2)
INSERT INTO pmo_role_definitions (id, code, name, name_pl, prince2_role, pmbok_role, iso21500_reference, level, default_capabilities, is_required, description, description_pl) VALUES
('pmo-role-tech', 'TECHNICAL_LEAD', 'Technical Lead', 'Lider Techniczny', 
 'Team Manager', 'Technical Lead', 'ISO 21500 Clause 4.6.3', 2::integer, 
 '["technical_decisions","code_review","architecture","technical_guidance"]', 
 (FALSE::boolean)::integer, 'Leads technical work and provides technical direction to team.',
 'Kieruje pracami technicznymi i zapewnia kierunek techniczny zespołowi.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO pmo_role_definitions (id, code, name, name_pl, prince2_role, pmbok_role, iso21500_reference, level, default_capabilities, is_required, description, description_pl) VALUES
('pmo-role-ba', 'BUSINESS_ANALYST', 'Business Analyst', 'Analityk Biznesowy', 
 'Project Assurance', 'Business Analyst', 'ISO 21500 Clause 4.4.2', 2::integer, 
 '["analyze_requirements","document_processes","validate_solutions","stakeholder_liaison"]', 
 (FALSE::boolean)::integer, 'Analyzes business requirements and ensures solutions meet needs.',
 'Analizuje wymagania biznesowe i zapewnia zgodność rozwiązań z potrzebami.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO pmo_role_definitions (id, code, name, name_pl, prince2_role, pmbok_role, iso21500_reference, level, default_capabilities, is_required, description, description_pl) VALUES
('pmo-role-change', 'CHANGE_AUTHORITY', 'Change Authority', 'Organ Zmian', 
 'Change Authority', 'Change Control Board', 'ISO 21500 Clause 4.4.6', 2::integer, 
 '["approve_changes","evaluate_impact","manage_change_requests"]', 
 (FALSE::boolean)::integer, 'Approves changes within delegated authority.',
 'Zatwierdza zmiany w ramach delegowanych uprawnień.')
ON CONFLICT (code) DO NOTHING;

-- Member Level (3)
INSERT INTO pmo_role_definitions (id, code, name, name_pl, prince2_role, pmbok_role, iso21500_reference, level, default_capabilities, is_required, description, description_pl) VALUES
('pmo-role-member', 'TEAM_MEMBER', 'Team Member', 'Członek Zespołu', 
 'Team Member', 'Team Member', 'ISO 21500 Clause 4.6.4', 3::integer, 
 '["execute_tasks","update_status","report_blockers","collaborate"]', 
 (FALSE::boolean)::integer, 'Executes assigned work packages and reports progress.',
 'Wykonuje przypisane pakiety prac i raportuje postępy.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO pmo_role_definitions (id, code, name, name_pl, prince2_role, pmbok_role, iso21500_reference, level, default_capabilities, is_required, description, description_pl) VALUES
('pmo-role-qa', 'QUALITY_ASSURANCE', 'Quality Assurance', 'Kontrola Jakości', 
 'Project Assurance', 'Quality Analyst', 'ISO 21500 Clause 4.7.3', 3::integer, 
 '["test_deliverables","verify_quality","report_defects","audit_processes"]', 
 (FALSE::boolean)::integer, 'Verifies quality of deliverables and processes.',
 'Weryfikuje jakość produktów i procesów.')
ON CONFLICT (code) DO NOTHING;

-- Stakeholder Level (4)
INSERT INTO pmo_role_definitions (id, code, name, name_pl, prince2_role, pmbok_role, iso21500_reference, level, default_capabilities, is_required, description, description_pl) VALUES
('pmo-role-stakeholder', 'STAKEHOLDER', 'Stakeholder', 'Interesariusz', 
 'N/A', 'Stakeholder', 'ISO 21500 Clause 4.3.1', 4::integer, 
 '["view_progress","provide_feedback","attend_reviews"]', 
 (FALSE::boolean)::integer, 'Interested party who may be affected by project outcomes.',
 'Strona zainteresowana, na którą mogą wpływać wyniki projektu.')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 10. SEED CAPABILITIES
-- ============================================

-- Project capabilities
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-p1', 'project:create', 'Create Projects', 'Tworzenie projektów', 'project', 'Ability to create new projects')
ON CONFLICT (code) DO NOTHING;
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-p2', 'project:edit', 'Edit Project Settings', 'Edycja ustawień projektu', 'project', 'Ability to edit project settings')
ON CONFLICT (code) DO NOTHING;
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-p3', 'project:delete', 'Delete Projects', 'Usuwanie projektów', 'project', 'Ability to delete projects');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-p4', 'project:archive', 'Archive Projects', 'Archiwizacja projektów', 'project', 'Ability to archive projects');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-p5', 'project:assign_users', 'Assign Users to Project', 'Przypisywanie użytkowników', 'project', 'Ability to assign users to project');

-- Task capabilities
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-t1', 'task:create', 'Create Tasks', 'Tworzenie zadań', 'task', 'Ability to create tasks');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-t2', 'task:edit_own', 'Edit Own Tasks', 'Edycja własnych zadań', 'task', 'Ability to edit own assigned tasks');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-t3', 'task:edit_all', 'Edit All Tasks', 'Edycja wszystkich zadań', 'task', 'Ability to edit any task in scope');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-t4', 'task:delete', 'Delete Tasks', 'Usuwanie zadań', 'task', 'Ability to delete tasks');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-t5', 'task:assign', 'Assign Tasks', 'Przypisywanie zadań', 'task', 'Ability to assign tasks to users');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-t6', 'task:change_status', 'Change Task Status', 'Zmiana statusu zadań', 'task', 'Ability to change task status');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-t7', 'task:approve', 'Approve Tasks', 'Zatwierdzanie zadań', 'task', 'Ability to approve completed tasks');

-- Initiative capabilities
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-i1', 'initiative:create', 'Create Initiatives', 'Tworzenie inicjatyw', 'initiative', 'Ability to create initiatives');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-i2', 'initiative:edit', 'Edit Initiatives', 'Edycja inicjatyw', 'initiative', 'Ability to edit initiatives');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-i3', 'initiative:delete', 'Delete Initiatives', 'Usuwanie inicjatyw', 'initiative', 'Ability to delete initiatives');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-i4', 'initiative:approve', 'Approve Initiatives', 'Zatwierdzanie inicjatyw', 'initiative', 'Ability to approve initiatives');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-i5', 'initiative:prioritize', 'Prioritize Initiatives', 'Priorytetyzacja inicjatyw', 'initiative', 'Ability to change initiative priority');

-- Stage Gate capabilities
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-sg1', 'stagegate:create', 'Create Stage Gates', 'Tworzenie Stage Gate', 'governance', 'Ability to create stage gates');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-sg2', 'stagegate:approve', 'Approve Stage Gates', 'Zatwierdzanie Stage Gate', 'governance', 'Ability to approve stage gate reviews');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-sg3', 'stagegate:reject', 'Reject Stage Gates', 'Odrzucanie Stage Gate', 'governance', 'Ability to reject stage gate reviews');

-- Risk & Issue capabilities
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-r1', 'risk:create', 'Create Risks', 'Tworzenie ryzyk', 'risk', 'Ability to create risk entries');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-r2', 'risk:manage', 'Manage Risks', 'Zarządzanie ryzykami', 'risk', 'Ability to manage and update risks');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-r3', 'issue:create', 'Create Issues', 'Zgłaszanie problemów', 'issue', 'Ability to create issue entries');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-r4', 'issue:resolve', 'Resolve Issues', 'Rozwiązywanie problemów', 'issue', 'Ability to resolve issues');

-- Document capabilities
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-d1', 'document:create', 'Create Documents', 'Tworzenie dokumentów', 'document', 'Ability to create documents');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-d2', 'document:edit', 'Edit Documents', 'Edycja dokumentów', 'document', 'Ability to edit documents');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-d3', 'document:delete', 'Delete Documents', 'Usuwanie dokumentów', 'document', 'Ability to delete documents');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-d4', 'document:approve', 'Approve Documents', 'Zatwierdzanie dokumentów', 'document', 'Ability to approve documents');

-- Report capabilities
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-rep1', 'report:view', 'View Reports', 'Podgląd raportów', 'report', 'Ability to view reports');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-rep2', 'report:create', 'Create Reports', 'Tworzenie raportów', 'report', 'Ability to create reports');
INSERT INTO capabilities (id, code, name, name_pl, category, description) VALUES
('cap-rep3', 'report:export', 'Export Reports', 'Eksport raportów', 'report', 'Ability to export reports');

-- ============================================
-- 11. SEED PMO ROLE CAPABILITIES
-- ============================================

-- PROJECT_EXECUTIVE capabilities
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-exec', 'cap-p1', 'all');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-exec', 'cap-p2', 'all');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-exec', 'cap-p5', 'all');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-exec', 'cap-sg2', 'all');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-exec', 'cap-sg3', 'all');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-exec', 'cap-i4', 'all');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-exec', 'cap-rep1', 'all');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-exec', 'cap-rep3', 'all');

-- PROJECT_MANAGER capabilities
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-p2', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-p5', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-t1', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-t3', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-t4', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-t5', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-t6', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-t7', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-i1', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-i2', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-i5', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-sg1', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-r1', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-r2', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-r3', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-r4', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-d1', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-d2', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-rep1', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-rep2', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-pm', 'cap-rep3', 'project');

-- TEAM_MEMBER capabilities
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-member', 'cap-t1', 'assigned');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-member', 'cap-t2', 'assigned');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-member', 'cap-t6', 'assigned');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-member', 'cap-r3', 'assigned');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-member', 'cap-d1', 'assigned');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-member', 'cap-rep1', 'assigned');

-- TECHNICAL_LEAD capabilities
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-tech', 'cap-t1', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-tech', 'cap-t3', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-tech', 'cap-t5', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-tech', 'cap-t6', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-tech', 'cap-t7', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-tech', 'cap-d1', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-tech', 'cap-d2', 'project');
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-tech', 'cap-rep1', 'project');

-- STAKEHOLDER capabilities (read-only)
INSERT INTO pmo_role_capabilities (pmo_role_id, capability_id, scope) VALUES
('pmo-role-stakeholder', 'cap-rep1', 'project');

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- 
-- Tables created:
-- - facility_users: User-to-location assignments
-- - pmo_role_definitions: PMO role registry
-- - capabilities: Granular permissions
-- - pmo_role_capabilities: Role-to-capability mapping
--
-- Tables extended:
-- - organizations: work_mode, has_projects, has_locations, labels
-- - organization_facilities: hierarchy, status, timestamps
-- - project_members: pmo_role_id, responsibilities, notes
-- - tasks: facility_id
--
-- Seeded data:
-- - 11 PMO roles (PRINCE2/PMBOK aligned)
-- - 27 capabilities across 7 categories
-- - Role-capability mappings for key roles





















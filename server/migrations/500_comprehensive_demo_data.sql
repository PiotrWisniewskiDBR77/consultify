-- ============================================================================
-- COMPREHENSIVE DEMO DATA MIGRATION
-- Migration: 500_comprehensive_demo_data.sql
-- Purpose: Populate all modules with realistic demo data for DBR77 organization
-- Created: 2026-01-27
-- Adapted to actual database schema
-- ============================================================================

-- ============================================================================
-- PHASE 1: USERS & TEAMS
-- Using organization: org-dbr77-test (Piotr's organization)
-- ============================================================================

-- Additional team members for the organization
INSERT OR IGNORE INTO users (id, organization_id, email, first_name, last_name, role, status, created_at) VALUES
('user-anna-kowalska', 'org-dbr77-test', 'anna.kowalska@dbr77.com', 'Anna', 'Kowalska', 'PROJECT_MANAGER', 'active', datetime('now', '-60 days')),
('user-jan-nowak', 'org-dbr77-test', 'jan.nowak@dbr77.com', 'Jan', 'Nowak', 'TEAM_MEMBER', 'active', datetime('now', '-45 days')),
('user-maria-wisniewska', 'org-dbr77-test', 'maria.wisniewska@dbr77.com', 'Maria', 'Wiśniewska', 'TEAM_MEMBER', 'active', datetime('now', '-30 days')),
('user-tomasz-lewandowski', 'org-dbr77-test', 'tomasz.lewandowski@dbr77.com', 'Tomasz', 'Lewandowski', 'TEAM_MEMBER', 'active', datetime('now', '-25 days')),
('user-katarzyna-dabrowska', 'org-dbr77-test', 'katarzyna.dabrowska@dbr77.com', 'Katarzyna', 'Dąbrowska', 'TEAM_MEMBER', 'active', datetime('now', '-20 days')),
('user-michal-zielinski', 'org-dbr77-test', 'michal.zielinski@dbr77.com', 'Michał', 'Zieliński', 'TEAM_MEMBER', 'active', datetime('now', '-15 days')),
('user-agnieszka-szymanska', 'org-dbr77-test', 'agnieszka.szymanska@dbr77.com', 'Agnieszka', 'Szymańska', 'TEAM_MEMBER', 'active', datetime('now', '-10 days')),
('user-pawel-wojcik', 'org-dbr77-test', 'pawel.wojcik@dbr77.com', 'Paweł', 'Wójcik', 'TEAM_MEMBER', 'active', datetime('now', '-5 days'));

-- Teams
INSERT OR IGNORE INTO teams (id, organization_id, name, description, lead_id, created_at) VALUES
('team-digital-transformation', 'org-dbr77-test', 'Digital Transformation', 'Core team responsible for digital transformation initiatives', 'user-anna-kowalska', datetime('now', '-50 days')),
('team-operations', 'org-dbr77-test', 'Operations Excellence', 'Team focused on operational improvements and lean initiatives', 'user-pawel-wojcik', datetime('now', '-45 days')),
('team-it-modernization', 'org-dbr77-test', 'IT Modernization', 'Team handling IT infrastructure and system upgrades', 'user-michal-zielinski', datetime('now', '-40 days')),
('team-change-management', 'org-dbr77-test', 'Change Management', 'Team supporting organizational change and adoption', 'user-agnieszka-szymanska', datetime('now', '-35 days'));

-- Team Members
INSERT OR IGNORE INTO team_members (team_id, user_id, role, joined_at) VALUES
('team-digital-transformation', 'user-anna-kowalska', 'lead', datetime('now', '-50 days')),
('team-digital-transformation', 'user-jan-nowak', 'member', datetime('now', '-45 days')),
('team-digital-transformation', 'user-maria-wisniewska', 'member', datetime('now', '-40 days')),
('team-digital-transformation', 'user-michal-zielinski', 'member', datetime('now', '-35 days')),
('team-operations', 'user-pawel-wojcik', 'lead', datetime('now', '-45 days')),
('team-operations', 'user-tomasz-lewandowski', 'member', datetime('now', '-40 days')),
('team-operations', 'user-katarzyna-dabrowska', 'member', datetime('now', '-35 days')),
('team-it-modernization', 'user-michal-zielinski', 'lead', datetime('now', '-40 days')),
('team-it-modernization', 'user-jan-nowak', 'member', datetime('now', '-35 days')),
('team-change-management', 'user-agnieszka-szymanska', 'lead', datetime('now', '-35 days')),
('team-change-management', 'user-maria-wisniewska', 'member', datetime('now', '-30 days')),
('team-digital-transformation', 'user-dbr77-admin', 'member', datetime('now', '-50 days')),
('team-operations', 'user-dbr77-admin', 'member', datetime('now', '-45 days'));

-- ============================================================================
-- PHASE 2: PROJECTS
-- ============================================================================

INSERT OR IGNORE INTO projects (id, organization_id, name, description, status, owner_id, created_at) VALUES
('proj-dt-2026', 'org-dbr77-test', 'Digital Transformation 2026', 'Comprehensive digital transformation program for 2026', 'active', 'user-anna-kowalska', datetime('now', '-90 days')),
('proj-erp-upgrade', 'org-dbr77-test', 'ERP System Upgrade', 'Migration from legacy SAP R/3 to S/4HANA', 'active', 'user-michal-zielinski', datetime('now', '-60 days')),
('proj-lean-manufacturing', 'org-dbr77-test', 'Lean Manufacturing Initiative', 'Implementation of lean principles across production', 'active', 'user-pawel-wojcik', datetime('now', '-45 days')),
('proj-customer-experience', 'org-dbr77-test', 'Customer Experience Enhancement', 'Improving customer touchpoints and satisfaction', 'active', 'user-maria-wisniewska', datetime('now', '-30 days')),
('proj-data-governance', 'org-dbr77-test', 'Data Governance Program', 'Establishing data quality and governance framework', 'active', 'user-jan-nowak', datetime('now', '-20 days')),
('proj-sustainability', 'org-dbr77-test', 'Sustainability & ESG', 'Environmental sustainability and ESG reporting', 'active', 'user-katarzyna-dabrowska', datetime('now', '-15 days')),
('proj-automation-rpa', 'org-dbr77-test', 'Process Automation (RPA)', 'Robotic Process Automation for back-office', 'active', 'user-tomasz-lewandowski', datetime('now', '-10 days'));

-- Project Users
INSERT OR IGNORE INTO project_users (project_id, user_id, role, assigned_at) VALUES
('proj-dt-2026', 'user-anna-kowalska', 'owner', datetime('now', '-90 days')),
('proj-dt-2026', 'user-jan-nowak', 'member', datetime('now', '-85 days')),
('proj-dt-2026', 'user-maria-wisniewska', 'member', datetime('now', '-80 days')),
('proj-dt-2026', 'user-michal-zielinski', 'member', datetime('now', '-75 days')),
('proj-dt-2026', 'user-dbr77-admin', 'member', datetime('now', '-90 days')),
('proj-erp-upgrade', 'user-michal-zielinski', 'owner', datetime('now', '-60 days')),
('proj-erp-upgrade', 'user-jan-nowak', 'member', datetime('now', '-55 days')),
('proj-erp-upgrade', 'user-tomasz-lewandowski', 'member', datetime('now', '-50 days')),
('proj-lean-manufacturing', 'user-pawel-wojcik', 'owner', datetime('now', '-45 days')),
('proj-lean-manufacturing', 'user-tomasz-lewandowski', 'member', datetime('now', '-40 days')),
('proj-lean-manufacturing', 'user-katarzyna-dabrowska', 'member', datetime('now', '-35 days')),
('proj-customer-experience', 'user-maria-wisniewska', 'owner', datetime('now', '-30 days')),
('proj-customer-experience', 'user-agnieszka-szymanska', 'member', datetime('now', '-25 days')),
('proj-data-governance', 'user-jan-nowak', 'owner', datetime('now', '-20 days')),
('proj-data-governance', 'user-michal-zielinski', 'member', datetime('now', '-15 days')),
('proj-sustainability', 'user-katarzyna-dabrowska', 'owner', datetime('now', '-15 days')),
('proj-sustainability', 'user-agnieszka-szymanska', 'member', datetime('now', '-10 days')),
('proj-automation-rpa', 'user-tomasz-lewandowski', 'owner', datetime('now', '-10 days')),
('proj-automation-rpa', 'user-jan-nowak', 'member', datetime('now', '-5 days'));

-- ============================================================================
-- PHASE 3: INITIATIVES (using actual schema)
-- ============================================================================

INSERT OR IGNORE INTO initiatives (id, organization_id, project_id, name, title, description, summary, status, priority, progress, start_date, end_date, owner_id, owner_business_id, current_stage, estimated_roi, estimated_budget, created_at) VALUES
-- Digital Transformation Initiatives
('init-mes-implementation', 'org-dbr77-test', 'proj-dt-2026', 'MES System Implementation', 'MES System Implementation', 'Deploy Manufacturing Execution System for real-time production monitoring', 'Real-time visibility, 15% OEE improvement', 'IN_PROGRESS', 'HIGH', 45, datetime('now', '-60 days'), datetime('now', '+180 days'), 'user-michal-zielinski', 'user-pawel-wojcik', 'PILOT', 2.5, 250000, datetime('now', '-60 days')),
('init-cloud-migration', 'org-dbr77-test', 'proj-dt-2026', 'Cloud Infrastructure Migration', 'Cloud Infrastructure Migration', 'Migrate on-premises workloads to Azure cloud', 'Scalability, 30% cost reduction', 'IN_PROGRESS', 'HIGH', 70, datetime('now', '-90 days'), datetime('now', '+90 days'), 'user-jan-nowak', 'user-michal-zielinski', 'SCALE', 1.8, 150000, datetime('now', '-90 days')),
('init-bi-analytics', 'org-dbr77-test', 'proj-dt-2026', 'Business Intelligence Platform', 'Business Intelligence Platform', 'Implement Power BI for enterprise reporting', 'Data-driven decisions, 2 days/week saved', 'IN_PROGRESS', 'MEDIUM', 55, datetime('now', '-45 days'), datetime('now', '+120 days'), 'user-jan-nowak', 'user-maria-wisniewska', 'PILOT', 3.0, 80000, datetime('now', '-45 days')),

-- ERP Initiatives
('init-sap-s4hana', 'org-dbr77-test', 'proj-erp-upgrade', 'SAP S/4HANA Migration', 'SAP S/4HANA Migration', 'Core ERP upgrade from R/3 to S/4HANA', 'Modern ERP foundation, real-time processing', 'DRAFT', 'HIGH', 15, datetime('now', '-30 days'), datetime('now', '+365 days'), 'user-tomasz-lewandowski', 'user-michal-zielinski', 'DESIGN', 2.0, 500000, datetime('now', '-30 days')),
('init-integration-platform', 'org-dbr77-test', 'proj-erp-upgrade', 'Integration Platform (iPaaS)', 'Integration Platform (iPaaS)', 'Deploy integration platform for system connectivity', 'Eliminate data silos, automated workflows', 'DRAFT', 'HIGH', 20, datetime('now', '-20 days'), datetime('now', '+180 days'), 'user-michal-zielinski', 'user-jan-nowak', 'DESIGN', 2.2, 120000, datetime('now', '-20 days')),

-- Lean Manufacturing Initiatives
('init-smed-program', 'org-dbr77-test', 'proj-lean-manufacturing', 'SMED Changeover Reduction', 'SMED Changeover Reduction', 'Single Minute Exchange of Die program', '50% changeover reduction, +10% OEE', 'IN_PROGRESS', 'HIGH', 60, datetime('now', '-30 days'), datetime('now', '+90 days'), 'user-tomasz-lewandowski', 'user-pawel-wojcik', 'PILOT', 4.0, 30000, datetime('now', '-30 days')),
('init-5s-implementation', 'org-dbr77-test', 'proj-lean-manufacturing', '5S Workplace Organization', '5S Workplace Organization', 'Implement 5S across all production areas', 'Improved safety, 20% productivity gain', 'IN_PROGRESS', 'MEDIUM', 85, datetime('now', '-45 days'), datetime('now', '+60 days'), 'user-katarzyna-dabrowska', 'user-tomasz-lewandowski', 'SCALE', 5.0, 15000, datetime('now', '-45 days')),
('init-tpm-program', 'org-dbr77-test', 'proj-lean-manufacturing', 'Total Productive Maintenance', 'Total Productive Maintenance', 'Implement TPM for equipment reliability', 'Reduce breakdowns by 40%', 'DRAFT', 'MEDIUM', 10, datetime('now', '-15 days'), datetime('now', '+180 days'), 'user-tomasz-lewandowski', 'user-pawel-wojcik', 'DESIGN', 3.5, 50000, datetime('now', '-15 days')),

-- Customer Experience Initiatives
('init-crm-enhancement', 'org-dbr77-test', 'proj-customer-experience', 'CRM System Enhancement', 'CRM System Enhancement', 'Upgrade CRM with 360-degree customer view', 'Improved customer retention, +15% sales', 'DRAFT', 'MEDIUM', 25, datetime('now', '-20 days'), datetime('now', '+150 days'), 'user-jan-nowak', 'user-maria-wisniewska', 'DESIGN', 2.8, 100000, datetime('now', '-20 days')),
('init-self-service-portal', 'org-dbr77-test', 'proj-customer-experience', 'Customer Self-Service Portal', 'Customer Self-Service Portal', 'Build customer portal for orders and support', 'Reduce support calls by 30%', 'DRAFT', 'LOW', 5, datetime('now', '-10 days'), datetime('now', '+180 days'), 'user-michal-zielinski', 'user-maria-wisniewska', 'DISCOVERY', 3.2, 80000, datetime('now', '-10 days')),

-- Data Governance Initiatives
('init-master-data-mgmt', 'org-dbr77-test', 'proj-data-governance', 'Master Data Management', 'Master Data Management', 'Implement MDM for customer and product data', 'Single source of truth, data quality', 'DRAFT', 'HIGH', 15, datetime('now', '-15 days'), datetime('now', '+240 days'), 'user-michal-zielinski', 'user-jan-nowak', 'DISCOVERY', 2.5, 90000, datetime('now', '-15 days')),
('init-data-quality', 'org-dbr77-test', 'proj-data-governance', 'Data Quality Program', 'Data Quality Program', 'Establish data quality rules and monitoring', 'Reduce data errors by 80%', 'DRAFT', 'MEDIUM', 20, datetime('now', '-10 days'), datetime('now', '+120 days'), 'user-maria-wisniewska', 'user-jan-nowak', 'DESIGN', 3.0, 40000, datetime('now', '-10 days')),

-- Sustainability Initiatives
('init-carbon-tracking', 'org-dbr77-test', 'proj-sustainability', 'Carbon Footprint Tracking', 'Carbon Footprint Tracking', 'Implement carbon emissions tracking and reporting', 'ESG compliance, customer requirements', 'DRAFT', 'MEDIUM', 10, datetime('now', '-10 days'), datetime('now', '+180 days'), 'user-tomasz-lewandowski', 'user-katarzyna-dabrowska', 'DISCOVERY', 1.5, 60000, datetime('now', '-10 days')),
('init-energy-optimization', 'org-dbr77-test', 'proj-sustainability', 'Energy Optimization', 'Energy Optimization', 'Reduce energy consumption in production', '20% energy cost reduction', 'DRAFT', 'MEDIUM', 5, datetime('now', '-5 days'), datetime('now', '+365 days'), 'user-pawel-wojcik', 'user-katarzyna-dabrowska', 'DESIGN', 4.0, 100000, datetime('now', '-5 days')),

-- RPA Initiatives
('init-invoice-automation', 'org-dbr77-test', 'proj-automation-rpa', 'Invoice Processing Automation', 'Invoice Processing Automation', 'Automate invoice processing with RPA', 'Save 3 FTE, 90% faster processing', 'IN_PROGRESS', 'HIGH', 75, datetime('now', '-8 days'), datetime('now', '+90 days'), 'user-jan-nowak', 'user-tomasz-lewandowski', 'PILOT', 4.5, 50000, datetime('now', '-8 days')),
('init-hr-onboarding-rpa', 'org-dbr77-test', 'proj-automation-rpa', 'HR Onboarding Automation', 'HR Onboarding Automation', 'Automate employee onboarding workflows', 'Reduce onboarding time by 60%', 'DRAFT', 'MEDIUM', 15, datetime('now', '-5 days'), datetime('now', '+120 days'), 'user-tomasz-lewandowski', 'user-agnieszka-szymanska', 'DESIGN', 3.5, 35000, datetime('now', '-5 days'));

-- ============================================================================
-- PHASE 4: TASKS (12+ tasks as shown in My Work)
-- ============================================================================

INSERT OR IGNORE INTO tasks (id, organization_id, project_id, initiative_id, title, description, status, priority, assignee_id, reporter_id, due_date, estimated_hours, task_type, created_at) VALUES
-- High priority tasks
('task-001', 'org-dbr77-test', 'proj-dt-2026', 'init-mes-implementation', 'Finalize MES vendor selection', 'Complete evaluation matrix and select final vendor for MES implementation', 'in_progress', 'high', 'user-michal-zielinski', 'user-anna-kowalska', datetime('now', '+3 days'), 16, 'decision', datetime('now', '-10 days')),
('task-002', 'org-dbr77-test', 'proj-erp-upgrade', 'init-sap-s4hana', 'Complete SAP S/4HANA business case', 'Prepare detailed business case with ROI analysis for board approval', 'todo', 'high', 'user-jan-nowak', 'user-michal-zielinski', datetime('now', '+5 days'), 24, 'execution', datetime('now', '-7 days')),
('task-003', 'org-dbr77-test', 'proj-lean-manufacturing', 'init-smed-program', 'Conduct SMED workshop Line 1', 'Facilitate SMED workshop with production team for Line 1', 'in_progress', 'high', 'user-tomasz-lewandowski', 'user-pawel-wojcik', datetime('now', '+2 days'), 8, 'execution', datetime('now', '-5 days')),
('task-004', 'org-dbr77-test', 'proj-automation-rpa', 'init-invoice-automation', 'Deploy invoice bot to production', 'Move invoice processing bot from UAT to production environment', 'todo', 'high', 'user-jan-nowak', 'user-tomasz-lewandowski', datetime('now', '+1 days'), 4, 'execution', datetime('now', '-3 days')),

-- Medium priority tasks
('task-005', 'org-dbr77-test', 'proj-dt-2026', 'init-cloud-migration', 'Migrate dev environment to Azure', 'Complete migration of development servers to Azure cloud', 'in_progress', 'medium', 'user-michal-zielinski', 'user-anna-kowalska', datetime('now', '+7 days'), 40, 'execution', datetime('now', '-14 days')),
('task-006', 'org-dbr77-test', 'proj-dt-2026', 'init-bi-analytics', 'Create executive dashboard', 'Build Power BI dashboard for executive KPIs', 'todo', 'medium', 'user-maria-wisniewska', 'user-jan-nowak', datetime('now', '+10 days'), 20, 'execution', datetime('now', '-5 days')),
('task-007', 'org-dbr77-test', 'proj-customer-experience', 'init-crm-enhancement', 'Document CRM requirements', 'Gather and document detailed requirements for CRM enhancement', 'in_progress', 'medium', 'user-maria-wisniewska', 'user-anna-kowalska', datetime('now', '+14 days'), 32, 'execution', datetime('now', '-10 days')),
('task-008', 'org-dbr77-test', 'proj-data-governance', 'init-master-data-mgmt', 'Define data ownership model', 'Create RACI matrix for data ownership across departments', 'todo', 'medium', 'user-jan-nowak', 'user-maria-wisniewska', datetime('now', '+21 days'), 16, 'execution', datetime('now', '-3 days')),
('task-009', 'org-dbr77-test', 'proj-sustainability', 'init-carbon-tracking', 'Research carbon tracking tools', 'Evaluate available tools for carbon footprint tracking', 'in_progress', 'medium', 'user-katarzyna-dabrowska', 'user-anna-kowalska', datetime('now', '+14 days'), 24, 'research', datetime('now', '-7 days')),

-- Lower priority tasks
('task-010', 'org-dbr77-test', 'proj-lean-manufacturing', 'init-5s-implementation', 'Update 5S audit checklist', 'Revise 5S audit checklist based on pilot feedback', 'todo', 'low', 'user-katarzyna-dabrowska', 'user-tomasz-lewandowski', datetime('now', '+30 days'), 8, 'execution', datetime('now', '-2 days')),
('task-011', 'org-dbr77-test', 'proj-lean-manufacturing', 'init-tpm-program', 'Create TPM training materials', 'Develop training materials for TPM program rollout', 'todo', 'low', 'user-tomasz-lewandowski', 'user-pawel-wojcik', datetime('now', '+45 days'), 40, 'execution', datetime('now', '-1 days')),
('task-012', 'org-dbr77-test', 'proj-automation-rpa', 'init-hr-onboarding-rpa', 'Map HR onboarding process', 'Document current HR onboarding process for automation analysis', 'in_progress', 'medium', 'user-agnieszka-szymanska', 'user-tomasz-lewandowski', datetime('now', '+7 days'), 16, 'execution', datetime('now', '-4 days')),

-- Completed tasks
('task-013', 'org-dbr77-test', 'proj-dt-2026', 'init-cloud-migration', 'Set up Azure subscription', 'Configure Azure subscription and initial resource groups', 'done', 'high', 'user-michal-zielinski', 'user-anna-kowalska', datetime('now', '-5 days'), 8, 'execution', datetime('now', '-20 days')),
('task-014', 'org-dbr77-test', 'proj-lean-manufacturing', 'init-5s-implementation', 'Complete 5S pilot in Area A', 'Finish 5S implementation pilot in production Area A', 'done', 'high', 'user-tomasz-lewandowski', 'user-pawel-wojcik', datetime('now', '-10 days'), 40, 'execution', datetime('now', '-30 days')),
('task-015', 'org-dbr77-test', 'proj-dt-2026', 'init-bi-analytics', 'Install Power BI Gateway', 'Set up and configure Power BI Gateway for on-premises data', 'done', 'medium', 'user-jan-nowak', 'user-michal-zielinski', datetime('now', '-7 days'), 4, 'execution', datetime('now', '-14 days'));

-- Task Comments
INSERT OR IGNORE INTO task_comments (id, task_id, user_id, content, created_at) VALUES
('comment-001', 'task-001', 'user-anna-kowalska', 'Please ensure we include TCO analysis in the vendor evaluation.', datetime('now', '-8 days')),
('comment-002', 'task-001', 'user-michal-zielinski', 'Added TCO calculations. Siemens and Rockwell are the top 2 candidates.', datetime('now', '-6 days')),
('comment-003', 'task-003', 'user-pawel-wojcik', 'Great progress on Line 1! Changeover time reduced from 45 min to 22 min.', datetime('now', '-2 days')),
('comment-004', 'task-005', 'user-michal-zielinski', 'Dev environment migration 70% complete. Some issues with legacy database connections.', datetime('now', '-3 days')),
('comment-005', 'task-007', 'user-maria-wisniewska', 'Completed interviews with Sales and Customer Service teams. Key pain points documented.', datetime('now', '-5 days')),
('comment-006', 'task-009', 'user-katarzyna-dabrowska', 'Shortlisted 3 tools: Sphera, Persefoni, and Watershed. Scheduling demos next week.', datetime('now', '-4 days'));

-- ============================================================================
-- PHASE 5: DECISIONS (16+ decisions as shown in My Work)
-- Using actual schema: project_id, decision_type, related_object_type, related_object_id, decision_owner_id
-- ============================================================================

INSERT OR IGNORE INTO decisions (id, organization_id, project_id, initiative_id, decision_type, related_object_type, related_object_id, decision_owner_id, requested_by_id, status, priority, due_date, title, description, options, type, created_by, created_at) VALUES
-- Pending decisions (Awaiting Others)
('dec-001', 'org-dbr77-test', 'proj-dt-2026', 'init-mes-implementation', 'GO_NO_GO', 'initiative', 'init-mes-implementation', 'user-dbr77-admin', 'user-michal-zielinski', 'PENDING', 'HIGH', datetime('now', '+5 days'), 'MES Vendor Selection', 'Select the MES vendor for production implementation', '["Siemens Opcenter", "Rockwell FactoryTalk", "AVEVA MES"]', 'GO_NO_GO', 'user-michal-zielinski', datetime('now', '-10 days')),
('dec-002', 'org-dbr77-test', 'proj-erp-upgrade', 'init-sap-s4hana', 'GO_NO_GO', 'initiative', 'init-sap-s4hana', 'user-michal-zielinski', 'user-jan-nowak', 'PENDING', 'HIGH', datetime('now', '+14 days'), 'S/4HANA Implementation Approach', 'Decide between greenfield vs brownfield migration', '["Greenfield (new implementation)", "Brownfield (system conversion)", "Selective data transition"]', 'GO_NO_GO', 'user-jan-nowak', datetime('now', '-7 days')),
('dec-003', 'org-dbr77-test', 'proj-dt-2026', 'init-cloud-migration', 'APPROVAL', 'initiative', 'init-cloud-migration', 'user-dbr77-admin', 'user-michal-zielinski', 'PENDING', 'HIGH', datetime('now', '+3 days'), 'Cloud Provider Selection', 'Confirm Azure as primary cloud provider', '["Azure (recommended)", "AWS", "Google Cloud", "Multi-cloud"]', 'APPROVAL', 'user-michal-zielinski', datetime('now', '-5 days')),
('dec-004', 'org-dbr77-test', 'proj-lean-manufacturing', 'init-smed-program', 'RESOURCE_ALLOCATION', 'initiative', 'init-smed-program', 'user-pawel-wojcik', 'user-tomasz-lewandowski', 'PENDING', 'MEDIUM', datetime('now', '+7 days'), 'SMED Rollout Priority', 'Decide which production lines to prioritize for SMED', '["Line 1 & 2 first", "All lines simultaneously", "Line 3 first (highest changeover time)"]', 'RESOURCE_ALLOCATION', 'user-tomasz-lewandowski', datetime('now', '-3 days')),
('dec-005', 'org-dbr77-test', 'proj-automation-rpa', 'init-invoice-automation', 'GO_NO_GO', 'initiative', 'init-invoice-automation', 'user-tomasz-lewandowski', 'user-jan-nowak', 'PENDING', 'HIGH', datetime('now', '+10 days'), 'RPA Platform Selection', 'Select RPA platform for enterprise deployment', '["UiPath", "Automation Anywhere", "Microsoft Power Automate"]', 'GO_NO_GO', 'user-jan-nowak', datetime('now', '-8 days')),
('dec-006', 'org-dbr77-test', 'proj-customer-experience', 'init-crm-enhancement', 'APPROVAL', 'initiative', 'init-crm-enhancement', 'user-maria-wisniewska', 'user-jan-nowak', 'PENDING', 'MEDIUM', datetime('now', '+21 days'), 'CRM Integration Scope', 'Define scope of CRM integration with other systems', '["Full integration (ERP, MES, BI)", "Partial (ERP only)", "Standalone with manual sync"]', 'APPROVAL', 'user-jan-nowak', datetime('now', '-2 days')),
('dec-007', 'org-dbr77-test', 'proj-data-governance', 'init-master-data-mgmt', 'GO_NO_GO', 'initiative', 'init-master-data-mgmt', 'user-jan-nowak', 'user-michal-zielinski', 'PENDING', 'HIGH', datetime('now', '+30 days'), 'MDM Tool Selection', 'Select Master Data Management platform', '["SAP MDG", "Informatica MDM", "Profisee"]', 'GO_NO_GO', 'user-michal-zielinski', datetime('now', '-1 days')),
('dec-008', 'org-dbr77-test', 'proj-sustainability', 'init-carbon-tracking', 'APPROVAL', 'initiative', 'init-carbon-tracking', 'user-katarzyna-dabrowska', 'user-dbr77-admin', 'PENDING', 'MEDIUM', datetime('now', '+14 days'), 'Carbon Tracking Approach', 'Decide on carbon tracking methodology', '["GHG Protocol Scope 1-3", "ISO 14064", "Custom framework"]', 'APPROVAL', 'user-dbr77-admin', datetime('now', '-4 days')),

-- Made decisions
('dec-009', 'org-dbr77-test', 'proj-dt-2026', 'init-bi-analytics', 'GO_NO_GO', 'initiative', 'init-bi-analytics', 'user-dbr77-admin', 'user-jan-nowak', 'APPROVED', 'HIGH', datetime('now', '-10 days'), 'BI Platform Selection', 'Select business intelligence platform', '["Power BI", "Tableau", "Qlik"]', 'GO_NO_GO', 'user-jan-nowak', datetime('now', '-30 days')),
('dec-010', 'org-dbr77-test', 'proj-lean-manufacturing', 'init-5s-implementation', 'RESOURCE_ALLOCATION', 'initiative', 'init-5s-implementation', 'user-pawel-wojcik', 'user-tomasz-lewandowski', 'APPROVED', 'MEDIUM', datetime('now', '-20 days'), '5S Pilot Area Selection', 'Select pilot area for 5S implementation', '["Production Area A", "Production Area B", "Warehouse"]', 'RESOURCE_ALLOCATION', 'user-tomasz-lewandowski', datetime('now', '-45 days')),
('dec-011', 'org-dbr77-test', 'proj-dt-2026', 'init-cloud-migration', 'APPROVAL', 'initiative', 'init-cloud-migration', 'user-dbr77-admin', 'user-michal-zielinski', 'APPROVED', 'HIGH', datetime('now', '-15 days'), 'Cloud Migration Timeline', 'Approve cloud migration timeline', '["Q1 2026 (aggressive)", "Q2 2026 (recommended)", "Q3 2026 (conservative)"]', 'APPROVAL', 'user-michal-zielinski', datetime('now', '-40 days')),
('dec-012', 'org-dbr77-test', 'proj-erp-upgrade', 'init-integration-platform', 'GO_NO_GO', 'initiative', 'init-integration-platform', 'user-michal-zielinski', 'user-jan-nowak', 'APPROVED', 'HIGH', datetime('now', '-5 days'), 'Integration Platform Selection', 'Select iPaaS for system integration', '["MuleSoft", "Dell Boomi", "Microsoft Azure Integration Services"]', 'GO_NO_GO', 'user-jan-nowak', datetime('now', '-25 days')),

-- Escalated decisions
('dec-013', 'org-dbr77-test', 'proj-erp-upgrade', 'init-sap-s4hana', 'APPROVAL', 'initiative', 'init-sap-s4hana', 'user-dbr77-admin', 'user-michal-zielinski', 'ESCALATED', 'HIGH', datetime('now', '-2 days'), 'SAP License Negotiation', 'Approve SAP licensing terms and budget', '["Accept current offer", "Negotiate further", "Explore alternatives"]', 'APPROVAL', 'user-michal-zielinski', datetime('now', '-20 days')),
('dec-014', 'org-dbr77-test', 'proj-sustainability', 'init-energy-optimization', 'APPROVAL', 'initiative', 'init-energy-optimization', 'user-dbr77-admin', 'user-katarzyna-dabrowska', 'ESCALATED', 'HIGH', datetime('now', '+1 days'), 'Solar Panel Investment', 'Approve capital investment for solar panels', '["Full installation (500kW)", "Partial (250kW)", "Defer to 2027"]', 'APPROVAL', 'user-katarzyna-dabrowska', datetime('now', '-15 days')),

-- Expired/Cancelled
('dec-015', 'org-dbr77-test', 'proj-customer-experience', 'init-self-service-portal', 'GO_NO_GO', 'initiative', 'init-self-service-portal', 'user-maria-wisniewska', 'user-michal-zielinski', 'EXPIRED', 'MEDIUM', datetime('now', '-7 days'), 'Portal Technology Stack', 'Select technology stack for customer portal', '["React + Node.js", "Angular + .NET", "Vue + Python"]', 'GO_NO_GO', 'user-michal-zielinski', datetime('now', '-30 days')),
('dec-016', 'org-dbr77-test', 'proj-automation-rpa', 'init-hr-onboarding-rpa', 'APPROVAL', 'initiative', 'init-hr-onboarding-rpa', 'user-agnieszka-szymanska', 'user-tomasz-lewandowski', 'CANCELLED', 'LOW', datetime('now', '-3 days'), 'HR System Integration', 'Decide on HR system integration approach', '["API integration", "Database sync", "Manual process"]', 'APPROVAL', 'user-tomasz-lewandowski', datetime('now', '-14 days'));

-- Update made decisions with results
UPDATE decisions SET outcome = 'Power BI', rationale = 'Best integration with existing Microsoft stack, lower TCO', decided_at = datetime('now', '-10 days') WHERE id = 'dec-009';
UPDATE decisions SET outcome = 'Production Area A', rationale = 'Highest visibility area, strong team buy-in', decided_at = datetime('now', '-20 days') WHERE id = 'dec-010';
UPDATE decisions SET outcome = 'Q2 2026 (recommended)', rationale = 'Balanced approach allowing proper testing', decided_at = datetime('now', '-15 days') WHERE id = 'dec-011';
UPDATE decisions SET outcome = 'Microsoft Azure Integration Services', rationale = 'Best fit with Azure cloud strategy, cost effective', decided_at = datetime('now', '-5 days') WHERE id = 'dec-012';

-- Decision Stakeholders
INSERT OR IGNORE INTO decision_stakeholders (id, decision_id, user_id, role) VALUES
('ds-001', 'dec-001', 'user-michal-zielinski', 'consulted'),
('ds-002', 'dec-001', 'user-pawel-wojcik', 'consulted'),
('ds-003', 'dec-001', 'user-jan-nowak', 'informed'),
('ds-004', 'dec-002', 'user-dbr77-admin', 'consulted'),
('ds-005', 'dec-002', 'user-jan-nowak', 'consulted'),
('ds-006', 'dec-003', 'user-jan-nowak', 'voter'),
('ds-007', 'dec-003', 'user-tomasz-lewandowski', 'informed'),
('ds-008', 'dec-004', 'user-katarzyna-dabrowska', 'consulted'),
('ds-009', 'dec-005', 'user-michal-zielinski', 'consulted'),
('ds-010', 'dec-005', 'user-dbr77-admin', 'voter');

-- Decision History
INSERT OR IGNORE INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details, created_at) VALUES
('dh-001', 'dec-009', 'decided', 'PENDING', 'APPROVED', 'user-dbr77-admin', '{"selected": "Power BI"}', datetime('now', '-10 days')),
('dh-002', 'dec-010', 'decided', 'PENDING', 'APPROVED', 'user-pawel-wojcik', '{"selected": "Production Area A"}', datetime('now', '-20 days')),
('dh-003', 'dec-011', 'decided', 'PENDING', 'APPROVED', 'user-dbr77-admin', '{"selected": "Q2 2026"}', datetime('now', '-15 days')),
('dh-004', 'dec-013', 'escalated', 'PENDING', 'ESCALATED', 'user-michal-zielinski', '{"reason": "Budget exceeds approval limit"}', datetime('now', '-2 days')),
('dh-005', 'dec-014', 'escalated', 'PENDING', 'ESCALATED', 'user-katarzyna-dabrowska', '{"reason": "Capital investment requires board approval"}', datetime('now', '-1 days'));

-- ============================================================================
-- PHASE 6: TOOL SESSIONS (Discovery items - 20+ as shown in Tools module)
-- Using tool_sessions table with tool_type
-- ============================================================================

INSERT OR IGNORE INTO tool_sessions (id, organization_id, project_id, tool_type, name, status, completion_percent, created_by, created_at, updated_at) VALUES
-- Strategy category (10 items)
('ts-001', 'org-dbr77-test', 'proj-dt-2026', 'DRD', 'Digital Strategy Assessment 2026', 'COMPLETED', 100, 'user-dbr77-admin', datetime('now', '-60 days'), datetime('now', '-30 days')),
('ts-002', 'org-dbr77-test', 'proj-erp-upgrade', 'DRD', 'IT Capability Assessment', 'COMPLETED', 100, 'user-michal-zielinski', datetime('now', '-45 days'), datetime('now', '-20 days')),
('ts-003', 'org-dbr77-test', 'proj-dt-2026', 'SIRI', 'Industry 4.0 Readiness', 'IN_PROGRESS', 75, 'user-pawel-wojcik', datetime('now', '-30 days'), datetime('now', '-5 days')),
('ts-004', 'org-dbr77-test', 'proj-data-governance', 'DRD', 'Data Management Maturity', 'IN_PROGRESS', 60, 'user-jan-nowak', datetime('now', '-20 days'), datetime('now', '-3 days')),
('ts-005', 'org-dbr77-test', 'proj-customer-experience', 'DRD', 'Customer Experience Baseline', 'DRAFT', 30, 'user-maria-wisniewska', datetime('now', '-15 days'), datetime('now', '-7 days')),
('ts-006', 'org-dbr77-test', 'proj-lean-manufacturing', 'ADMA', 'Advanced Manufacturing Assessment', 'IN_PROGRESS', 45, 'user-tomasz-lewandowski', datetime('now', '-25 days'), datetime('now', '-10 days')),
('ts-007', 'org-dbr77-test', 'proj-sustainability', 'DRD', 'Sustainability Readiness', 'DRAFT', 20, 'user-katarzyna-dabrowska', datetime('now', '-10 days'), datetime('now', '-5 days')),
('ts-008', 'org-dbr77-test', 'proj-automation-rpa', 'CMMI', 'Process Maturity Assessment', 'COMPLETED', 100, 'user-tomasz-lewandowski', datetime('now', '-40 days'), datetime('now', '-25 days')),
('ts-009', 'org-dbr77-test', 'proj-erp-upgrade', 'DRD', 'Integration Capability Assessment', 'IN_PROGRESS', 55, 'user-jan-nowak', datetime('now', '-18 days'), datetime('now', '-4 days')),
('ts-010', 'org-dbr77-test', 'proj-dt-2026', 'DRD', 'Change Management Readiness', 'COMPLETED', 100, 'user-agnieszka-szymanska', datetime('now', '-35 days'), datetime('now', '-15 days')),

-- Operations category (10 items)
('ts-011', 'org-dbr77-test', 'proj-lean-manufacturing', 'LEAN40', 'Lean 4.0 Manufacturing Assessment', 'IN_PROGRESS', 70, 'user-pawel-wojcik', datetime('now', '-28 days'), datetime('now', '-6 days')),
('ts-012', 'org-dbr77-test', 'proj-automation-rpa', 'PROCESS_FLOW', 'Order-to-Cash Process Mapping', 'COMPLETED', 100, 'user-tomasz-lewandowski', datetime('now', '-35 days'), datetime('now', '-20 days')),
('ts-013', 'org-dbr77-test', 'proj-automation-rpa', 'PROCESS_FLOW', 'Procure-to-Pay Process', 'IN_PROGRESS', 65, 'user-jan-nowak', datetime('now', '-22 days'), datetime('now', '-8 days')),
('ts-014', 'org-dbr77-test', 'proj-lean-manufacturing', 'A3_PDCA', 'OEE Improvement A3', 'IN_PROGRESS', 50, 'user-tomasz-lewandowski', datetime('now', '-14 days'), datetime('now', '-3 days')),
('ts-015', 'org-dbr77-test', 'proj-lean-manufacturing', 'A3_PDCA', 'Quality Defects Reduction', 'DRAFT', 25, 'user-katarzyna-dabrowska', datetime('now', '-10 days'), datetime('now', '-5 days')),
('ts-016', 'org-dbr77-test', 'proj-automation-rpa', 'PROCESS_FLOW', 'HR Onboarding Process', 'IN_PROGRESS', 40, 'user-agnieszka-szymanska', datetime('now', '-12 days'), datetime('now', '-4 days')),
('ts-017', 'org-dbr77-test', 'proj-lean-manufacturing', 'LEAN40', 'Warehouse Operations Assessment', 'DRAFT', 15, 'user-pawel-wojcik', datetime('now', '-8 days'), datetime('now', '-3 days')),
('ts-018', 'org-dbr77-test', 'proj-customer-experience', 'PROCESS_FLOW', 'Customer Support Process', 'DRAFT', 20, 'user-maria-wisniewska', datetime('now', '-7 days'), datetime('now', '-2 days')),
('ts-019', 'org-dbr77-test', 'proj-lean-manufacturing', 'A3_PDCA', 'Changeover Time Reduction', 'COMPLETED', 100, 'user-tomasz-lewandowski', datetime('now', '-30 days'), datetime('now', '-10 days')),
('ts-020', 'org-dbr77-test', 'proj-erp-upgrade', 'PROCESS_FLOW', 'Production Planning Process', 'IN_PROGRESS', 35, 'user-pawel-wojcik', datetime('now', '-15 days'), datetime('now', '-5 days')),

-- Digital category (10 items)
('ts-021', 'org-dbr77-test', 'proj-dt-2026', 'DRD', 'Cloud Readiness Assessment', 'COMPLETED', 100, 'user-michal-zielinski', datetime('now', '-50 days'), datetime('now', '-35 days')),
('ts-022', 'org-dbr77-test', 'proj-dt-2026', 'DRD', 'Cybersecurity Maturity', 'IN_PROGRESS', 60, 'user-michal-zielinski', datetime('now', '-20 days'), datetime('now', '-7 days')),
('ts-023', 'org-dbr77-test', 'proj-dt-2026', 'AI_ADVISER', 'AI Use Cases Discovery', 'IN_PROGRESS', 45, 'user-jan-nowak', datetime('now', '-18 days'), datetime('now', '-5 days')),
('ts-024', 'org-dbr77-test', 'proj-erp-upgrade', 'DRD', 'API Strategy Assessment', 'DRAFT', 30, 'user-michal-zielinski', datetime('now', '-12 days'), datetime('now', '-4 days')),
('ts-025', 'org-dbr77-test', 'proj-automation-rpa', 'AI_ADVISER', 'RPA Opportunity Analysis', 'COMPLETED', 100, 'user-tomasz-lewandowski', datetime('now', '-25 days'), datetime('now', '-15 days')),
('ts-026', 'org-dbr77-test', 'proj-customer-experience', 'DRD', 'Mobile Strategy Assessment', 'DRAFT', 10, 'user-maria-wisniewska', datetime('now', '-5 days'), datetime('now', '-2 days')),
('ts-027', 'org-dbr77-test', 'proj-dt-2026', 'DRD', 'Analytics Maturity Assessment', 'COMPLETED', 100, 'user-jan-nowak', datetime('now', '-40 days'), datetime('now', '-25 days')),
('ts-028', 'org-dbr77-test', 'proj-lean-manufacturing', 'AI_ADVISER', 'Predictive Maintenance Analysis', 'IN_PROGRESS', 35, 'user-michal-zielinski', datetime('now', '-10 days'), datetime('now', '-3 days')),
('ts-029', 'org-dbr77-test', 'proj-dt-2026', 'DRD', 'IoT Readiness Assessment', 'IN_PROGRESS', 55, 'user-pawel-wojcik', datetime('now', '-16 days'), datetime('now', '-6 days')),
('ts-030', 'org-dbr77-test', 'proj-dt-2026', 'ECONOMIC_EVAL', 'MES Business Case', 'COMPLETED', 100, 'user-dbr77-admin', datetime('now', '-35 days'), datetime('now', '-20 days')),

-- Process Automation category
('ts-031', 'org-dbr77-test', 'proj-automation-rpa', 'PROCESS_FLOW', 'Invoice Automation Flow', 'IN_PROGRESS', 80, 'user-tomasz-lewandowski', datetime('now', '-20 days'), datetime('now', '-5 days'));

-- ============================================================================
-- PHASE 7: ASSESSMENTS
-- ============================================================================

INSERT OR IGNORE INTO assessments (id, organization_id, name, description, status, framework_type, created_at, updated_at) VALUES
('assess-001', 'org-dbr77-test', 'Digital Transformation Assessment 2026', 'Comprehensive DRD assessment for digital transformation', 'COMPLETED', 'DRD', datetime('now', '-60 days'), datetime('now', '-30 days')),
('assess-002', 'org-dbr77-test', 'ERP Readiness Assessment', 'Assessment for ERP upgrade project', 'COMPLETED', 'DRD', datetime('now', '-45 days'), datetime('now', '-20 days')),
('assess-003', 'org-dbr77-test', 'Lean Manufacturing Assessment', 'Lean 4.0 maturity assessment', 'IN_PROGRESS', 'LEAN40', datetime('now', '-30 days'), datetime('now', '-5 days')),
('assess-004', 'org-dbr77-test', 'Customer Experience Assessment', 'CX maturity baseline', 'DRAFT', 'DRD', datetime('now', '-15 days'), datetime('now', '-7 days')),
('assess-005', 'org-dbr77-test', 'Data Governance Assessment', 'Data management maturity', 'IN_PROGRESS', 'DRD', datetime('now', '-20 days'), datetime('now', '-3 days'));

-- Maturity Assessments
INSERT OR IGNORE INTO maturity_assessments (id, project_id, axis_scores, completed_axes, overall_as_is, overall_to_be, overall_gap, is_complete, created_at) VALUES
('ma-001', 'proj-dt-2026', '{"strategy": 3.5, "operations": 2.8, "digital": 2.2, "people": 3.0, "finance": 3.2}', '["strategy", "operations", "digital", "people", "finance"]', 2.94, 4.2, 1.26, 1, datetime('now', '-30 days')),
('ma-002', 'proj-erp-upgrade', '{"strategy": 3.0, "operations": 2.5, "digital": 2.0, "people": 2.8, "finance": 3.0}', '["strategy", "operations", "digital", "people", "finance"]', 2.66, 4.0, 1.34, 1, datetime('now', '-20 days')),
('ma-003', 'proj-lean-manufacturing', '{"strategy": 3.2, "operations": 2.0, "digital": 1.8}', '["strategy", "operations", "digital"]', 2.33, 4.0, 1.67, 0, datetime('now', '-5 days')),
('ma-004', 'proj-customer-experience', '{"strategy": 2.8}', '["strategy"]', 2.8, 4.5, 1.7, 0, datetime('now', '-7 days')),
('ma-005', 'proj-data-governance', '{"strategy": 2.5, "operations": 2.2}', '["strategy", "operations"]', 2.35, 4.2, 1.85, 0, datetime('now', '-3 days'));

-- Rapid Lean Assessments
INSERT OR IGNORE INTO rapid_lean_assessments (id, organization_id, project_id, value_stream_score, waste_elimination_score, flow_pull_score, quality_source_score, continuous_improvement_score, visual_management_score, overall_score, created_by, created_at) VALUES
('rla-001', 'org-dbr77-test', 'proj-lean-manufacturing', 2.8, 2.5, 2.2, 3.0, 2.0, 2.5, 2.5, 'user-pawel-wojcik', datetime('now', '-25 days')),
('rla-002', 'org-dbr77-test', 'proj-lean-manufacturing', 3.2, 3.0, 2.8, 3.2, 2.5, 3.0, 2.95, 'user-tomasz-lewandowski', datetime('now', '-10 days'));

-- ADKAR Assessments
INSERT OR IGNORE INTO adkar_assessments (id, organization_id, project_id, awareness_score, desire_score, knowledge_score, ability_score, reinforcement_score, overall_score, created_by, created_at) VALUES
('adkar-001', 'org-dbr77-test', 'proj-dt-2026', 4.0, 3.5, 3.0, 2.5, 2.0, 3.0, 'user-agnieszka-szymanska', datetime('now', '-20 days')),
('adkar-002', 'org-dbr77-test', 'proj-erp-upgrade', 3.5, 3.0, 2.5, 2.0, 1.5, 2.5, 'user-agnieszka-szymanska', datetime('now', '-15 days'));

-- ============================================================================
-- PHASE 8: NOTIFICATIONS (21+ as shown in My Work)
-- ============================================================================

INSERT OR IGNORE INTO notifications (id, user_id, organization_id, type, title, message, priority, entity_type, entity_id, actor_name, created_at, read) VALUES
-- Task notifications
('notif-001', 'user-dbr77-admin', 'org-dbr77-test', 'task_assigned', 'New task assigned', 'You have been assigned to "Finalize MES vendor selection"', 'high', 'task', 'task-001', 'Anna Kowalska', datetime('now', '-10 days'), 0),
('notif-002', 'user-dbr77-admin', 'org-dbr77-test', 'task_due_soon', 'Task due tomorrow', 'Task "Deploy invoice bot to production" is due tomorrow', 'high', 'task', 'task-004', 'System', datetime('now', '-1 days'), 0),
('notif-003', 'user-dbr77-admin', 'org-dbr77-test', 'task_completed', 'Task completed', 'Jan Nowak completed "Install Power BI Gateway"', 'normal', 'task', 'task-015', 'Jan Nowak', datetime('now', '-7 days'), 1),
('notif-004', 'user-dbr77-admin', 'org-dbr77-test', 'task_comment', 'New comment on task', 'Michał Zieliński commented on "Finalize MES vendor selection"', 'normal', 'task', 'task-001', 'Michał Zieliński', datetime('now', '-6 days'), 1),

-- Decision notifications
('notif-005', 'user-dbr77-admin', 'org-dbr77-test', 'decision_pending', 'Decision awaiting your input', 'MES Vendor Selection requires your decision', 'high', 'decision', 'dec-001', 'Michał Zieliński', datetime('now', '-10 days'), 0),
('notif-006', 'user-dbr77-admin', 'org-dbr77-test', 'decision_pending', 'Decision awaiting approval', 'Cloud Provider Selection needs your approval', 'high', 'decision', 'dec-003', 'Michał Zieliński', datetime('now', '-5 days'), 0),
('notif-007', 'user-dbr77-admin', 'org-dbr77-test', 'decision_escalated', 'Decision escalated', 'SAP License Negotiation has been escalated to you', 'urgent', 'decision', 'dec-013', 'Michał Zieliński', datetime('now', '-2 days'), 0),
('notif-008', 'user-dbr77-admin', 'org-dbr77-test', 'decision_made', 'Decision finalized', 'BI Platform Selection: Power BI selected', 'normal', 'decision', 'dec-009', 'Anna Kowalska', datetime('now', '-10 days'), 1),
('notif-009', 'user-dbr77-admin', 'org-dbr77-test', 'decision_vote_requested', 'Your vote requested', 'Please vote on Cloud Provider Selection', 'high', 'decision', 'dec-003', 'Michał Zieliński', datetime('now', '-4 days'), 0),

-- Initiative notifications
('notif-010', 'user-dbr77-admin', 'org-dbr77-test', 'initiative_status_change', 'Initiative status updated', 'MES System Implementation moved to Pilot phase', 'normal', 'initiative', 'init-mes-implementation', 'Michał Zieliński', datetime('now', '-5 days'), 1),
('notif-011', 'user-dbr77-admin', 'org-dbr77-test', 'initiative_milestone', 'Milestone reached', '5S Workplace Organization reached Scale phase', 'normal', 'initiative', 'init-5s-implementation', 'Tomasz Lewandowski', datetime('now', '-3 days'), 0),

-- Project notifications
('notif-012', 'user-dbr77-admin', 'org-dbr77-test', 'project_update', 'Project update', 'Digital Transformation 2026 weekly summary available', 'normal', 'project', 'proj-dt-2026', 'System', datetime('now', '-7 days'), 1),
('notif-013', 'user-dbr77-admin', 'org-dbr77-test', 'project_risk', 'Risk identified', 'New risk identified in ERP System Upgrade project', 'high', 'project', 'proj-erp-upgrade', 'Jan Nowak', datetime('now', '-4 days'), 0),

-- Assessment notifications
('notif-014', 'user-dbr77-admin', 'org-dbr77-test', 'assessment_completed', 'Assessment completed', 'Digital Strategy Assessment 2026 has been completed', 'normal', 'assessment', 'assess-001', 'Anna Kowalska', datetime('now', '-30 days'), 1),
('notif-015', 'user-dbr77-admin', 'org-dbr77-test', 'assessment_reminder', 'Assessment reminder', 'Customer Experience assessment is 30% complete', 'normal', 'assessment', 'assess-004', 'System', datetime('now', '-2 days'), 0),

-- Interview notifications
('notif-016', 'user-dbr77-admin', 'org-dbr77-test', 'interview_assigned', 'Interview assigned', 'New interview assignment: Digital Maturity Discovery', 'high', 'interview', 'demo_assign_001', 'Anna Kowalska', datetime('now', '-7 days'), 0),
('notif-017', 'user-dbr77-admin', 'org-dbr77-test', 'interview_insight', 'New insight generated', 'AI generated insight from Manufacturing Assessment', 'normal', 'interview', 'demo_insight_004', 'AI System', datetime('now', '-3 days'), 0),

-- Team notifications
('notif-018', 'user-dbr77-admin', 'org-dbr77-test', 'team_member_added', 'New team member', 'Katarzyna Dąbrowska joined Operations Excellence team', 'normal', 'team', 'team-operations', 'Paweł Wójcik', datetime('now', '-35 days'), 1),

-- System notifications
('notif-019', 'user-dbr77-admin', 'org-dbr77-test', 'system_update', 'System update', 'New features available: Enhanced decision tracking', 'low', NULL, NULL, 'System', datetime('now', '-14 days'), 1),
('notif-020', 'user-dbr77-admin', 'org-dbr77-test', 'weekly_digest', 'Weekly digest', 'Your weekly activity summary is ready', 'low', NULL, NULL, 'System', datetime('now', '-7 days'), 1),
('notif-021', 'user-dbr77-admin', 'org-dbr77-test', 'ai_recommendation', 'AI Recommendation', 'AI suggests reviewing SMED program progress', 'normal', 'initiative', 'init-smed-program', 'AI System', datetime('now', '-1 days'), 0),

-- Additional notifications
('notif-022', 'user-dbr77-admin', 'org-dbr77-test', 'deadline_approaching', 'Deadline approaching', 'S/4HANA Implementation decision deadline in 14 days', 'high', 'decision', 'dec-002', 'System', datetime('now', '-1 days'), 0),
('notif-023', 'user-dbr77-admin', 'org-dbr77-test', 'report_ready', 'Report ready', 'Monthly transformation progress report is ready', 'normal', 'report', NULL, 'System', datetime('now', '-3 days'), 0),
('notif-024', 'user-dbr77-admin', 'org-dbr77-test', 'budget_alert', 'Budget alert', 'ERP Upgrade project approaching 80% budget utilization', 'high', 'project', 'proj-erp-upgrade', 'System', datetime('now', '-2 days'), 0),
('notif-025', 'user-dbr77-admin', 'org-dbr77-test', 'collaboration_invite', 'Collaboration invite', 'Maria Wiśniewska invited you to review CRM requirements', 'normal', 'task', 'task-007', 'Maria Wiśniewska', datetime('now', '-5 days'), 0);

-- ============================================================================
-- PHASE 9: REPORTS
-- ============================================================================

INSERT OR IGNORE INTO reports (id, organization_id, project_id, title, status, created_at, updated_at) VALUES
('report-001', 'org-dbr77-test', 'proj-dt-2026', 'Digital Transformation Q4 2025 Report', 'published', datetime('now', '-30 days'), datetime('now', '-25 days')),
('report-002', 'org-dbr77-test', 'proj-dt-2026', 'Digital Transformation Q1 2026 Report', 'draft', datetime('now', '-5 days'), datetime('now', '-2 days')),
('report-003', 'org-dbr77-test', 'proj-lean-manufacturing', 'Lean Manufacturing Progress Report', 'published', datetime('now', '-15 days'), datetime('now', '-10 days')),
('report-004', 'org-dbr77-test', 'proj-erp-upgrade', 'ERP Upgrade Feasibility Study', 'in_review', datetime('now', '-20 days'), datetime('now', '-7 days')),
('report-005', 'org-dbr77-test', NULL, 'Monthly Executive Summary - January 2026', 'draft', datetime('now', '-3 days'), datetime('now', '-1 days'));

-- ============================================================================
-- PHASE 10: ACTIVITY LOGS
-- ============================================================================

INSERT OR IGNORE INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, entity_name, created_at) VALUES
('al-001', 'org-dbr77-test', 'user-dbr77-admin', 'created', 'project', 'proj-dt-2026', 'Digital Transformation 2026', datetime('now', '-90 days')),
('al-002', 'org-dbr77-test', 'user-michal-zielinski', 'created', 'initiative', 'init-mes-implementation', 'MES System Implementation', datetime('now', '-60 days')),
('al-003', 'org-dbr77-test', 'user-pawel-wojcik', 'updated', 'initiative', 'init-5s-implementation', '5S Workplace Organization', datetime('now', '-45 days')),
('al-004', 'org-dbr77-test', 'user-jan-nowak', 'completed', 'task', 'task-015', 'Install Power BI Gateway', datetime('now', '-7 days')),
('al-005', 'org-dbr77-test', 'user-dbr77-admin', 'decided', 'decision', 'dec-009', 'BI Platform Selection', datetime('now', '-10 days')),
('al-006', 'org-dbr77-test', 'user-tomasz-lewandowski', 'created', 'assessment', 'rla-002', 'Rapid Lean Assessment', datetime('now', '-10 days')),
('al-007', 'org-dbr77-test', 'user-agnieszka-szymanska', 'completed', 'assessment', 'adkar-001', 'ADKAR Assessment', datetime('now', '-20 days')),
('al-008', 'org-dbr77-test', 'user-maria-wisniewska', 'created', 'task', 'task-007', 'Document CRM requirements', datetime('now', '-10 days')),
('al-009', 'org-dbr77-test', 'user-katarzyna-dabrowska', 'started', 'initiative', 'init-carbon-tracking', 'Carbon Footprint Tracking', datetime('now', '-10 days')),
('al-010', 'org-dbr77-test', 'user-michal-zielinski', 'escalated', 'decision', 'dec-013', 'SAP License Negotiation', datetime('now', '-2 days'));

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Users: 8 new team members
-- Teams: 4 teams with members
-- Projects: 7 active projects
-- Initiatives: 17 initiatives across projects
-- Tasks: 15 tasks (various statuses)
-- Decisions: 16 decisions (pending, made, escalated, expired, cancelled)
-- Tool Sessions: 31 discovery items (Strategy: 10, Operations: 10, Digital: 10, Process Auto: 1)
-- Assessments: 5 assessments + maturity + lean + ADKAR
-- Notifications: 25 notifications
-- Reports: 5 reports
-- Activity Logs: 10 entries
-- ============================================================================

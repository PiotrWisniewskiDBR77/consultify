-- Create project for DBR77 System organization
INSERT OR REPLACE INTO projects (id, name, organization_id, status, owner_id, created_at, updated_at)
VALUES ('project-dbr77-001', 'Digital Transformation 2025', 'org-dbr77-system', 'active', 'admin-001', datetime('now'), datetime('now'));

-- Assign admin user to project as owner
INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, joined_at)
VALUES ('pm-001', 'project-dbr77-001', 'admin-001', 'OWNER', datetime('now'));

-- Verify
SELECT 'Projects created:' as message;
SELECT id, name, organization_id FROM projects WHERE organization_id = 'org-dbr77-system';

SELECT 'Project members:' as message;
SELECT pm.id, pm.project_id, pm.user_id, pm.role, p.name as project_name 
FROM project_members pm 
JOIN projects p ON pm.project_id = p.id 
WHERE pm.user_id = 'admin-001';

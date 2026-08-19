-- Align the database-backed permission authority with the canonical execution
-- role matrix. The manager-lane router requires `manage_workstreams`; without
-- these rows a freshly migrated tenant denies ADMIN and PROJECT_MANAGER even
-- though both roles are explicitly authorized by PermissionService.

INSERT INTO builtin_role_permissions (id, role, permission_key, description)
VALUES
    ('brp-exec-mw-superadmin-v1', 'SUPERADMIN', 'manage_workstreams', 'Manage execution workstreams'),
    ('brp-exec-mw-owner-v1', 'OWNER', 'manage_workstreams', 'Manage execution workstreams'),
    ('brp-exec-mw-admin-v1', 'ADMIN', 'manage_workstreams', 'Manage execution workstreams'),
    ('brp-exec-mw-project-manager-v1', 'PROJECT_MANAGER', 'manage_workstreams', 'Manage execution workstreams')
ON CONFLICT (role, permission_key) DO NOTHING;


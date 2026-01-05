import { v4 as uuid } from 'uuid';

/**
 * Dependency injection container
 */
const deps = {
  _db: null,

  get db() { return this._db; },
  set db(val) { this._db = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
  if (!deps._db) {
    const { default: dbInstance } = await import('../src/database/Database.ts');
    deps._db = dbInstance;
  }
}

/**
 * PMO Role Levels
 */
export const PMO_ROLE_LEVELS = {
  EXECUTIVE: 0,
  MANAGER: 1,
  LEAD: 2,
  MEMBER: 3,
  STAKEHOLDER: 4
};

class PMORoleService {
  constructor() {
    this._db = null;
    this.PMO_ROLE_LEVELS = PMO_ROLE_LEVELS;
  }

  get db() {
    if (!this._db) {
      throw new Error('PMORoleService: Database not initialized. Call init() first.');
    }
    return this._db;
  }

  /**
   * Initialize service dependencies
   */
  async init() {
    await initDeps();
    this._db = deps.db;
    return this;
  }

  /**
   * Set dependencies manually (for testing)
   */
  setDependencies(customDeps) {
    if (customDeps.db) {
      this._db = customDeps.db;
      deps.db = customDeps.db;
    }
  }

  /**
   * Get all PMO role definitions
   */
  async getAllRoles(options = {}) {
    await this.init();
    let query = 'SELECT * FROM pmo_role_definitions WHERE 1=1';
    const params = [];

    if (options.level !== undefined) {
      query += ' AND level = ?';
      params.push(options.level);
    }

    if (options.includeCustom === false) {
      query += ' AND is_system = 1';
    }

    query += ' ORDER BY level, name';

    const rows = await this.db.allAsync(query, params);
    return rows.map(row => this._formatRole(row));
  }

  /**
   * Get a single role by ID or code
   */
  async getRole(identifier) {
    await this.init();
    const row = await this.db.getAsync(
      'SELECT * FROM pmo_role_definitions WHERE id = ? OR code = ?',
      [identifier, identifier]
    );

    if (!row) return null;

    const capabilities = await this.db.allAsync(
      `SELECT c.*, prc.scope
       FROM pmo_role_capabilities prc
       JOIN capabilities c ON c.id = prc.capability_id
       WHERE prc.pmo_role_id = ?`,
      [row.id]
    );

    return {
      ...this._formatRole(row),
      capabilities: capabilities.map(cap => ({
        id: cap.id,
        code: cap.code,
        name: cap.name,
        namePl: cap.name_pl,
        category: cap.category,
        scope: cap.scope
      }))
    };
  }

  /**
   * Get roles grouped by level
   */
  async getRolesByLevel() {
    const roles = await this.getAllRoles();

    return {
      executive: roles.filter(r => r.level === PMO_ROLE_LEVELS.EXECUTIVE),
      manager: roles.filter(r => r.level === PMO_ROLE_LEVELS.MANAGER),
      lead: roles.filter(r => r.level === PMO_ROLE_LEVELS.LEAD),
      member: roles.filter(r => r.level === PMO_ROLE_LEVELS.MEMBER),
      stakeholder: roles.filter(r => r.level === PMO_ROLE_LEVELS.STAKEHOLDER)
    };
  }

  /**
   * Assign user to project with PMO role
   */
  async assignProjectRole(userId, projectId, pmoRoleId, options = {}) {
    await this.init();
    const {
      allocationPercent = 100,
      startDate = null,
      endDate = null,
      responsibilities = [],
      notes = null,
      addedBy = null
    } = options;

    const project = await this.db.getAsync('SELECT id, name, organization_id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      throw new Error('Project not found');
    }

    const user = await this.db.getAsync('SELECT id, first_name, last_name, organization_id FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new Error('User not found');
    }

    const pmoRole = await this.db.getAsync('SELECT * FROM pmo_role_definitions WHERE id = ?', [pmoRoleId]);
    if (!pmoRole) {
      throw new Error('PMO role not found');
    }

    const existing = await this.db.getAsync(
      'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    const now = new Date().toISOString();
    const id = uuid();

    if (existing) {
      await this.db.runAsync(
        `UPDATE project_members SET
          pmo_role_id = ?,
          allocation_percent = ?,
          start_date = ?,
          end_date = ?,
          responsibilities = ?,
          notes = ?,
          updated_at = ?
         WHERE project_id = ? AND user_id = ?`,
        [
          pmoRoleId,
          allocationPercent,
          startDate,
          endDate,
          JSON.stringify(responsibilities),
          notes,
          now,
          projectId,
          userId
        ]
      );
    } else {
      await this.db.runAsync(
        `INSERT INTO project_members
         (id, project_id, user_id, pmo_role_id, project_role, allocation_percent,
          start_date, end_date, responsibilities, notes, created_at, updated_at, added_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          projectId,
          userId,
          pmoRoleId,
          pmoRole.code,
          allocationPercent,
          startDate,
          endDate,
          JSON.stringify(responsibilities),
          notes,
          now,
          now,
          addedBy
        ]
      );
    }

    await this._logAssignment(project.organization_id, 'PROJECT_ROLE_ASSIGNED', {
      userId,
      userName: `${user.first_name} ${user.last_name}`,
      projectId,
      projectName: project.name,
      pmoRoleId,
      pmoRoleName: pmoRole.name,
      allocationPercent,
      addedBy
    });

    return this.getProjectMember(projectId, userId);
  }

  /**
   * Remove user from project
   */
  async removeFromProject(userId, projectId, removedBy = null) {
    await this.init();
    const project = await this.db.getAsync('SELECT organization_id, name FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      throw new Error('Project not found');
    }

    const member = await this.db.getAsync(
      `SELECT pm.*, u.first_name, u.last_name, prd.name as role_name
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       LEFT JOIN pmo_role_definitions prd ON prd.id = pm.pmo_role_id
       WHERE pm.project_id = ? AND pm.user_id = ?`,
      [projectId, userId]
    );

    if (!member) {
      throw new Error('User is not a member of this project');
    }

    await this.db.runAsync(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    await this._logAssignment(project.organization_id, 'PROJECT_ROLE_REMOVED', {
      userId,
      userName: `${member.first_name} ${member.last_name}`,
      projectId,
      projectName: project.name,
      previousRole: member.role_name,
      removedBy
    });

    return true;
  }

  /**
   * Get project member details
   */
  async getProjectMember(projectId, userId) {
    await this.init();
    const row = await this.db.getAsync(
      `SELECT pm.*, 
              u.first_name, u.last_name, u.email, u.avatar, u.role as user_role,
              p.name as project_name,
              prd.id as pmo_role_id, prd.code as pmo_role_code, prd.name as pmo_role_name,
              prd.name_pl as pmo_role_name_pl, prd.level as pmo_role_level,
              prd.prince2_role, prd.pmbok_role, prd.description as role_description
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       JOIN projects p ON p.id = pm.project_id
       LEFT JOIN pmo_role_definitions prd ON prd.id = pm.pmo_role_id
       WHERE pm.project_id = ? AND pm.user_id = ?`,
      [projectId, userId]
    );

    if (!row) return null;

    return this._formatProjectMember(row);
  }

  /**
   * Get project team
   */
  async getProjectTeam(projectId, options = {}) {
    await this.init();
    let query = `
      SELECT pm.*, 
             u.first_name, u.last_name, u.email, u.avatar, u.role as user_role,
             p.name as project_name,
             prd.id as pmo_role_id, prd.code as pmo_role_code, prd.name as pmo_role_name,
             prd.name_pl as pmo_role_name_pl, prd.level as pmo_role_level,
             prd.prince2_role, prd.pmbok_role
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      JOIN projects p ON p.id = pm.project_id
      LEFT JOIN pmo_role_definitions prd ON prd.id = pm.pmo_role_id
      WHERE pm.project_id = ?
    `;
    const params = [projectId];

    if (options.level !== undefined) {
      query += ' AND prd.level = ?';
      params.push(options.level);
    }

    query += ' ORDER BY prd.level, u.last_name, u.first_name';

    const rows = await this.db.allAsync(query, params);
    return rows.map(row => this._formatProjectMember(row));
  }

  /**
   * Get project team grouped by role level
   */
  async getProjectTeamByLevel(projectId) {
    const team = await this.getProjectTeam(projectId);

    return {
      executive: team.filter(m => m.pmoRole?.level === PMO_ROLE_LEVELS.EXECUTIVE),
      manager: team.filter(m => m.pmoRole?.level === PMO_ROLE_LEVELS.MANAGER),
      lead: team.filter(m => m.pmoRole?.level === PMO_ROLE_LEVELS.LEAD),
      member: team.filter(m => m.pmoRole?.level === PMO_ROLE_LEVELS.MEMBER),
      stakeholder: team.filter(m => m.pmoRole?.level === PMO_ROLE_LEVELS.STAKEHOLDER),
      unassigned: team.filter(m => !m.pmoRole)
    };
  }

  /**
   * Get all project assignments for a user
   */
  async getUserProjectRoles(userId) {
    await this.init();
    const rows = await this.db.allAsync(
      `SELECT pm.*, 
              p.id as project_id, p.name as project_name, p.status as project_status,
              prd.code as pmo_role_code, prd.name as pmo_role_name, 
              prd.level as pmo_role_level
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       LEFT JOIN pmo_role_definitions prd ON prd.id = pm.pmo_role_id
       WHERE pm.user_id = ?
       ORDER BY p.name`,
      [userId]
    );

    return rows.map(row => ({
      projectId: row.project_id,
      projectName: row.project_name,
      projectStatus: row.project_status,
      pmoRole: row.pmo_role_id ? {
        id: row.pmo_role_id,
        code: row.pmo_role_code,
        name: row.pmo_role_name,
        level: row.pmo_role_level
      } : null,
      allocationPercent: row.allocation_percent,
      startDate: row.start_date,
      endDate: row.end_date,
      responsibilities: this._parseJSON(row.responsibilities, [])
    }));
  }

  /**
   * Get capabilities for a PMO role
   */
  async getRoleCapabilities(roleId) {
    await this.init();
    const caps = await this.db.allAsync(
      `SELECT c.*, prc.scope
       FROM pmo_role_capabilities prc
       JOIN capabilities c ON c.id = prc.capability_id
       WHERE prc.pmo_role_id = ?
       ORDER BY c.category, c.name`,
      [roleId]
    );

    return caps.map(cap => ({
      id: cap.id,
      code: cap.code,
      name: cap.name,
      namePl: cap.name_pl,
      category: cap.category,
      description: cap.description,
      scope: cap.scope
    }));
  }

  /**
   * Create a custom PMO role
   */
  async createCustomRole(roleData) {
    await this.init();
    const {
      code,
      name,
      namePl,
      level = PMO_ROLE_LEVELS.MEMBER,
      description,
      descriptionPl,
      reportsToCode = null
    } = roleData;

    if (!code || !name) {
      throw new Error('Role code and name are required');
    }

    const existing = await this.db.getAsync(
      'SELECT id FROM pmo_role_definitions WHERE code = ?',
      [code]
    );
    if (existing) {
      throw new Error(`Role with code ${code} already exists`);
    }

    const id = `pmo-role-custom-${uuid()}`;
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO pmo_role_definitions
       (id, code, name, name_pl, level, description, description_pl, 
        reports_to_code, is_system, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, code, name, namePl, level, description, descriptionPl, reportsToCode, now]
    );

    return this.getRole(id);
  }

  /**
   * Update user's allocation percentage
   */
  async updateAllocation(userId, projectId, allocationPercent) {
    await this.init();
    if (allocationPercent < 0 || allocationPercent > 100) {
      throw new Error('Allocation must be between 0 and 100');
    }

    await this.db.runAsync(
      `UPDATE project_members SET allocation_percent = ?, updated_at = ?
       WHERE project_id = ? AND user_id = ?`,
      [allocationPercent, new Date().toISOString(), projectId, userId]
    );

    return this.getProjectMember(projectId, userId);
  }

  /**
   * Get project team statistics
   */
  async getProjectTeamStats(projectId) {
    await this.init();
    const stats = await this.db.getAsync(
      `SELECT 
         COUNT(DISTINCT pm.user_id) as total_members,
         SUM(pm.allocation_percent) as total_allocation,
         AVG(pm.allocation_percent) as avg_allocation,
         COUNT(CASE WHEN prd.level = 0 THEN 1 END) as executive_count,
         COUNT(CASE WHEN prd.level = 1 THEN 1 END) as manager_count,
         COUNT(CASE WHEN prd.level = 2 THEN 1 END) as lead_count,
         COUNT(CASE WHEN prd.level = 3 THEN 1 END) as member_count,
         COUNT(CASE WHEN prd.level = 4 THEN 1 END) as stakeholder_count,
         COUNT(CASE WHEN prd.is_required = 1 AND pm.user_id IS NOT NULL THEN 1 END) as filled_required_roles
       FROM project_members pm
       LEFT JOIN pmo_role_definitions prd ON prd.id = pm.pmo_role_id
       WHERE pm.project_id = ?`,
      [projectId]
    );

    const requiredRoles = await this.db.allAsync(
      `SELECT * FROM pmo_role_definitions WHERE is_required = 1`,
      []
    );

    const filledRoles = await this.db.allAsync(
      `SELECT DISTINCT prd.code
       FROM project_members pm
       JOIN pmo_role_definitions prd ON prd.id = pm.pmo_role_id
       WHERE pm.project_id = ? AND prd.is_required = 1`,
      [projectId]
    );

    const filledRoleCodes = new Set(filledRoles.map(r => r.code));
    const missingRequiredRoles = requiredRoles
      .filter(r => !filledRoleCodes.has(r.code))
      .map(r => ({ code: r.code, name: r.name }));

    return {
      projectId,
      totalMembers: stats?.total_members || 0,
      totalAllocation: stats?.total_allocation || 0,
      averageAllocation: Math.round(stats?.avg_allocation || 0),
      byLevel: {
        executive: stats?.executive_count || 0,
        manager: stats?.manager_count || 0,
        lead: stats?.lead_count || 0,
        member: stats?.member_count || 0,
        stakeholder: stats?.stakeholder_count || 0
      },
      requiredRoles: {
        total: requiredRoles.length,
        filled: filledRoles.length,
        missing: missingRequiredRoles
      }
    };
  }

  _formatRole(row) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      namePl: row.name_pl,
      level: row.level,
      levelName: Object.keys(PMO_ROLE_LEVELS).find(k => PMO_ROLE_LEVELS[k] === row.level),
      standards: {
        prince2: row.prince2_role,
        pmbok: row.pmbok_role,
        iso21500: row.iso21500_reference
      },
      reportsTo: row.reports_to_code,
      isRequired: Boolean(row.is_required),
      maxPerProject: row.max_per_project,
      canBeExternal: Boolean(row.can_be_external),
      description: row.description,
      descriptionPl: row.description_pl,
      isSystem: Boolean(row.is_system),
      defaultCapabilities: this._parseJSON(row.default_capabilities, [])
    };
  }

  _formatProjectMember(row) {
    return {
      userId: row.user_id,
      userName: `${row.first_name} ${row.last_name}`,
      userEmail: row.email,
      userAvatar: row.avatar,
      userRole: row.user_role,
      projectId: row.project_id,
      projectName: row.project_name,
      pmoRole: row.pmo_role_id ? {
        id: row.pmo_role_id,
        code: row.pmo_role_code,
        name: row.pmo_role_name,
        namePl: row.pmo_role_name_pl,
        level: row.pmo_role_level,
        prince2Role: row.prince2_role,
        pmbokRole: row.pmbok_role,
        description: row.role_description
      } : null,
      legacyRole: row.project_role,
      workstreamId: row.workstream_id,
      allocationPercent: row.allocation_percent,
      startDate: row.start_date,
      endDate: row.end_date,
      responsibilities: this._parseJSON(row.responsibilities, []),
      notes: row.notes,
      permissions: this._parseJSON(row.permissions, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  _parseJSON(str, defaultValue) {
    try {
      return str ? JSON.parse(str) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async _logAssignment(orgId, eventType, metadata) {
    try {
      await this.init();
      await this.db.runAsync(
        `INSERT INTO audit_events 
         (id, organization_id, event_type, entity_type, entity_id, action, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          orgId,
          'PROJECT_TEAM',
          'project_members',
          metadata.projectId,
          eventType,
          JSON.stringify(metadata),
          new Date().toISOString()
        ]
      );
    } catch (err) {
      console.error('[PMORoleService] Audit log failed:', err.message);
    }
  }
}

const pmoRoleServiceInstance = new PMORoleService();
export default pmoRoleServiceInstance;

















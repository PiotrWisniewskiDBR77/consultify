import { v4 as uuid } from 'uuid';

/**
 * Dependency injection container
 */
const deps = {
  _db: null,
  _pmoDomainRegistry: null,
  _pmoStandardsMapping: null,

  get db() { return this._db; },
  set db(val) { this._db = val; },

  get pmoDomainRegistry() { return this._pmoDomainRegistry; },
  set pmoDomainRegistry(val) { this._pmoDomainRegistry = val; },

  get pmoStandardsMapping() { return this._pmoStandardsMapping; },
  set pmoStandardsMapping(val) { this._pmoStandardsMapping = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
  if (!deps._db) {
    const { default: dbInstance } = await import('../database.js');
    deps._db = dbInstance;
  }
  if (!deps._pmoDomainRegistry) {
    const pmoDomainRegistry = await import('./pmoDomainRegistry.js');
    deps._pmoDomainRegistry = pmoDomainRegistry.default || pmoDomainRegistry;
  }
  if (!deps._pmoStandardsMapping) {
    const { default: pmoStandardsMapping } = await import('./pmoStandardsMapping.js');
    deps._pmoStandardsMapping = pmoStandardsMapping;
  }
}

/**
 * Project Role Enum - aligned with types.ts PMOProjectRole
 */
const PROJECT_ROLES = {
  SPONSOR: 'SPONSOR',
  DECISION_OWNER: 'DECISION_OWNER',
  PMO_LEAD: 'PMO_LEAD',
  WORKSTREAM_OWNER: 'WORKSTREAM_OWNER',
  INITIATIVE_OWNER: 'INITIATIVE_OWNER',
  TASK_ASSIGNEE: 'TASK_ASSIGNEE',
  SME: 'SME',
  REVIEWER: 'REVIEWER',
  OBSERVER: 'OBSERVER',
  CONSULTANT: 'CONSULTANT',
  STAKEHOLDER: 'STAKEHOLDER'
};

/**
 * Default permissions by role
 */
const DEFAULT_PERMISSIONS = {
  [PROJECT_ROLES.SPONSOR]: {
    canViewProject: true, canViewTasks: true, canViewInitiatives: true, canViewDecisions: true, canViewFinancials: true,
    canCreateTasks: false, canAssignTasks: false, canUpdateTasks: false, canDeleteTasks: false,
    canCreateInitiatives: false, canUpdateInitiatives: false, canDeleteInitiatives: false,
    canRequestDecisions: false, canApproveDecisions: true,
    canSubmitChangeRequests: false, canApproveChangeRequests: true,
    canManageTeam: true, canManageWorkstreams: false, canConfigureProject: true,
    canEscalate: false, canReceiveEscalations: true
  },
  [PROJECT_ROLES.DECISION_OWNER]: {
    canViewProject: true, canViewTasks: true, canViewInitiatives: true, canViewDecisions: true, canViewFinancials: true,
    canCreateTasks: false, canAssignTasks: false, canUpdateTasks: false, canDeleteTasks: false,
    canCreateInitiatives: false, canUpdateInitiatives: false, canDeleteInitiatives: false,
    canRequestDecisions: false, canApproveDecisions: true,
    canSubmitChangeRequests: false, canApproveChangeRequests: true,
    canManageTeam: false, canManageWorkstreams: false, canConfigureProject: false,
    canEscalate: false, canReceiveEscalations: true
  },
  [PROJECT_ROLES.PMO_LEAD]: {
    canViewProject: true, canViewTasks: true, canViewInitiatives: true, canViewDecisions: true, canViewFinancials: true,
    canCreateTasks: true, canAssignTasks: true, canUpdateTasks: true, canDeleteTasks: true,
    canCreateInitiatives: true, canUpdateInitiatives: true, canDeleteInitiatives: true,
    canRequestDecisions: true, canApproveDecisions: false,
    canSubmitChangeRequests: true, canApproveChangeRequests: false,
    canManageTeam: true, canManageWorkstreams: true, canConfigureProject: true,
    canEscalate: true, canReceiveEscalations: true
  },
  [PROJECT_ROLES.WORKSTREAM_OWNER]: {
    canViewProject: true, canViewTasks: true, canViewInitiatives: true, canViewDecisions: true, canViewFinancials: false,
    canCreateTasks: true, canAssignTasks: true, canUpdateTasks: true, canDeleteTasks: false,
    canCreateInitiatives: true, canUpdateInitiatives: true, canDeleteInitiatives: false,
    canRequestDecisions: true, canApproveDecisions: false,
    canSubmitChangeRequests: true, canApproveChangeRequests: false,
    canManageTeam: false, canManageWorkstreams: false, canConfigureProject: false,
    canEscalate: true, canReceiveEscalations: true
  },
  [PROJECT_ROLES.INITIATIVE_OWNER]: {
    canViewProject: true, canViewTasks: true, canViewInitiatives: true, canViewDecisions: true, canViewFinancials: false,
    canCreateTasks: true, canAssignTasks: true, canUpdateTasks: true, canDeleteTasks: false,
    canCreateInitiatives: false, canUpdateInitiatives: true, canDeleteInitiatives: false,
    canRequestDecisions: true, canApproveDecisions: false,
    canSubmitChangeRequests: true, canApproveChangeRequests: false,
    canManageTeam: false, canManageWorkstreams: false, canConfigureProject: false,
    canEscalate: true, canReceiveEscalations: true
  },
  [PROJECT_ROLES.TASK_ASSIGNEE]: {
    canViewProject: true, canViewTasks: true, canViewInitiatives: true, canViewDecisions: false, canViewFinancials: false,
    canCreateTasks: false, canAssignTasks: false, canUpdateTasks: true, canDeleteTasks: false,
    canCreateInitiatives: false, canUpdateInitiatives: false, canDeleteInitiatives: false,
    canRequestDecisions: false, canApproveDecisions: false,
    canSubmitChangeRequests: false, canApproveChangeRequests: false,
    canManageTeam: false, canManageWorkstreams: false, canConfigureProject: false,
    canEscalate: true, canReceiveEscalations: false
  },
  [PROJECT_ROLES.SME]: {
    canViewProject: true, canViewTasks: true, canViewInitiatives: true, canViewDecisions: true, canViewFinancials: false,
    canCreateTasks: false, canAssignTasks: false, canUpdateTasks: false, canDeleteTasks: false,
    canCreateInitiatives: false, canUpdateInitiatives: false, canDeleteInitiatives: false,
    canRequestDecisions: false, canApproveDecisions: false,
    canSubmitChangeRequests: false, canApproveChangeRequests: false,
    canManageTeam: false, canManageWorkstreams: false, canConfigureProject: false,
    canEscalate: false, canReceiveEscalations: false
  },
  [PROJECT_ROLES.REVIEWER]: {
    canViewProject: true, canViewTasks: true, canViewInitiatives: true, canViewDecisions: true, canViewFinancials: false,
    canCreateTasks: false, canAssignTasks: false, canUpdateTasks: false, canDeleteTasks: false,
    canCreateInitiatives: false, canUpdateInitiatives: false, canDeleteInitiatives: false,
    canRequestDecisions: false, canApproveDecisions: false,
    canSubmitChangeRequests: false, canApproveChangeRequests: false,
    canManageTeam: false, canManageWorkstreams: false, canConfigureProject: false,
    canEscalate: false, canReceiveEscalations: false
  },
  [PROJECT_ROLES.OBSERVER]: {
    canViewProject: true, canViewTasks: true, canViewInitiatives: true, canViewDecisions: false, canViewFinancials: false,
    canCreateTasks: false, canAssignTasks: false, canUpdateTasks: false, canDeleteTasks: false,
    canCreateInitiatives: false, canUpdateInitiatives: false, canDeleteInitiatives: false,
    canRequestDecisions: false, canApproveDecisions: false,
    canSubmitChangeRequests: false, canApproveChangeRequests: false,
    canManageTeam: false, canManageWorkstreams: false, canConfigureProject: false,
    canEscalate: false, canReceiveEscalations: false
  },
  [PROJECT_ROLES.CONSULTANT]: {
    canViewProject: true, canViewTasks: true, canViewInitiatives: true, canViewDecisions: true, canViewFinancials: false,
    canCreateTasks: false, canAssignTasks: false, canUpdateTasks: false, canDeleteTasks: false,
    canCreateInitiatives: false, canUpdateInitiatives: false, canDeleteInitiatives: false,
    canRequestDecisions: false, canApproveDecisions: false,
    canSubmitChangeRequests: false, canApproveChangeRequests: false,
    canManageTeam: false, canManageWorkstreams: false, canConfigureProject: false,
    canEscalate: false, canReceiveEscalations: false
  },
  [PROJECT_ROLES.STAKEHOLDER]: {
    canViewProject: true, canViewTasks: false, canViewInitiatives: true, canViewDecisions: false, canViewFinancials: false,
    canCreateTasks: false, canAssignTasks: false, canUpdateTasks: false, canDeleteTasks: false,
    canCreateInitiatives: false, canUpdateInitiatives: false, canDeleteInitiatives: false,
    canRequestDecisions: false, canApproveDecisions: false,
    canSubmitChangeRequests: false, canApproveChangeRequests: false,
    canManageTeam: false, canManageWorkstreams: false, canConfigureProject: false,
    canEscalate: false, canReceiveEscalations: false
  }
};

/**
 * RACI matrix by object type and role
 */
const RACI_MATRIX = {
  PROJECT: {
    [PROJECT_ROLES.PMO_LEAD]: 'R',
    [PROJECT_ROLES.SPONSOR]: 'A',
    [PROJECT_ROLES.CONSULTANT]: 'C',
    [PROJECT_ROLES.STAKEHOLDER]: 'I'
  },
  INITIATIVE: {
    [PROJECT_ROLES.INITIATIVE_OWNER]: 'R',
    [PROJECT_ROLES.PMO_LEAD]: 'A',
    [PROJECT_ROLES.SME]: 'C',
    [PROJECT_ROLES.TASK_ASSIGNEE]: 'I'
  },
  TASK: {
    [PROJECT_ROLES.TASK_ASSIGNEE]: 'R',
    [PROJECT_ROLES.INITIATIVE_OWNER]: 'A',
    [PROJECT_ROLES.SME]: 'C',
    [PROJECT_ROLES.PMO_LEAD]: 'I'
  },
  DECISION: {
    [PROJECT_ROLES.DECISION_OWNER]: 'R',
    [PROJECT_ROLES.SPONSOR]: 'A',
    [PROJECT_ROLES.PMO_LEAD]: 'C',
    [PROJECT_ROLES.STAKEHOLDER]: 'I'
  },
  CHANGE_REQUEST: {
    [PROJECT_ROLES.PMO_LEAD]: 'R',
    [PROJECT_ROLES.SPONSOR]: 'A',
    [PROJECT_ROLES.DECISION_OWNER]: 'C',
    [PROJECT_ROLES.STAKEHOLDER]: 'I'
  },
  ASSESSMENT: {
    [PROJECT_ROLES.PMO_LEAD]: 'R',
    [PROJECT_ROLES.PMO_LEAD]: 'A',
    [PROJECT_ROLES.REVIEWER]: 'C',
    [PROJECT_ROLES.SPONSOR]: 'I'
  },
  ROADMAP: {
    [PROJECT_ROLES.PMO_LEAD]: 'R',
    [PROJECT_ROLES.SPONSOR]: 'A',
    [PROJECT_ROLES.INITIATIVE_OWNER]: 'C',
    [PROJECT_ROLES.STAKEHOLDER]: 'I'
  },
  STAGE_GATE: {
    [PROJECT_ROLES.PMO_LEAD]: 'R',
    [PROJECT_ROLES.SPONSOR]: 'A',
    [PROJECT_ROLES.DECISION_OWNER]: 'C',
    [PROJECT_ROLES.STAKEHOLDER]: 'I'
  }
};

class ProjectMemberService {
  constructor() {
    this._db = null;
    this.PROJECT_ROLES = PROJECT_ROLES;
    this.DEFAULT_PERMISSIONS = DEFAULT_PERMISSIONS;
    this.RACI_MATRIX = RACI_MATRIX;
  }

  get db() {
    if (!this._db) {
      throw new Error('ProjectMemberService: Database not initialized. Call init() first.');
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
    if (customDeps.pmoDomainRegistry) deps.pmoDomainRegistry = customDeps.pmoDomainRegistry;
    if (customDeps.pmoStandardsMapping) deps.pmoStandardsMapping = customDeps.pmoStandardsMapping;
  }

  /**
   * Add a member to a project
   */
  async addMember(projectId, userId, projectRole, options = {}) {
    await this.init();
    const {
      addedById,
      workstreamId,
      allocationPercent = 100,
      customPermissions,
      startDate,
      endDate
    } = options;

    if (!PROJECT_ROLES[projectRole]) {
      throw new Error(`Invalid project role: ${projectRole}`);
    }

    const existing = await this.db.getAsync(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );
    if (existing) {
      throw new Error('User is already a member of this project');
    }

    const permissions = {
      ...DEFAULT_PERMISSIONS[projectRole],
      ...(customPermissions || {})
    };

    const id = uuid();
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO project_members 
       (id, project_id, user_id, project_role, workstream_id, allocation_percent, 
        permissions, start_date, end_date, created_at, updated_at, added_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        userId,
        projectRole,
        workstreamId || null,
        allocationPercent,
        JSON.stringify(permissions),
        startDate || null,
        endDate || null,
        now,
        now,
        addedById || null
      ]
    );

    await this._logAudit(projectId, 'MEMBER_ADDED', {
      memberId: id,
      userId,
      projectRole,
      addedById
    });

    return this.getMember(projectId, userId);
  }

  /**
   * Update a member's role or permissions
   */
  async updateMember(projectId, userId, updates) {
    await this.init();
    const existing = await this.db.getAsync(
      'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );
    if (!existing) {
      throw new Error('Member not found in project');
    }

    const allowedFields = ['project_role', 'workstream_id', 'allocation_percent', 'permissions', 'start_date', 'end_date', 'projectRole', 'workstreamId', 'allocationPercent', 'startDate', 'endDate'];
    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        values.push(dbKey === 'permissions' ? JSON.stringify(value) : value);
      }
    }

    if (setClauses.length === 0) {
      return this.getMember(projectId, userId);
    }

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(projectId, userId);

    await this.db.runAsync(
      `UPDATE project_members SET ${setClauses.join(', ')} WHERE project_id = ? AND user_id = ?`,
      values
    );

    if (updates.projectRole && updates.projectRole !== existing.project_role) {
      const newPermissions = DEFAULT_PERMISSIONS[updates.projectRole];
      await this.db.runAsync(
        'UPDATE project_members SET permissions = ? WHERE project_id = ? AND user_id = ?',
        [JSON.stringify(newPermissions), projectId, userId]
      );

      await this._logAudit(projectId, 'MEMBER_ROLE_CHANGED', {
        userId,
        oldRole: existing.project_role,
        newRole: updates.projectRole
      });
    }

    return this.getMember(projectId, userId);
  }

  /**
   * Remove a member from a project
   */
  async removeMember(projectId, userId) {
    await this.init();
    const existing = await this.db.getAsync(
      'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );
    if (!existing) {
      throw new Error('Member not found in project');
    }

    await this.db.runAsync(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    await this._logAudit(projectId, 'MEMBER_REMOVED', {
      userId,
      previousRole: existing.project_role
    });

    return true;
  }

  /**
   * Get a single member
   */
  async getMember(projectId, userId) {
    await this.init();
    const member = await this.db.getAsync(
      `SELECT pm.*, u.first_name, u.last_name, u.email, u.avatar_url
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ? AND pm.user_id = ?`,
      [projectId, userId]
    );

    if (!member) return null;
    return this._formatMember(member);
  }

  /**
   * Get all members of a project
   */
  async getProjectTeam(projectId, options = {}) {
    await this.init();
    let query = `
      SELECT pm.*, u.first_name, u.last_name, u.email, u.avatar_url
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
    `;
    const params = [projectId];

    if (options.role) {
      query += ' AND pm.project_role = ?';
      params.push(options.role);
    }

    if (options.workstreamId) {
      query += ' AND pm.workstream_id = ?';
      params.push(options.workstreamId);
    }

    query += ' ORDER BY pm.project_role, u.last_name, u.first_name';

    const members = await this.db.allAsync(query, params);
    return members.map(m => this._formatMember(m));
  }

  /**
   * Check if a user has a specific permission on a project
   */
  async checkPermission(projectId, userId, permission) {
    const member = await this.getMember(projectId, userId);
    if (!member) return false;
    return member.permissions[permission] === true;
  }

  /**
   * Get the RACI matrix for a project
   */
  async getRACIMatrix(projectId) {
    const members = await this.getProjectTeam(projectId);
    const matrix = {};

    for (const objectType of Object.keys(RACI_MATRIX)) {
      matrix[objectType] = {};

      for (const member of members) {
        const raciType = RACI_MATRIX[objectType][member.projectRole];
        if (raciType) {
          if (!matrix[objectType][raciType]) {
            matrix[objectType][raciType] = [];
          }
          matrix[objectType][raciType].push({
            userId: member.userId,
            name: `${member.firstName} ${member.lastName}`,
            role: member.projectRole
          });
        }
      }
    }

    return {
      projectId,
      matrix,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get members who can receive escalations
   */
  async getEscalationRecipients(projectId, escalationLevel) {
    await this.init();
    const rolesByLevel = {
      1: [PROJECT_ROLES.INITIATIVE_OWNER, PROJECT_ROLES.WORKSTREAM_OWNER],
      2: [PROJECT_ROLES.PMO_LEAD],
      3: [PROJECT_ROLES.SPONSOR, PROJECT_ROLES.DECISION_OWNER]
    };

    const roles = rolesByLevel[escalationLevel] || rolesByLevel[3];

    const members = await this.db.allAsync(
      `SELECT pm.*, u.first_name, u.last_name, u.email
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ? AND pm.project_role IN (${roles.map(() => '?').join(',')})`,
      [projectId, ...roles]
    );

    return members.map(m => this._formatMember(m));
  }

  /**
   * Get available assignees for a task
   */
  async getAvailableAssignees(projectId, options = {}) {
    await this.init();
    let query = `
      SELECT pm.*, u.first_name, u.last_name, u.email, u.avatar_url
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
        AND pm.project_role IN (?, ?, ?, ?)
    `;
    const params = [
      projectId,
      PROJECT_ROLES.TASK_ASSIGNEE,
      PROJECT_ROLES.INITIATIVE_OWNER,
      PROJECT_ROLES.WORKSTREAM_OWNER,
      PROJECT_ROLES.PMO_LEAD
    ];

    if (options.workstreamId) {
      query += ' AND (pm.workstream_id = ? OR pm.workstream_id IS NULL)';
      params.push(options.workstreamId);
    }

    query += ' ORDER BY u.last_name, u.first_name';

    const members = await this.db.allAsync(query, params);
    return members.map(m => this._formatMember(m));
  }

  async getMemberByRole(projectId, role) {
    await this.init();
    const member = await this.db.getAsync(
      `SELECT pm.*, u.first_name, u.last_name, u.email, u.avatar_url
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ? AND pm.project_role = ?
       LIMIT 1`,
      [projectId, role]
    );

    return member ? this._formatMember(member) : null;
  }

  async getUserRole(projectId, userId) {
    await this.init();
    const member = await this.db.getAsync(
      'SELECT project_role FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );
    return member ? member.project_role : null;
  }

  async getUserProjects(userId) {
    await this.init();
    const projects = await this.db.allAsync(
      `SELECT p.id, p.name, p.status, pm.project_role, pm.workstream_id, pm.allocation_percent
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       WHERE pm.user_id = ?
       ORDER BY p.name`,
      [userId]
    );

    return projects.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      projectRole: p.project_role,
      workstreamId: p.workstream_id,
      allocationPercent: p.allocation_percent
    }));
  }

  _formatMember(row) {
    return {
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      projectRole: row.project_role,
      workstreamId: row.workstream_id,
      allocationPercent: row.allocation_percent,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      addedById: row.added_by_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      avatarUrl: row.avatar_url
    };
  }

  async _logAudit(projectId, action, metadata = {}) {
    try {
      await this.init();
      const { PMO_DOMAIN_IDS } = deps.pmoDomainRegistry;
      const mapping = deps.pmoStandardsMapping.getMapping('Escalation');

      await this.db.runAsync(
        `INSERT INTO pmo_audit_trail 
         (id, project_id, pmo_domain_id, pmo_phase, object_type, object_id, action, actor_id,
          iso21500_mapping, pmbok_mapping, prince2_mapping, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          projectId,
          PMO_DOMAIN_IDS.RESOURCE_RESPONSIBILITY,
          null,
          'PROJECT_MEMBER',
          metadata.memberId || metadata.userId,
          action,
          metadata.addedById || null,
          mapping?.iso21500?.term || 'Project Team (4.6.2)',
          mapping?.pmbok7?.term || 'Team Performance Domain',
          mapping?.prince2?.term || 'Organization Theme',
          JSON.stringify(metadata),
          new Date().toISOString()
        ]
      );
    } catch (err) {
      console.error('[ProjectMemberService] Audit log failed:', err.message);
    }
  }
}

const projectMemberServiceInstance = new ProjectMemberService();
export default projectMemberServiceInstance;


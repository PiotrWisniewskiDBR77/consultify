/**
 * Work Mode Service
 * 
 * Manages organization work mode configuration and user capability resolution.
 * 
 * Work Modes:
 * - SIMPLE: Single team, no locations/projects, all users see all tasks
 * - LOCATION_BASED: Multiple locations, users assigned to locations, tasks scoped to locations
 * - PROJECT_BASED: Project-centric, users assigned to projects with PMO roles
 * - FULL: Matrix organization with both locations and projects
 * 
 * Standards:
 * - ISO 21500:2021 - Organization Structure (Clause 4.6)
 * - PMI PMBOK 7th Edition - Team Performance Domain
 * - PRINCE2 - Organization Theme
 * 
 * @module workModeService
 */

const db = require('../database');

/**
 * Work Mode Constants
 */
const WORK_MODES = {
  SIMPLE: 'SIMPLE',
  LOCATION_BASED: 'LOCATION_BASED',
  PROJECT_BASED: 'PROJECT_BASED',
  FULL: 'FULL'
};

/**
 * Work Mode Descriptions
 */
const WORK_MODE_INFO = {
  [WORK_MODES.SIMPLE]: {
    name: 'Simple',
    namePl: 'Prosty',
    description: 'Single team without location or project divisions. All users see all tasks.',
    descriptionPl: 'Jeden zespół bez podziału na lokalizacje czy projekty. Wszyscy użytkownicy widzą wszystkie zadania.',
    hasLocations: false,
    hasProjects: false
  },
  [WORK_MODES.LOCATION_BASED]: {
    name: 'Location-Based',
    namePl: 'Oparty na lokalizacjach',
    description: 'Multiple locations/units. Users are assigned to specific locations and see tasks from their locations.',
    descriptionPl: 'Wiele lokalizacji/jednostek. Użytkownicy przypisani do lokalizacji widzą zadania z tych lokalizacji.',
    hasLocations: true,
    hasProjects: false
  },
  [WORK_MODES.PROJECT_BASED]: {
    name: 'Project-Based',
    namePl: 'Oparty na projektach',
    description: 'Project-centric work. Users assigned to projects with PMO roles. Tasks belong to projects.',
    descriptionPl: 'Praca projektowa. Użytkownicy przypisani do projektów z rolami PMO. Zadania należą do projektów.',
    hasLocations: false,
    hasProjects: true
  },
  [WORK_MODES.FULL]: {
    name: 'Full Matrix',
    namePl: 'Pełna matryca',
    description: 'Full matrix organization with both locations and projects. Users can be assigned to both.',
    descriptionPl: 'Pełna organizacja macierzowa z lokalizacjami i projektami. Użytkownicy mogą być przypisani do obu.',
    hasLocations: true,
    hasProjects: true
  }
};

/**
 * Work Mode Service
 */
const WorkModeService = {
  WORK_MODES,
  WORK_MODE_INFO,

  /**
   * Get organization work mode configuration
   * 
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Work mode configuration
   */
  async getWorkMode(orgId) {
    const org = await db.getAsync(
      `SELECT id, name, work_mode, has_projects, has_locations, 
              project_label, location_label, team_label
       FROM organizations WHERE id = ?`,
      [orgId]
    );

    if (!org) {
      throw new Error('Organization not found');
    }

    const workMode = org.work_mode || WORK_MODES.SIMPLE;
    const modeInfo = WORK_MODE_INFO[workMode];

    return {
      organizationId: org.id,
      organizationName: org.name,
      workMode,
      workModeInfo: modeInfo,
      hasProjects: Boolean(org.has_projects),
      hasLocations: Boolean(org.has_locations),
      labels: {
        project: org.project_label || 'Project',
        location: org.location_label || 'Location',
        team: org.team_label || 'Team'
      }
    };
  },

  /**
   * Set organization work mode
   * 
   * @param {string} orgId - Organization ID
   * @param {string} mode - Work mode (SIMPLE, LOCATION_BASED, PROJECT_BASED, FULL)
   * @param {Object} options - Additional options
   * @param {string} options.projectLabel - Custom label for projects
   * @param {string} options.locationLabel - Custom label for locations
   * @param {string} options.teamLabel - Custom label for teams
   * @returns {Promise<Object>} Updated configuration
   */
  async setWorkMode(orgId, mode, options = {}) {
    if (!WORK_MODES[mode]) {
      throw new Error(`Invalid work mode: ${mode}. Valid modes: ${Object.keys(WORK_MODES).join(', ')}`);
    }

    const modeInfo = WORK_MODE_INFO[mode];
    const updates = [
      'work_mode = ?',
      'has_projects = ?',
      'has_locations = ?'
    ];
    const values = [mode, modeInfo.hasProjects ? 1 : 0, modeInfo.hasLocations ? 1 : 0];

    // Handle custom labels
    if (options.projectLabel) {
      updates.push('project_label = ?');
      values.push(options.projectLabel);
    }
    if (options.locationLabel) {
      updates.push('location_label = ?');
      values.push(options.locationLabel);
    }
    if (options.teamLabel) {
      updates.push('team_label = ?');
      values.push(options.teamLabel);
    }

    values.push(orgId);

    await db.runAsync(
      `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Log audit event
    await this._logWorkModeChange(orgId, mode, options);

    return this.getWorkMode(orgId);
  },

  /**
   * Get all available work modes
   * 
   * @returns {Array<Object>} List of work modes with info
   */
  getAllWorkModes() {
    return Object.entries(WORK_MODE_INFO).map(([code, info]) => ({
      code,
      ...info
    }));
  },

  /**
   * Get effective capabilities for a user in an organization
   * 
   * Aggregates capabilities from:
   * 1. Organization role (ADMIN, etc.)
   * 2. Facility assignments (if location-based)
   * 3. Project PMO roles (if project-based)
   * 
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {Object} context - Optional context (projectId, facilityId)
   * @returns {Promise<Object>} Effective capabilities
   */
  async getEffectiveCapabilities(userId, orgId, context = {}) {
    // Get user's base role
    const user = await db.getAsync(
      'SELECT id, role, organization_id FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new Error('User not found');
    }

    // Get work mode configuration
    const config = await this.getWorkMode(orgId);
    
    const capabilities = new Set();
    const sources = [];

    // 1. Add base role capabilities
    const baseCapabilities = this._getBaseRoleCapabilities(user.role);
    baseCapabilities.forEach(cap => capabilities.add(cap));
    sources.push({
      type: 'organization_role',
      role: user.role,
      capabilities: baseCapabilities
    });

    // 2. Add facility capabilities (if location-based)
    if (config.hasLocations) {
      const facilityAssignments = await db.allAsync(
        `SELECT fu.*, of.name as facility_name
         FROM facility_users fu
         JOIN organization_facilities of ON of.id = fu.facility_id
         WHERE fu.user_id = ? AND of.organization_id = ?`,
        [userId, orgId]
      );

      for (const assignment of facilityAssignments) {
        const facilityCapabilities = this._getFacilityRoleCapabilities(assignment);
        facilityCapabilities.forEach(cap => capabilities.add(cap));
        sources.push({
          type: 'facility',
          facilityId: assignment.facility_id,
          facilityName: assignment.facility_name,
          role: assignment.role,
          capabilities: facilityCapabilities
        });
      }
    }

    // 3. Add project PMO role capabilities (if project-based)
    if (config.hasProjects) {
      const projectAssignments = await db.allAsync(
        `SELECT pm.*, p.name as project_name, 
                prd.code as pmo_role_code, prd.name as pmo_role_name
         FROM project_members pm
         JOIN projects p ON p.id = pm.project_id
         LEFT JOIN pmo_role_definitions prd ON prd.id = pm.pmo_role_id
         WHERE pm.user_id = ? AND p.organization_id = ?`,
        [userId, orgId]
      );

      for (const assignment of projectAssignments) {
        // Get capabilities from PMO role
        if (assignment.pmo_role_id) {
          const pmoCapabilities = await db.allAsync(
            `SELECT c.code, prc.scope
             FROM pmo_role_capabilities prc
             JOIN capabilities c ON c.id = prc.capability_id
             WHERE prc.pmo_role_id = ?`,
            [assignment.pmo_role_id]
          );

          const caps = pmoCapabilities.map(c => `${c.code}:${c.scope}`);
          caps.forEach(cap => capabilities.add(cap));
          sources.push({
            type: 'project',
            projectId: assignment.project_id,
            projectName: assignment.project_name,
            pmoRole: assignment.pmo_role_code,
            pmoRoleName: assignment.pmo_role_name,
            capabilities: caps
          });
        }
      }
    }

    return {
      userId,
      organizationId: orgId,
      workMode: config.workMode,
      capabilities: Array.from(capabilities),
      sources,
      context,
      resolvedAt: new Date().toISOString()
    };
  },

  /**
   * Check if user has a specific capability
   * 
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @param {string} capability - Capability code to check
   * @param {Object} context - Optional context (projectId, facilityId)
   * @returns {Promise<boolean>} Has capability
   */
  async hasCapability(userId, orgId, capability, context = {}) {
    const effective = await this.getEffectiveCapabilities(userId, orgId, context);
    
    // Check for exact match
    if (effective.capabilities.includes(capability)) {
      return true;
    }

    // Check for scoped matches (e.g., task:edit:project matches task:edit in project context)
    const [resource, action] = capability.split(':');
    const scopedPatterns = [
      `${resource}:${action}:all`,
      `${resource}:${action}:project`,
      `${resource}:${action}:assigned`
    ];

    return effective.capabilities.some(cap => scopedPatterns.includes(cap));
  },

  /**
   * Get task visibility rules for a user
   * 
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Visibility rules
   */
  async getTaskVisibilityRules(userId, orgId) {
    const config = await this.getWorkMode(orgId);
    const user = await db.getAsync('SELECT role FROM users WHERE id = ?', [userId]);

    // Admins see everything
    if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
      return {
        type: 'all',
        filters: {}
      };
    }

    const rules = {
      type: config.workMode,
      filters: {}
    };

    switch (config.workMode) {
      case WORK_MODES.SIMPLE:
        // All tasks visible
        rules.filters = {};
        break;

      case WORK_MODES.LOCATION_BASED: {
        // Only tasks from user's facilities
        const facilities = await db.allAsync(
          `SELECT facility_id FROM facility_users WHERE user_id = ?`,
          [userId]
        );
        rules.filters.facilityIds = facilities.map(f => f.facility_id);
        break;
      }

      case WORK_MODES.PROJECT_BASED: {
        // Only tasks from user's projects
        const projects = await db.allAsync(
          `SELECT project_id FROM project_members WHERE user_id = ?`,
          [userId]
        );
        rules.filters.projectIds = projects.map(p => p.project_id);
        break;
      }

      case WORK_MODES.FULL: {
        // Tasks from user's facilities OR projects
        const facilities = await db.allAsync(
          `SELECT facility_id FROM facility_users WHERE user_id = ?`,
          [userId]
        );
        const projects = await db.allAsync(
          `SELECT project_id FROM project_members WHERE user_id = ?`,
          [userId]
        );
        rules.filters.facilityIds = facilities.map(f => f.facility_id);
        rules.filters.projectIds = projects.map(p => p.project_id);
        break;
      }
    }

    return rules;
  },

  /**
   * Get base role capabilities
   * @private
   */
  _getBaseRoleCapabilities(role) {
    const baseCapabilities = {
      SUPERADMIN: ['*:*:all'],
      ADMIN: [
        'project:create', 'project:edit', 'project:delete', 'project:archive', 'project:assign_users',
        'task:create', 'task:edit_all', 'task:delete', 'task:assign', 'task:change_status', 'task:approve',
        'initiative:create', 'initiative:edit', 'initiative:delete', 'initiative:approve', 'initiative:prioritize',
        'stagegate:create', 'stagegate:approve', 'stagegate:reject',
        'risk:create', 'risk:manage', 'issue:create', 'issue:resolve',
        'document:create', 'document:edit', 'document:delete', 'document:approve',
        'report:view', 'report:create', 'report:export'
      ],
      PROJECT_MANAGER: [
        'task:create', 'task:edit_all', 'task:assign', 'task:change_status', 'task:approve',
        'initiative:create', 'initiative:edit', 'initiative:prioritize',
        'risk:create', 'risk:manage', 'issue:create', 'issue:resolve',
        'document:create', 'document:edit',
        'report:view', 'report:create'
      ],
      TEAM_MEMBER: [
        'task:create', 'task:edit_own', 'task:change_status',
        'issue:create',
        'document:create',
        'report:view'
      ],
      VIEWER: [
        'report:view'
      ]
    };

    return baseCapabilities[role] || baseCapabilities.VIEWER;
  },

  /**
   * Get facility role capabilities
   * @private
   */
  _getFacilityRoleCapabilities(assignment) {
    const capabilities = [];

    if (assignment.can_view_all_tasks) {
      capabilities.push('task:view_all:facility');
    }
    if (assignment.can_manage_users) {
      capabilities.push('facility:manage_users');
    }
    if (assignment.can_edit_facility) {
      capabilities.push('facility:edit');
    }

    // Role-based defaults
    switch (assignment.role) {
      case 'manager':
        capabilities.push('task:view_all:facility', 'task:assign:facility', 'facility:manage_users');
        break;
      case 'lead':
        capabilities.push('task:view_all:facility', 'task:assign:facility');
        break;
      case 'member':
        capabilities.push('task:view_assigned:facility');
        break;
      case 'viewer':
        capabilities.push('task:view:facility');
        break;
    }

    return capabilities;
  },

  /**
   * Log work mode change
   * @private
   */
  async _logWorkModeChange(orgId, newMode, options) {
    try {
      const { v4: uuid } = require('uuid');
      
      await db.runAsync(
        `INSERT INTO audit_events 
         (id, organization_id, event_type, entity_type, entity_id, action, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          orgId,
          'ORGANIZATION_SETTINGS',
          'organization',
          orgId,
          'WORK_MODE_CHANGED',
          JSON.stringify({ workMode: newMode, options }),
          new Date().toISOString()
        ]
      );
    } catch (err) {
      console.error('[WorkModeService] Audit log failed:', err.message);
    }
  }
};

module.exports = WorkModeService;








/**
 * Facility User Service
 * 
 * Manages user assignments to facilities (locations/units).
 * 
 * Features:
 * - Assign users to facilities with specific roles
 * - Support primary, secondary, and temporary assignments
 * - Track assignment history
 * - Manage facility-level permissions
 * 
 * Standards:
 * - ISO 21500:2021 - Resource Assignment (Clause 4.6)
 * - PMI PMBOK 7th Edition - Team Performance Domain
 * - PRINCE2 - Organization Theme
 * 
 * @module facilityUserService
 */

const { v4: uuid } = require('uuid');
const db = require('../database');

/**
 * Assignment Types
 */
const ASSIGNMENT_TYPES = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  TEMPORARY: 'temporary'
};

/**
 * Facility Roles
 */
const FACILITY_ROLES = {
  MANAGER: 'manager',
  LEAD: 'lead',
  MEMBER: 'member',
  VIEWER: 'viewer'
};

/**
 * Facility User Service
 */
const FacilityUserService = {
  ASSIGNMENT_TYPES,
  FACILITY_ROLES,

  /**
   * Assign user to a facility
   * 
   * @param {string} userId - User ID
   * @param {string} facilityId - Facility ID
   * @param {Object} options - Assignment options
   * @param {string} options.role - Role within facility (manager, lead, member, viewer)
   * @param {string} options.assignmentType - Type of assignment (primary, secondary, temporary)
   * @param {boolean} options.canViewAllTasks - Can view all tasks in facility
   * @param {boolean} options.canManageUsers - Can manage facility users
   * @param {boolean} options.canEditFacility - Can edit facility details
   * @param {Date} options.validUntil - Expiration date for temporary assignments
   * @param {string} options.notes - Assignment notes
   * @param {string} options.assignedBy - ID of user making the assignment
   * @returns {Promise<Object>} Created assignment
   */
  async assignUserToFacility(userId, facilityId, options = {}) {
    const {
      role = FACILITY_ROLES.MEMBER,
      assignmentType = ASSIGNMENT_TYPES.PRIMARY,
      canViewAllTasks = false,
      canManageUsers = false,
      canEditFacility = false,
      validUntil = null,
      notes = null,
      assignedBy = null
    } = options;

    // Validate facility exists
    const facility = await db.getAsync(
      'SELECT id, organization_id, name FROM organization_facilities WHERE id = ?',
      [facilityId]
    );
    if (!facility) {
      throw new Error('Facility not found');
    }

    // Validate user exists and belongs to same organization
    const user = await db.getAsync(
      'SELECT id, organization_id, first_name, last_name FROM users WHERE id = ?',
      [userId]
    );
    if (!user) {
      throw new Error('User not found');
    }
    if (user.organization_id !== facility.organization_id) {
      throw new Error('User and facility must belong to the same organization');
    }

    // Check if assignment already exists
    const existing = await db.getAsync(
      'SELECT * FROM facility_users WHERE facility_id = ? AND user_id = ?',
      [facilityId, userId]
    );

    const now = new Date().toISOString();

    if (existing) {
      // Update existing assignment
      await db.runAsync(
        `UPDATE facility_users SET
          assignment_type = ?,
          role = ?,
          can_view_all_tasks = ?,
          can_manage_users = ?,
          can_edit_facility = ?,
          valid_until = ?,
          notes = ?,
          assigned_by = ?,
          assigned_at = ?
         WHERE facility_id = ? AND user_id = ?`,
        [
          assignmentType,
          role,
          canViewAllTasks ? 1 : 0,
          canManageUsers ? 1 : 0,
          canEditFacility ? 1 : 0,
          validUntil,
          notes,
          assignedBy,
          now,
          facilityId,
          userId
        ]
      );
    } else {
      // Create new assignment
      await db.runAsync(
        `INSERT INTO facility_users
         (facility_id, user_id, assignment_type, role, can_view_all_tasks, 
          can_manage_users, can_edit_facility, assigned_at, assigned_by, valid_until, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          facilityId,
          userId,
          assignmentType,
          role,
          canViewAllTasks ? 1 : 0,
          canManageUsers ? 1 : 0,
          canEditFacility ? 1 : 0,
          now,
          assignedBy,
          validUntil,
          notes
        ]
      );
    }

    // Log audit event
    await this._logAssignmentEvent(facility.organization_id, 'USER_ASSIGNED_TO_FACILITY', {
      userId,
      userName: `${user.first_name} ${user.last_name}`,
      facilityId,
      facilityName: facility.name,
      role,
      assignmentType,
      assignedBy
    });

    return this.getAssignment(facilityId, userId);
  },

  /**
   * Remove user from facility
   * 
   * @param {string} userId - User ID
   * @param {string} facilityId - Facility ID
   * @param {string} removedBy - ID of user removing the assignment
   * @returns {Promise<boolean>} Success
   */
  async removeUserFromFacility(userId, facilityId, removedBy = null) {
    const facility = await db.getAsync(
      'SELECT organization_id, name FROM organization_facilities WHERE id = ?',
      [facilityId]
    );
    if (!facility) {
      throw new Error('Facility not found');
    }

    const user = await db.getAsync(
      'SELECT first_name, last_name FROM users WHERE id = ?',
      [userId]
    );

    const existing = await db.getAsync(
      'SELECT * FROM facility_users WHERE facility_id = ? AND user_id = ?',
      [facilityId, userId]
    );
    if (!existing) {
      throw new Error('User is not assigned to this facility');
    }

    await db.runAsync(
      'DELETE FROM facility_users WHERE facility_id = ? AND user_id = ?',
      [facilityId, userId]
    );

    // Log audit event
    await this._logAssignmentEvent(facility.organization_id, 'USER_REMOVED_FROM_FACILITY', {
      userId,
      userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
      facilityId,
      facilityName: facility.name,
      previousRole: existing.role,
      removedBy
    });

    return true;
  },

  /**
   * Get a specific assignment
   * 
   * @param {string} facilityId - Facility ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Assignment details
   */
  async getAssignment(facilityId, userId) {
    const row = await db.getAsync(
      `SELECT fu.*, 
              u.first_name, u.last_name, u.email, u.role as user_role,
              of.name as facility_name, of.code as facility_code
       FROM facility_users fu
       JOIN users u ON u.id = fu.user_id
       JOIN organization_facilities of ON of.id = fu.facility_id
       WHERE fu.facility_id = ? AND fu.user_id = ?`,
      [facilityId, userId]
    );

    if (!row) return null;

    return this._formatAssignment(row);
  },

  /**
   * Get all users in a facility
   * 
   * @param {string} facilityId - Facility ID
   * @param {Object} options - Filter options
   * @param {string} options.role - Filter by role
   * @param {string} options.assignmentType - Filter by assignment type
   * @returns {Promise<Array>} List of user assignments
   */
  async getFacilityUsers(facilityId, options = {}) {
    let query = `
      SELECT fu.*, 
             u.first_name, u.last_name, u.email, u.role as user_role, u.avatar,
             of.name as facility_name
      FROM facility_users fu
      JOIN users u ON u.id = fu.user_id
      JOIN organization_facilities of ON of.id = fu.facility_id
      WHERE fu.facility_id = ?
    `;
    const params = [facilityId];

    if (options.role) {
      query += ' AND fu.role = ?';
      params.push(options.role);
    }

    if (options.assignmentType) {
      query += ' AND fu.assignment_type = ?';
      params.push(options.assignmentType);
    }

    query += ' ORDER BY fu.role, u.last_name, u.first_name';

    const rows = await db.allAsync(query, params);
    return rows.map(row => this._formatAssignment(row));
  },

  /**
   * Get all facilities for a user
   * 
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID (optional filter)
   * @returns {Promise<Array>} List of facility assignments
   */
  async getUserFacilities(userId, orgId = null) {
    let query = `
      SELECT fu.*, 
             of.name as facility_name, of.code as facility_code, 
             of.address, of.status, of.is_headquarters,
             of.organization_id
      FROM facility_users fu
      JOIN organization_facilities of ON of.id = fu.facility_id
      WHERE fu.user_id = ?
    `;
    const params = [userId];

    if (orgId) {
      query += ' AND of.organization_id = ?';
      params.push(orgId);
    }

    // Exclude expired temporary assignments
    query += ` AND (fu.valid_until IS NULL OR fu.valid_until > datetime('now'))`;
    query += ' ORDER BY fu.assignment_type, of.name';

    const rows = await db.allAsync(query, params);
    return rows.map(row => ({
      facilityId: row.facility_id,
      facilityName: row.facility_name,
      facilityCode: row.facility_code,
      address: row.address,
      status: row.status,
      isHeadquarters: Boolean(row.is_headquarters),
      organizationId: row.organization_id,
      role: row.role,
      assignmentType: row.assignment_type,
      canViewAllTasks: Boolean(row.can_view_all_tasks),
      canManageUsers: Boolean(row.can_manage_users),
      canEditFacility: Boolean(row.can_edit_facility),
      assignedAt: row.assigned_at,
      validUntil: row.valid_until
    }));
  },

  /**
   * Get user's primary facility
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Primary facility assignment
   */
  async getUserPrimaryFacility(userId) {
    const row = await db.getAsync(
      `SELECT fu.*, 
              of.name as facility_name, of.code as facility_code,
              of.organization_id
       FROM facility_users fu
       JOIN organization_facilities of ON of.id = fu.facility_id
       WHERE fu.user_id = ? AND fu.assignment_type = 'primary'
       LIMIT 1`,
      [userId]
    );

    if (!row) return null;

    return {
      facilityId: row.facility_id,
      facilityName: row.facility_name,
      facilityCode: row.facility_code,
      organizationId: row.organization_id,
      role: row.role
    };
  },

  /**
   * Update user's role in a facility
   * 
   * @param {string} userId - User ID
   * @param {string} facilityId - Facility ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated assignment
   */
  async updateAssignment(userId, facilityId, updates) {
    const existing = await db.getAsync(
      'SELECT * FROM facility_users WHERE facility_id = ? AND user_id = ?',
      [facilityId, userId]
    );
    if (!existing) {
      throw new Error('Assignment not found');
    }

    const allowedFields = [
      'role', 'assignment_type', 'can_view_all_tasks', 
      'can_manage_users', 'can_edit_facility', 'valid_until', 'notes'
    ];
    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
      }
    }

    if (setClauses.length === 0) {
      return this.getAssignment(facilityId, userId);
    }

    values.push(facilityId, userId);

    await db.runAsync(
      `UPDATE facility_users SET ${setClauses.join(', ')} WHERE facility_id = ? AND user_id = ?`,
      values
    );

    return this.getAssignment(facilityId, userId);
  },

  /**
   * Get facility assignment statistics
   * 
   * @param {string} facilityId - Facility ID
   * @returns {Promise<Object>} Statistics
   */
  async getFacilityStats(facilityId) {
    const stats = await db.getAsync(
      `SELECT 
         COUNT(*) as total_users,
         SUM(CASE WHEN role = 'manager' THEN 1 ELSE 0 END) as managers,
         SUM(CASE WHEN role = 'lead' THEN 1 ELSE 0 END) as leads,
         SUM(CASE WHEN role = 'member' THEN 1 ELSE 0 END) as members,
         SUM(CASE WHEN role = 'viewer' THEN 1 ELSE 0 END) as viewers,
         SUM(CASE WHEN assignment_type = 'primary' THEN 1 ELSE 0 END) as primary_assignments,
         SUM(CASE WHEN assignment_type = 'secondary' THEN 1 ELSE 0 END) as secondary_assignments,
         SUM(CASE WHEN assignment_type = 'temporary' THEN 1 ELSE 0 END) as temporary_assignments
       FROM facility_users
       WHERE facility_id = ?`,
      [facilityId]
    );

    return {
      facilityId,
      totalUsers: stats?.total_users || 0,
      byRole: {
        manager: stats?.managers || 0,
        lead: stats?.leads || 0,
        member: stats?.members || 0,
        viewer: stats?.viewers || 0
      },
      byAssignmentType: {
        primary: stats?.primary_assignments || 0,
        secondary: stats?.secondary_assignments || 0,
        temporary: stats?.temporary_assignments || 0
      }
    };
  },

  /**
   * Bulk assign users to facility
   * 
   * @param {string} facilityId - Facility ID
   * @param {Array<Object>} assignments - List of {userId, role, assignmentType}
   * @param {string} assignedBy - ID of user making assignments
   * @returns {Promise<Array>} Created assignments
   */
  async bulkAssignUsers(facilityId, assignments, assignedBy) {
    const results = [];

    for (const assignment of assignments) {
      try {
        const result = await this.assignUserToFacility(
          assignment.userId,
          facilityId,
          {
            role: assignment.role || FACILITY_ROLES.MEMBER,
            assignmentType: assignment.assignmentType || ASSIGNMENT_TYPES.PRIMARY,
            assignedBy
          }
        );
        results.push({ success: true, userId: assignment.userId, assignment: result });
      } catch (err) {
        results.push({ success: false, userId: assignment.userId, error: err.message });
      }
    }

    return results;
  },

  /**
   * Format assignment from DB row
   * @private
   */
  _formatAssignment(row) {
    return {
      facilityId: row.facility_id,
      facilityName: row.facility_name,
      facilityCode: row.facility_code,
      userId: row.user_id,
      userName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
      userEmail: row.email,
      userRole: row.user_role,
      userAvatar: row.avatar,
      role: row.role,
      assignmentType: row.assignment_type,
      permissions: {
        canViewAllTasks: Boolean(row.can_view_all_tasks),
        canManageUsers: Boolean(row.can_manage_users),
        canEditFacility: Boolean(row.can_edit_facility)
      },
      assignedAt: row.assigned_at,
      assignedBy: row.assigned_by,
      validUntil: row.valid_until,
      notes: row.notes
    };
  },

  /**
   * Log assignment event
   * @private
   */
  async _logAssignmentEvent(orgId, eventType, metadata) {
    try {
      await db.runAsync(
        `INSERT INTO audit_events 
         (id, organization_id, event_type, entity_type, entity_id, action, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          orgId,
          'FACILITY_MANAGEMENT',
          'facility_users',
          metadata.facilityId,
          eventType,
          JSON.stringify(metadata),
          new Date().toISOString()
        ]
      );
    } catch (err) {
      console.error('[FacilityUserService] Audit log failed:', err.message);
    }
  }
};

module.exports = FacilityUserService;




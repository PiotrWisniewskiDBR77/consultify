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
    const { default: pmoDomainRegistry } = await import('./pmoDomainRegistry.js');
    deps._pmoDomainRegistry = pmoDomainRegistry;
  }
  if (!deps._pmoStandardsMapping) {
    const { default: pmoStandardsMapping } = await import('./pmoStandardsMapping.js');
    deps._pmoStandardsMapping = pmoStandardsMapping;
  }
}

/**
 * Workstream Status
 */
export const WORKSTREAM_STATUS = {
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

/**
 * Default colors for workstreams
 */
export const DEFAULT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#84CC16'  // Lime
];

class WorkstreamService {
  constructor() {
    this._db = null;
    this.WORKSTREAM_STATUS = WORKSTREAM_STATUS;
    this.DEFAULT_COLORS = DEFAULT_COLORS;
  }

  get db() {
    if (!this._db) {
      throw new Error('WorkstreamService: Database not initialized. Call init() first.');
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
   * Create a new workstream
   */
  async createWorkstream(projectId, data) {
    await this.init();
    const { name, description, ownerId, color } = data;

    if (!name || !name.trim()) {
      throw new Error('Workstream name is required');
    }

    const maxOrder = await this.db.getAsync(
      'SELECT MAX(sort_order) as max_order FROM workstreams WHERE project_id = ?',
      [projectId]
    );

    const id = uuid();
    const now = new Date().toISOString();
    const sortOrder = (maxOrder?.max_order || 0) + 1;
    const selectedColor = color || DEFAULT_COLORS[(sortOrder - 1) % DEFAULT_COLORS.length];

    await this.db.runAsync(
      `INSERT INTO workstreams 
       (id, project_id, name, description, owner_id, status, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        name.trim(),
        description || null,
        ownerId || null,
        WORKSTREAM_STATUS.ACTIVE,
        selectedColor,
        sortOrder,
        now,
        now
      ]
    );

    await this._logAudit(projectId, 'WORKSTREAM_CREATED', { workstreamId: id, name });

    return this.getWorkstream(id);
  }

  /**
   * Get a workstream by ID
   */
  async getWorkstream(id) {
    await this.init();
    const workstream = await this.db.getAsync(
      `SELECT w.*, u.first_name as owner_first_name, u.last_name as owner_last_name
       FROM workstreams w
       LEFT JOIN users u ON u.id = w.owner_id
       WHERE w.id = ?`,
      [id]
    );

    if (!workstream) return null;

    const stats = await this.db.getAsync(
      `SELECT 
         COUNT(i.id) as initiative_count,
         SUM(CASE WHEN i.status = 'DONE' OR i.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
         AVG(COALESCE(i.progress, 0)) as avg_progress
       FROM initiatives i
       WHERE i.workstream_id = ?`,
      [id]
    );

    return this._formatWorkstream(workstream, stats);
  }

  /**
   * Get all workstreams for a project
   */
  async getProjectWorkstreams(projectId, options = {}) {
    await this.init();
    let query = `
      SELECT w.*, u.first_name as owner_first_name, u.last_name as owner_last_name
      FROM workstreams w
      LEFT JOIN users u ON u.id = w.owner_id
      WHERE w.project_id = ?
    `;
    const params = [projectId];

    if (options.status) {
      query += ' AND w.status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY w.sort_order, w.name';

    const workstreams = await this.db.allAsync(query, params);

    if (workstreams.length === 0) return [];

    const stats = await this.db.allAsync(
      `SELECT 
         i.workstream_id,
         COUNT(i.id) as initiative_count,
         SUM(CASE WHEN i.status = 'DONE' OR i.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
         AVG(COALESCE(i.progress, 0)) as avg_progress
       FROM initiatives i
       WHERE i.workstream_id IN (${workstreams.map(() => '?').join(',')})
       GROUP BY i.workstream_id`,
      workstreams.map(w => w.id)
    );

    const statsMap = stats.reduce((acc, s) => {
      acc[s.workstream_id] = s;
      return acc;
    }, {});

    return workstreams.map(w => this._formatWorkstream(w, statsMap[w.id]));
  }

  /**
   * Update a workstream
   */
  async updateWorkstream(id, updates) {
    await this.init();
    const existing = await this.db.getAsync('SELECT * FROM workstreams WHERE id = ?', [id]);
    if (!existing) {
      throw new Error('Workstream not found');
    }

    const allowedFields = ['name', 'description', 'owner_id', 'status', 'color', 'sort_order'];
    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      return this.getWorkstream(id);
    }

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db.runAsync(
      `UPDATE workstreams SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );

    if (updates.status && updates.status !== existing.status) {
      await this._logAudit(existing.project_id, 'WORKSTREAM_STATUS_CHANGED', {
        workstreamId: id,
        oldStatus: existing.status,
        newStatus: updates.status
      });
    }

    return this.getWorkstream(id);
  }

  /**
   * Delete a workstream
   */
  async deleteWorkstream(id) {
    await this.init();
    const existing = await this.db.getAsync('SELECT * FROM workstreams WHERE id = ?', [id]);
    if (!existing) {
      throw new Error('Workstream not found');
    }

    await this.db.runAsync(
      'UPDATE initiatives SET workstream_id = NULL WHERE workstream_id = ?',
      [id]
    );

    await this.db.runAsync(
      'UPDATE tasks SET workstream_id = NULL WHERE workstream_id = ?',
      [id]
    );

    await this.db.runAsync(
      'UPDATE project_members SET workstream_id = NULL WHERE workstream_id = ?',
      [id]
    );

    await this.db.runAsync('DELETE FROM workstreams WHERE id = ?', [id]);

    await this._logAudit(existing.project_id, 'WORKSTREAM_DELETED', {
      workstreamId: id,
      name: existing.name
    });

    return true;
  }

  /**
   * Assign an initiative to a workstream
   */
  async assignInitiative(workstreamId, initiativeId) {
    await this.init();
    const workstream = await this.db.getAsync('SELECT project_id FROM workstreams WHERE id = ?', [workstreamId]);
    if (!workstream) {
      throw new Error('Workstream not found');
    }

    const initiative = await this.db.getAsync('SELECT project_id FROM initiatives WHERE id = ?', [initiativeId]);
    if (!initiative) {
      throw new Error('Initiative not found');
    }

    if (workstream.project_id !== initiative.project_id) {
      throw new Error('Initiative and workstream must belong to the same project');
    }

    await this.db.runAsync(
      'UPDATE initiatives SET workstream_id = ?, updated_at = ? WHERE id = ?',
      [workstreamId, new Date().toISOString(), initiativeId]
    );

    await this._logAudit(workstream.project_id, 'INITIATIVE_ASSIGNED_TO_WORKSTREAM', {
      workstreamId,
      initiativeId
    });

    return this.db.getAsync('SELECT * FROM initiatives WHERE id = ?', [initiativeId]);
  }

  /**
   * Remove an initiative from a workstream
   */
  async unassignInitiative(initiativeId) {
    await this.init();
    const initiative = await this.db.getAsync('SELECT * FROM initiatives WHERE id = ?', [initiativeId]);
    if (!initiative) {
      throw new Error('Initiative not found');
    }

    await this.db.runAsync(
      'UPDATE initiatives SET workstream_id = NULL, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), initiativeId]
    );

    if (initiative.workstream_id) {
      await this._logAudit(initiative.project_id, 'INITIATIVE_UNASSIGNED_FROM_WORKSTREAM', {
        workstreamId: initiative.workstream_id,
        initiativeId
      });
    }

    return this.db.getAsync('SELECT * FROM initiatives WHERE id = ?', [initiativeId]);
  }

  /**
   * Get workstream progress details
   */
  async getWorkstreamProgress(workstreamId) {
    await this.init();
    const workstream = await this.db.getAsync('SELECT * FROM workstreams WHERE id = ?', [workstreamId]);
    if (!workstream) {
      throw new Error('Workstream not found');
    }

    const initiatives = await this.db.allAsync(
      `SELECT id, title, status, progress, priority, due_date
       FROM initiatives
       WHERE workstream_id = ?
       ORDER BY priority DESC, due_date ASC`,
      [workstreamId]
    );

    const taskStats = await this.db.getAsync(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'DONE' OR status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked
       FROM tasks
       WHERE workstream_id = ?`,
      [workstreamId]
    );

    const members = await this.db.allAsync(
      `SELECT pm.*, u.first_name, u.last_name
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.workstream_id = ?`,
      [workstreamId]
    );

    const totalProgress = initiatives.length > 0
      ? initiatives.reduce((sum, i) => sum + (i.progress || 0), 0) / initiatives.length
      : 0;

    return {
      workstreamId,
      name: workstream.name,
      status: workstream.status,
      progress: Math.round(totalProgress),
      initiatives: {
        total: initiatives.length,
        completed: initiatives.filter(i => i.status === 'DONE' || i.status === 'COMPLETED').length,
        inProgress: initiatives.filter(i => i.status === 'IN_PROGRESS').length,
        items: initiatives
      },
      tasks: {
        total: taskStats?.total || 0,
        completed: taskStats?.completed || 0,
        inProgress: taskStats?.in_progress || 0,
        blocked: taskStats?.blocked || 0
      },
      team: members.map(m => ({
        userId: m.user_id,
        name: `${m.first_name} ${m.last_name}`,
        role: m.project_role,
        allocation: m.allocation_percent
      })),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Reorder workstreams
   */
  async reorderWorkstreams(projectId, workstreamIds) {
    await this.init();
    for (let i = 0; i < workstreamIds.length; i++) {
      await this.db.runAsync(
        'UPDATE workstreams SET sort_order = ?, updated_at = ? WHERE id = ? AND project_id = ?',
        [i + 1, new Date().toISOString(), workstreamIds[i], projectId]
      );
    }
    return true;
  }

  /**
   * Get unassigned initiatives
   */
  async getUnassignedInitiatives(projectId) {
    await this.init();
    return this.db.allAsync(
      `SELECT id, title, status, progress, priority, due_date
       FROM initiatives
       WHERE project_id = ? AND workstream_id IS NULL
       ORDER BY priority DESC, created_at DESC`,
      [projectId]
    );
  }

  _formatWorkstream(row, stats = {}) {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      ownerId: row.owner_id,
      ownerName: row.owner_first_name && row.owner_last_name
        ? `${row.owner_first_name} ${row.owner_last_name}`
        : null,
      status: row.status,
      color: row.color,
      sortOrder: row.sort_order,
      initiativeCount: stats.initiative_count || 0,
      completedCount: stats.completed_count || 0,
      progress: Math.round(stats.avg_progress || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async _logAudit(projectId, action, metadata = {}) {
    try {
      await this.init();
      const mapping = deps.pmoStandardsMapping.getMapping('Initiative');

      await this.db.runAsync(
        `INSERT INTO pmo_audit_trail 
         (id, project_id, pmo_domain_id, pmo_phase, object_type, object_id, action, actor_id,
          iso21500_mapping, pmbok_mapping, prince2_mapping, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          projectId,
          deps.pmoDomainRegistry.PMO_DOMAIN_IDS.RESOURCE_RESPONSIBILITY,
          null,
          'WORKSTREAM',
          metadata.workstreamId || null,
          action,
          null,
          mapping?.iso21500?.term || 'Work Package (4.4.4)',
          mapping?.pmbok7?.term || 'Work Package Grouping',
          mapping?.prince2?.term || 'Work Package Cluster',
          JSON.stringify(metadata),
          new Date().toISOString()
        ]
      );
    } catch (err) {
      console.error('[WorkstreamService] Audit log failed:', err.message);
    }
  }
}

const workstreamServiceInstance = new WorkstreamService();
export default workstreamServiceInstance;


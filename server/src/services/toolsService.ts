/**
 * Tools Service
 * FLOW-TOOLS-001: Manage tools and tool work items
 *
 * @deprecated Legacy implementation based on `tool_works` / `process_flows` / `a3_documents`.
 * The active Tools workflow uses `tool_sessions` + decisions + initiative links (see `ToolController`).
 * This file is kept temporarily for reference during migration and will be removed once all legacy
 * tables and UI paths are fully retired.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface Tool {
  id: string;
  name: string;
  displayName: string;
  category: 'assessment' | 'process' | 'ai' | 'analysis';
  description?: string;
  icon?: string;
  isLicensed: boolean;
  isActive: boolean;
  isComingSoon: boolean;
  sortOrder: number;
}

export interface ToolWork {
  id: string;
  organizationId: string;
  toolId: string;
  name: string;
  description?: string;
  projectId?: string;
  initiativeId?: string;
  taskId?: string;
  workData: Record<string, unknown>;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  progress: number;
  sharedWith: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessFlow {
  id: string;
  toolWorkId: string;
  name: string;
  description?: string;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  currentStage: 'map' | 'classify' | 'measure' | 'optimize' | 'automate';
  metrics: ProcessMetrics;
}

export interface ProcessNode {
  id: string;
  type: 'action' | 'decision' | 'start' | 'end';
  data: {
    label: string;
    description?: string;
    isValueAdd?: boolean;
    time?: number;
    cost?: number;
    errors?: number;
  };
  position: { x: number; y: number };
}

export interface ProcessEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ProcessMetrics {
  totalSteps: number;
  decisionSteps: number;
  actionSteps: number;
  valueAddSteps: number;
  nonValueAddSteps: number;
  estimatedTimeMinutes?: number;
  estimatedCost?: number;
}

// ==========================================
// SERVICE
// ==========================================

class ToolsService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================
  // TOOLS
  // ==========================================

  /**
   * Get all available tools
   */
  async getTools(category?: string): Promise<Tool[]> {
    const db = await this.getDb();

    let query = `SELECT * FROM tools WHERE is_active = 1`;
    const params: string[] = [];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY sort_order, display_name`;

    const rows = await db.all<{
      id: string;
      name: string;
      display_name: string;
      category: string;
      description: string;
      icon: string;
      is_licensed: number;
      is_active: number;
      is_coming_soon: number;
      sort_order: number;
    }>(query, params);

    return (rows || []).map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.display_name,
      category: r.category as Tool['category'],
      description: r.description,
      icon: r.icon,
      isLicensed: r.is_licensed === 1,
      isActive: r.is_active === 1,
      isComingSoon: r.is_coming_soon === 1,
      sortOrder: r.sort_order,
    }));
  }

  /**
   * Get tool by ID
   */
  async getTool(toolId: string): Promise<Tool | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      name: string;
      display_name: string;
      category: string;
      description: string;
      icon: string;
      is_licensed: number;
      is_active: number;
      is_coming_soon: number;
      sort_order: number;
    }>('SELECT * FROM tools WHERE id = ?', [toolId]);

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      category: row.category as Tool['category'],
      description: row.description,
      icon: row.icon,
      isLicensed: row.is_licensed === 1,
      isActive: row.is_active === 1,
      isComingSoon: row.is_coming_soon === 1,
      sortOrder: row.sort_order,
    };
  }

  // ==========================================
  // TOOL WORKS
  // ==========================================

  /**
   * Create new tool work
   */
  async createToolWork(input: {
    organizationId: string;
    toolId: string;
    name: string;
    description?: string;
    projectId?: string;
    initiativeId?: string;
    taskId?: string;
    createdBy: string;
  }): Promise<ToolWork> {
    const db = await this.getDb();
    const id = `work-${uuidv4()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO tool_works (
                id, organization_id, tool_id, name, description,
                project_id, initiative_id, task_id, work_data,
                status, progress, shared_with, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', 'draft', 0, '[]', ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.toolId,
        input.name,
        input.description || null,
        input.projectId || null,
        input.initiativeId || null,
        input.taskId || null,
        input.createdBy,
        now,
        now,
      ]
    );

    // Create tool-specific record if needed
    const tool = await this.getTool(input.toolId);
    if (tool?.name === 'process-flow') {
      await this.createProcessFlow(id, input.organizationId, input.name);
    } else if (tool?.name === 'a3-pdca') {
      await this.createA3Document(id, input.organizationId, input.name);
    }

    logger.info(`[ToolsService] Created tool work ${id} for ${input.toolId}`);

    return this.getToolWork(id) as Promise<ToolWork>;
  }

  /**
   * Get tool work by ID
   */
  async getToolWork(workId: string): Promise<ToolWork | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      organization_id: string;
      tool_id: string;
      name: string;
      description: string;
      project_id: string;
      initiative_id: string;
      task_id: string;
      work_data: string;
      status: string;
      progress: number;
      shared_with: string;
      created_by: string;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM tool_works WHERE id = ?', [workId]);

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      toolId: row.tool_id,
      name: row.name,
      description: row.description,
      projectId: row.project_id,
      initiativeId: row.initiative_id,
      taskId: row.task_id,
      workData: JSON.parse(row.work_data || '{}'),
      status: row.status as ToolWork['status'],
      progress: row.progress,
      sharedWith: JSON.parse(row.shared_with || '[]'),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List tool works for user
   */
  async listToolWorks(
    orgId: string,
    userId: string,
    filters?: { toolId?: string; projectId?: string; status?: string }
  ): Promise<ToolWork[]> {
    const db = await this.getDb();

    let query = `SELECT * FROM tool_works WHERE organization_id = ? AND (created_by = ? OR shared_with LIKE ?)`;
    const params: string[] = [orgId, userId, `%${userId}%`];

    if (filters?.toolId) {
      query += ` AND tool_id = ?`;
      params.push(filters.toolId);
    }
    if (filters?.projectId) {
      query += ` AND project_id = ?`;
      params.push(filters.projectId);
    }
    if (filters?.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY updated_at DESC`;

    const rows = await db.all<{ id: string }>(query, params);

    const works: ToolWork[] = [];
    for (const row of rows || []) {
      const work = await this.getToolWork(row.id);
      if (work) works.push(work);
    }

    return works;
  }

  /**
   * Update tool work
   */
  async updateToolWork(
    workId: string,
    updates: Partial<Pick<ToolWork, 'name' | 'description' | 'workData' | 'status' | 'progress'>>,
    userId: string
  ): Promise<ToolWork> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const fields: string[] = ['updated_at = ?', 'last_edited_by = ?'];
    const values: (string | number | null)[] = [now, userId];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.workData !== undefined) {
      fields.push('work_data = ?');
      values.push(JSON.stringify(updates.workData));
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.progress !== undefined) {
      fields.push('progress = ?');
      values.push(updates.progress);
    }

    values.push(workId);

    await db.run(`UPDATE tool_works SET ${fields.join(', ')} WHERE id = ?`, values);

    return this.getToolWork(workId) as Promise<ToolWork>;
  }

  /**
   * Assign tool work to task/initiative
   */
  async assignToolWork(
    workId: string,
    assignment: { projectId?: string; initiativeId?: string; taskId?: string }
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run(
      `UPDATE tool_works SET 
                project_id = ?, initiative_id = ?, task_id = ?, updated_at = ?
             WHERE id = ?`,
      [
        assignment.projectId || null,
        assignment.initiativeId || null,
        assignment.taskId || null,
        now,
        workId,
      ]
    );
  }

  // ==========================================
  // PROCESS FLOW
  // ==========================================

  /**
   * Create process flow record
   */
  private async createProcessFlow(toolWorkId: string, orgId: string, name: string): Promise<void> {
    const db = await this.getDb();
    const id = `flow-${uuidv4()}`;

    await db.run(
      `INSERT INTO process_flows (id, tool_work_id, organization_id, name)
             VALUES (?, ?, ?, ?)`,
      [id, toolWorkId, orgId, name]
    );
  }

  /**
   * Get process flow
   */
  async getProcessFlow(toolWorkId: string): Promise<ProcessFlow | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      tool_work_id: string;
      name: string;
      description: string;
      nodes: string;
      edges: string;
      current_stage: string;
      total_steps: number;
      decision_steps: number;
      action_steps: number;
      value_add_steps: number;
      non_value_add_steps: number;
      estimated_time_minutes: number;
      estimated_cost: number;
    }>('SELECT * FROM process_flows WHERE tool_work_id = ?', [toolWorkId]);

    if (!row) return null;

    return {
      id: row.id,
      toolWorkId: row.tool_work_id,
      name: row.name,
      description: row.description,
      nodes: JSON.parse(row.nodes || '[]'),
      edges: JSON.parse(row.edges || '[]'),
      currentStage: row.current_stage as ProcessFlow['currentStage'],
      metrics: {
        totalSteps: row.total_steps,
        decisionSteps: row.decision_steps,
        actionSteps: row.action_steps,
        valueAddSteps: row.value_add_steps,
        nonValueAddSteps: row.non_value_add_steps,
        estimatedTimeMinutes: row.estimated_time_minutes,
        estimatedCost: row.estimated_cost,
      },
    };
  }

  /**
   * Update process flow
   */
  async updateProcessFlow(
    toolWorkId: string,
    updates: {
      nodes?: ProcessNode[];
      edges?: ProcessEdge[];
      currentStage?: ProcessFlow['currentStage'];
    }
  ): Promise<ProcessFlow> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const fields: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [now];

    if (updates.nodes !== undefined) {
      fields.push('nodes = ?');
      values.push(JSON.stringify(updates.nodes));

      // Recalculate metrics
      const metrics = this.calculateProcessMetrics(updates.nodes);
      fields.push('total_steps = ?', 'decision_steps = ?', 'action_steps = ?');
      values.push(metrics.totalSteps, metrics.decisionSteps, metrics.actionSteps);
    }

    if (updates.edges !== undefined) {
      fields.push('edges = ?');
      values.push(JSON.stringify(updates.edges));
    }

    if (updates.currentStage !== undefined) {
      fields.push('current_stage = ?');
      values.push(updates.currentStage);
    }

    values.push(toolWorkId);

    await db.run(`UPDATE process_flows SET ${fields.join(', ')} WHERE tool_work_id = ?`, values);

    return this.getProcessFlow(toolWorkId) as Promise<ProcessFlow>;
  }

  /**
   * Calculate process metrics from nodes
   */
  private calculateProcessMetrics(nodes: ProcessNode[]): ProcessMetrics {
    const actionNodes = nodes.filter((n) => n.type === 'action');
    const decisionNodes = nodes.filter((n) => n.type === 'decision');
    const valueAddNodes = actionNodes.filter((n) => n.data.isValueAdd);

    return {
      totalSteps: actionNodes.length + decisionNodes.length,
      actionSteps: actionNodes.length,
      decisionSteps: decisionNodes.length,
      valueAddSteps: valueAddNodes.length,
      nonValueAddSteps: actionNodes.length - valueAddNodes.length,
      estimatedTimeMinutes: actionNodes.reduce((sum, n) => sum + (n.data.time || 0), 0),
      estimatedCost: actionNodes.reduce((sum, n) => sum + (n.data.cost || 0), 0),
    };
  }

  // ==========================================
  // A3 DOCUMENT
  // ==========================================

  /**
   * Create A3 document record
   */
  private async createA3Document(toolWorkId: string, orgId: string, title: string): Promise<void> {
    const db = await this.getDb();
    const id = `a3-${uuidv4()}`;

    await db.run(
      `INSERT INTO a3_documents (id, tool_work_id, organization_id, title)
             VALUES (?, ?, ?, ?)`,
      [id, toolWorkId, orgId, title]
    );
  }

  /**
   * Get A3 document
   */
  async getA3Document(toolWorkId: string): Promise<Record<string, unknown> | null> {
    const db = await this.getDb();

    const row = await db.get<Record<string, unknown>>(
      'SELECT * FROM a3_documents WHERE tool_work_id = ?',
      [toolWorkId]
    );

    return row || null;
  }
}

// Export singleton
const toolsService = new ToolsService();
export default toolsService;

// Named exports
export const getTools = (category?: string) => toolsService.getTools(category);
export const getTool = (toolId: string) => toolsService.getTool(toolId);
export const createToolWork = (input: Parameters<typeof toolsService.createToolWork>[0]) =>
  toolsService.createToolWork(input);
export const getToolWork = (workId: string) => toolsService.getToolWork(workId);
export const listToolWorks = (
  orgId: string,
  userId: string,
  filters?: Parameters<typeof toolsService.listToolWorks>[2]
) => toolsService.listToolWorks(orgId, userId, filters);
export const updateToolWork = (
  workId: string,
  updates: Parameters<typeof toolsService.updateToolWork>[1],
  userId: string
) => toolsService.updateToolWork(workId, updates, userId);
export const assignToolWork = (
  workId: string,
  assignment: Parameters<typeof toolsService.assignToolWork>[1]
) => toolsService.assignToolWork(workId, assignment);
export const getProcessFlow = (toolWorkId: string) => toolsService.getProcessFlow(toolWorkId);
export const updateProcessFlow = (
  toolWorkId: string,
  updates: Parameters<typeof toolsService.updateProcessFlow>[1]
) => toolsService.updateProcessFlow(toolWorkId, updates);

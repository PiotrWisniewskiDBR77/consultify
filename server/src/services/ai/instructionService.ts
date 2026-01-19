/**
 * AI Instruction Service
 * 
 * Manages multi-level instruction hierarchy for AI responses:
 * 1. System Instructions (global rules)
 * 2. Organization Instructions (company policies)
 * 3. User Instructions (personal preferences)
 * 4. Project Instructions (project-specific rules)
 * 
 * @version 1.0.0
 */

import crypto from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type InstructionLevel = 'system' | 'organization' | 'user' | 'project';
export type InstructionScope = 'all' | 'chat' | 'assessment' | 'report' | 'initiative';

export interface AIInstruction {
  id: string;
  level: InstructionLevel;
  levelId: string; // userId, orgId, projectId, or 'system'
  key: string;
  text: string;
  priority: number;
  isActive: boolean;
  scope: InstructionScope;
  effectivenessScore?: number;
  usageCount: number;
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EffectiveInstructions {
  system: AIInstruction[];
  organization: AIInstruction[];
  user: AIInstruction[];
  project: AIInstruction[];
  merged: string;
  priorities: { level: InstructionLevel; key: string; priority: number }[];
}

export interface InstructionSuggestion {
  id: string;
  level: InstructionLevel;
  levelId: string;
  suggestedText: string;
  reason: string;
  confidence: number;
  basedOnFeedbackCount: number;
  createdAt: Date;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class InstructionServiceImpl {
  private static instance: InstructionServiceImpl;

  private constructor() {}

  public static getInstance(): InstructionServiceImpl {
    if (!InstructionServiceImpl.instance) {
      InstructionServiceImpl.instance = new InstructionServiceImpl();
    }
    return InstructionServiceImpl.instance;
  }

  // ==========================================
  // INSTRUCTION RETRIEVAL
  // ==========================================

  /**
   * Get effective merged instructions for a context
   */
  async getEffectiveInstructions(
    userId: string,
    organizationId: string,
    projectId: string | null = null,
    scope: InstructionScope = 'all'
  ): Promise<EffectiveInstructions> {
    try {
      // Fetch all applicable instructions
      const [system, organization, user, project] = await Promise.all([
        this.getSystemInstructions(scope),
        this.getOrganizationInstructions(organizationId, scope),
        this.getUserInstructions(userId, scope),
        projectId ? this.getProjectInstructions(projectId, scope) : Promise.resolve([]),
      ]);

      // Build priority list (higher priority = applied later = overrides)
      const priorities: { level: InstructionLevel; key: string; priority: number }[] = [];

      // System has base priority
      for (const inst of system) {
        priorities.push({ level: 'system', key: inst.key, priority: inst.priority });
      }
      // Organization overrides system
      for (const inst of organization) {
        priorities.push({ level: 'organization', key: inst.key, priority: inst.priority + 100 });
      }
      // User overrides organization
      for (const inst of user) {
        priorities.push({ level: 'user', key: inst.key, priority: inst.priority + 200 });
      }
      // Project overrides all
      for (const inst of project) {
        priorities.push({ level: 'project', key: inst.key, priority: inst.priority + 300 });
      }

      // Sort by priority
      priorities.sort((a, b) => a.priority - b.priority);

      // Merge instructions into final text
      const merged = this.mergeInstructions(system, organization, user, project);

      // Record usage for all retrieved instructions
      const allInstructions = [...system, ...organization, ...user, ...project];
      for (const inst of allInstructions) {
        await this.recordUsage(inst.id);
      }

      return {
        system,
        organization,
        user,
        project,
        merged,
        priorities,
      };
    } catch (error: any) {
      logger.error('[InstructionService] getEffectiveInstructions failed:', error);
      return {
        system: [],
        organization: [],
        user: [],
        project: [],
        merged: '',
        priorities: [],
      };
    }
  }

  /**
   * Get system-level instructions
   */
  async getSystemInstructions(scope: InstructionScope = 'all'): Promise<AIInstruction[]> {
    try {
      const rows = await dbAll(
        `SELECT * FROM ai_instructions_system 
         WHERE is_active = 1 AND (applies_to = 'all' OR applies_to = ?)
         ORDER BY priority DESC`,
        [scope]
      );
      return rows.map((r: any) => this.mapInstructionFromDb(r, 'system', 'system'));
    } catch (error: any) {
      logger.error('[InstructionService] getSystemInstructions failed:', error);
      return [];
    }
  }

  /**
   * Get organization-level instructions
   */
  async getOrganizationInstructions(
    organizationId: string,
    scope: InstructionScope = 'all'
  ): Promise<AIInstruction[]> {
    try {
      const rows = await dbAll(
        `SELECT * FROM ai_instructions_org 
         WHERE organization_id = ? AND is_active = 1 AND (applies_to = 'all' OR applies_to = ?)
         ORDER BY priority DESC`,
        [organizationId, scope]
      );
      return rows.map((r: any) => this.mapInstructionFromDb(r, 'organization', organizationId));
    } catch (error: any) {
      logger.error('[InstructionService] getOrganizationInstructions failed:', error);
      return [];
    }
  }

  /**
   * Get user-level instructions
   */
  async getUserInstructions(userId: string, scope: InstructionScope = 'all'): Promise<AIInstruction[]> {
    try {
      const rows = await dbAll(
        `SELECT * FROM ai_instructions_user 
         WHERE user_id = ? AND is_active = 1 AND (applies_to = 'all' OR applies_to = ?)
         ORDER BY priority DESC`,
        [userId, scope]
      );
      return rows.map((r: any) => this.mapInstructionFromDb(r, 'user', userId));
    } catch (error: any) {
      logger.error('[InstructionService] getUserInstructions failed:', error);
      return [];
    }
  }

  /**
   * Get project-level instructions
   */
  async getProjectInstructions(
    projectId: string,
    scope: InstructionScope = 'all'
  ): Promise<AIInstruction[]> {
    try {
      const rows = await dbAll(
        `SELECT * FROM ai_instructions_project 
         WHERE project_id = ? AND is_active = 1 AND (applies_to = 'all' OR applies_to = ?)
         ORDER BY priority DESC`,
        [projectId, scope]
      );
      return rows.map((r: any) => this.mapInstructionFromDb(r, 'project', projectId));
    } catch (error: any) {
      logger.error('[InstructionService] getProjectInstructions failed:', error);
      return [];
    }
  }

  // ==========================================
  // INSTRUCTION MANAGEMENT
  // ==========================================

  /**
   * Add a new instruction
   */
  async addInstruction(
    level: InstructionLevel,
    levelId: string,
    key: string,
    text: string,
    options: {
      priority?: number;
      scope?: InstructionScope;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<AIInstruction | null> {
    try {
      const id = `inst-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const table = this.getTableForLevel(level);
      const idColumn = this.getIdColumnForLevel(level);

      await dbRun(
        `INSERT INTO ${table} (
          id, ${idColumn}, instruction_key, instruction_text, 
          priority, is_active, applies_to, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [
          id,
          levelId,
          key,
          text,
          options.priority ?? 0,
          options.scope || 'all',
          options.metadata ? JSON.stringify(options.metadata) : '{}',
          now,
          now,
        ]
      );

      return this.getInstruction(id, level);
    } catch (error: any) {
      logger.error('[InstructionService] addInstruction failed:', error);
      return null;
    }
  }

  /**
   * Update an instruction
   */
  async updateInstruction(
    id: string,
    level: InstructionLevel,
    updates: Partial<Pick<AIInstruction, 'text' | 'priority' | 'isActive' | 'scope' | 'metadata'>>
  ): Promise<AIInstruction | null> {
    try {
      const table = this.getTableForLevel(level);
      const setClauses: string[] = ['updated_at = ?'];
      const params: any[] = [new Date().toISOString()];

      if (updates.text !== undefined) {
        setClauses.push('instruction_text = ?');
        params.push(updates.text);
      }
      if (updates.priority !== undefined) {
        setClauses.push('priority = ?');
        params.push(updates.priority);
      }
      if (updates.isActive !== undefined) {
        setClauses.push('is_active = ?');
        params.push(updates.isActive ? 1 : 0);
      }
      if (updates.scope !== undefined) {
        setClauses.push('applies_to = ?');
        params.push(updates.scope);
      }
      if (updates.metadata !== undefined) {
        setClauses.push('metadata = ?');
        params.push(JSON.stringify(updates.metadata));
      }

      params.push(id);

      await dbRun(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = ?`, params);

      return this.getInstruction(id, level);
    } catch (error: any) {
      logger.error('[InstructionService] updateInstruction failed:', error);
      return null;
    }
  }

  /**
   * Delete an instruction
   */
  async deleteInstruction(id: string, level: InstructionLevel): Promise<boolean> {
    try {
      const table = this.getTableForLevel(level);
      await dbRun(`DELETE FROM ${table} WHERE id = ?`, [id]);
      return true;
    } catch (error: any) {
      logger.error('[InstructionService] deleteInstruction failed:', error);
      return false;
    }
  }

  /**
   * Get a single instruction
   */
  async getInstruction(id: string, level: InstructionLevel): Promise<AIInstruction | null> {
    try {
      const table = this.getTableForLevel(level);
      const idColumn = this.getIdColumnForLevel(level);
      const row = await dbGet(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      return row ? this.mapInstructionFromDb(row, level, (row as any)[idColumn]) : null;
    } catch (error: any) {
      logger.error('[InstructionService] getInstruction failed:', error);
      return null;
    }
  }

  // ==========================================
  // EFFECTIVENESS TRACKING
  // ==========================================

  /**
   * Update instruction effectiveness based on feedback
   */
  async updateInstructionEffectiveness(
    instructionId: string,
    level: InstructionLevel,
    wasHelpful: boolean
  ): Promise<void> {
    try {
      const table = this.getTableForLevel(level);
      const column = wasHelpful ? 'positive_feedback_count' : 'negative_feedback_count';

      await dbRun(
        `UPDATE ${table} 
         SET ${column} = COALESCE(${column}, 0) + 1, 
             effectiveness_score = CAST(COALESCE(positive_feedback_count, 0) AS REAL) / 
               NULLIF(COALESCE(positive_feedback_count, 0) + COALESCE(negative_feedback_count, 0), 0),
             updated_at = ?
         WHERE id = ?`,
        [new Date().toISOString(), instructionId]
      );

      logger.info(`[InstructionService] Updated effectiveness for ${instructionId}: helpful=${wasHelpful}`);
    } catch (error: any) {
      logger.error('[InstructionService] updateInstructionEffectiveness failed:', error);
    }
  }

  /**
   * Get instruction effectiveness report
   */
  async getEffectivenessReport(
    level: InstructionLevel,
    levelId: string
  ): Promise<{
    totalInstructions: number;
    avgEffectiveness: number;
    topPerforming: AIInstruction[];
    needsImprovement: AIInstruction[];
  }> {
    try {
      const table = this.getTableForLevel(level);
      const idColumn = this.getIdColumnForLevel(level);

      const stats: any = await dbGet(
        `SELECT 
           COUNT(*) as total,
           AVG(effectiveness_score) as avg_effectiveness
         FROM ${table} 
         WHERE ${idColumn} = ? AND is_active = 1`,
        [levelId]
      );

      const topPerforming = await dbAll(
        `SELECT * FROM ${table} 
         WHERE ${idColumn} = ? AND is_active = 1 AND effectiveness_score IS NOT NULL
         ORDER BY effectiveness_score DESC
         LIMIT 5`,
        [levelId]
      );

      const needsImprovement = await dbAll(
        `SELECT * FROM ${table} 
         WHERE ${idColumn} = ? AND is_active = 1 
           AND (effectiveness_score < 0.5 OR negative_feedback_count > positive_feedback_count)
         ORDER BY effectiveness_score ASC
         LIMIT 5`,
        [levelId]
      );

      return {
        totalInstructions: stats?.total || 0,
        avgEffectiveness: stats?.avg_effectiveness || 0,
        topPerforming: topPerforming.map((r: any) => this.mapInstructionFromDb(r, level, levelId)),
        needsImprovement: needsImprovement.map((r: any) => this.mapInstructionFromDb(r, level, levelId)),
      };
    } catch (error: any) {
      logger.error('[InstructionService] getEffectivenessReport failed:', error);
      return {
        totalInstructions: 0,
        avgEffectiveness: 0,
        topPerforming: [],
        needsImprovement: [],
      };
    }
  }

  /**
   * Generate improvement suggestions based on feedback patterns
   */
  async suggestInstructionImprovements(
    level: InstructionLevel,
    levelId: string
  ): Promise<InstructionSuggestion[]> {
    // This would typically use AI to analyze patterns, for now return empty
    // In production, this would analyze negative feedback patterns and suggest improvements
    logger.info(`[InstructionService] Generating suggestions for ${level}:${levelId}`);
    return [];
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private getTableForLevel(level: InstructionLevel): string {
    switch (level) {
      case 'system':
        return 'ai_instructions_system';
      case 'organization':
        return 'ai_instructions_org';
      case 'user':
        return 'ai_instructions_user';
      case 'project':
        return 'ai_instructions_project';
      default:
        throw new Error(`Unknown instruction level: ${level}`);
    }
  }

  private getIdColumnForLevel(level: InstructionLevel): string {
    switch (level) {
      case 'system':
        return 'id'; // System has no parent ID
      case 'organization':
        return 'organization_id';
      case 'user':
        return 'user_id';
      case 'project':
        return 'project_id';
      default:
        throw new Error(`Unknown instruction level: ${level}`);
    }
  }

  private mapInstructionFromDb(row: any, level: InstructionLevel, levelId: string): AIInstruction {
    return {
      id: row.id,
      level,
      levelId,
      key: row.instruction_key,
      text: row.instruction_text,
      priority: row.priority || 0,
      isActive: row.is_active === 1,
      scope: row.applies_to || 'all',
      effectivenessScore: row.effectiveness_score,
      usageCount: row.usage_count || 0,
      positiveFeedbackCount: row.positive_feedback_count || 0,
      negativeFeedbackCount: row.negative_feedback_count || 0,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mergeInstructions(
    system: AIInstruction[],
    organization: AIInstruction[],
    user: AIInstruction[],
    project: AIInstruction[]
  ): string {
    const sections: string[] = [];

    if (system.length > 0) {
      sections.push('## System Instructions');
      for (const inst of system) {
        sections.push(`- ${inst.text}`);
      }
    }

    if (organization.length > 0) {
      sections.push('\n## Organization Policies');
      for (const inst of organization) {
        sections.push(`- ${inst.text}`);
      }
    }

    if (user.length > 0) {
      sections.push('\n## User Preferences');
      for (const inst of user) {
        sections.push(`- ${inst.text}`);
      }
    }

    if (project.length > 0) {
      sections.push('\n## Project-Specific Instructions');
      for (const inst of project) {
        sections.push(`- ${inst.text}`);
      }
    }

    return sections.join('\n');
  }

  private async recordUsage(instructionId: string): Promise<void> {
    // This is a lightweight operation, skip error handling for performance
    try {
      // Note: This needs to detect the level from the ID or use a different approach
      // For now, we'll try each table
      const tables = [
        'ai_instructions_system',
        'ai_instructions_org',
        'ai_instructions_user',
        'ai_instructions_project',
      ];

      for (const table of tables) {
        await dbRun(
          `UPDATE ${table} SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = ?`,
          [instructionId]
        );
      }
    } catch {
      // Silently ignore usage tracking errors
    }
  }
}

// ==========================================
// EXPORTS
// ==========================================

export const InstructionService = InstructionServiceImpl.getInstance();
export default InstructionService;

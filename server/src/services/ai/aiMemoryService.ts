/**
 * AI Memory Service
 * FLOW-AI-001: Manage AI memory for users and organizations
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface UserMemory {
  userId: string;
  preferences: {
    language: string;
    detailLevel: 'concise' | 'detailed';
    communicationStyle: 'formal' | 'casual';
  };
  expertise: string[];
  recentTopics: string[];
  assignedProjects: string[];
  interactionCount: number;
  lastInteractionAt: string | null;
}

export interface OrgMemory {
  organizationId: string;
  industry: string;
  companySize: string;
  companyContext: Record<string, unknown>;
  terminology: Record<string, string>;
  decisionPatterns: DecisionPattern[];
  aiMaturityStage: 'sceptic' | 'partner' | 'autonomy';
}

export interface DecisionPattern {
  type: string;
  commonOutcome: string;
  frequency: number;
  lastOccurrence: string;
}

export interface AIActionsConfig {
  allowedActions: {
    suggestInitiatives: boolean;
    createDraftInitiatives: boolean;
    createTasks: boolean;
    assignTasks: boolean;
    updateTaskStatus: boolean;
    createDecisionRequests: boolean;
    makeRecommendations: boolean;
    sendNotifications: boolean;
    modifyBudgets: boolean;
    approveItems: boolean;
  };
  approvalRequired: {
    createInitiatives: boolean;
    createTasks: boolean;
    assignTasks: boolean;
  };
  autonomyLevel: 'advisory' | 'assisted' | 'autonomous';
}

// ==========================================
// SERVICE
// ==========================================

class AIMemoryService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================
  // USER MEMORY
  // ==========================================

  /**
   * Get or create user memory
   */
  async getUserMemory(userId: string): Promise<UserMemory> {
    const db = await this.getDb();

    const row = await db.get<{
      user_id: string;
      preferences: string | null;
      expertise: string | null;
      recent_topics: string | null;
      assigned_projects: string | null;
      interaction_count: number;
      last_interaction_at: string | null;
    }>('SELECT * FROM ai_user_memory WHERE user_id = ?', [userId]);

    if (row) {
      return {
        userId: row.user_id,
        preferences: row.preferences
          ? JSON.parse(row.preferences)
          : this.getDefaultUserPreferences(),
        expertise: row.expertise ? JSON.parse(row.expertise) : [],
        recentTopics: row.recent_topics ? JSON.parse(row.recent_topics) : [],
        assignedProjects: row.assigned_projects ? JSON.parse(row.assigned_projects) : [],
        interactionCount: row.interaction_count,
        lastInteractionAt: row.last_interaction_at,
      };
    }

    // Create default memory
    await this.createUserMemory(userId);
    return this.getUserMemory(userId);
  }

  /**
   * Create user memory
   */
  private async createUserMemory(userId: string): Promise<void> {
    const db = await this.getDb();
    const id = `mem-user-${uuidv4()}`;

    await db.run(
      `INSERT INTO ai_user_memory (id, user_id, preferences, expertise, recent_topics, assigned_projects)
             VALUES (?, ?, ?, '[]', '[]', '[]')`,
      [id, userId, JSON.stringify(this.getDefaultUserPreferences())]
    );
  }

  /**
   * Update user memory after interaction
   */
  async updateUserMemoryAfterInteraction(
    userId: string,
    topic?: string,
    messageCount: number = 1
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    // Get current memory
    const memory = await this.getUserMemory(userId);

    // Update recent topics
    if (topic) {
      const recentTopics = [topic, ...memory.recentTopics.filter((t) => t !== topic)].slice(0, 10);
      await db.run(
        `UPDATE ai_user_memory SET 
                    recent_topics = ?,
                    interaction_count = interaction_count + 1,
                    total_messages = total_messages + ?,
                    last_interaction_at = ?,
                    updated_at = ?
                 WHERE user_id = ?`,
        [JSON.stringify(recentTopics), messageCount, now, now, userId]
      );
    } else {
      await db.run(
        `UPDATE ai_user_memory SET 
                    interaction_count = interaction_count + 1,
                    total_messages = total_messages + ?,
                    last_interaction_at = ?,
                    updated_at = ?
                 WHERE user_id = ?`,
        [messageCount, now, now, userId]
      );
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserMemory['preferences']>
  ): Promise<void> {
    const db = await this.getDb();
    const memory = await this.getUserMemory(userId);
    const now = new Date().toISOString();

    const updatedPrefs = { ...memory.preferences, ...preferences };

    await db.run(`UPDATE ai_user_memory SET preferences = ?, updated_at = ? WHERE user_id = ?`, [
      JSON.stringify(updatedPrefs),
      now,
      userId,
    ]);
  }

  private getDefaultUserPreferences(): UserMemory['preferences'] {
    return {
      language: 'en',
      detailLevel: 'detailed',
      communicationStyle: 'formal',
    };
  }

  // ==========================================
  // ORGANIZATION MEMORY
  // ==========================================

  /**
   * Get or create organization memory
   */
  async getOrgMemory(orgId: string): Promise<OrgMemory> {
    const db = await this.getDb();

    const row = await db.get<{
      organization_id: string;
      industry: string | null;
      company_size: string | null;
      company_context: string | null;
      terminology: string | null;
      decision_patterns: string | null;
      ai_maturity_stage: string | null;
    }>('SELECT * FROM ai_org_memory WHERE organization_id = ?', [orgId]);

    if (row) {
      return {
        organizationId: row.organization_id,
        industry: row.industry || '',
        companySize: row.company_size || '',
        companyContext: row.company_context ? JSON.parse(row.company_context) : {},
        terminology: row.terminology ? JSON.parse(row.terminology) : {},
        decisionPatterns: row.decision_patterns ? JSON.parse(row.decision_patterns) : [],
        aiMaturityStage: (row.ai_maturity_stage as OrgMemory['aiMaturityStage']) || 'sceptic',
      };
    }

    // Create default memory
    await this.createOrgMemory(orgId);
    return this.getOrgMemory(orgId);
  }

  /**
   * Create organization memory
   */
  private async createOrgMemory(orgId: string): Promise<void> {
    const db = await this.getDb();
    const id = `mem-org-${uuidv4()}`;

    await db.run(
      `INSERT INTO ai_org_memory (id, organization_id, company_context, terminology, decision_patterns)
             VALUES (?, ?, '{}', '{}', '[]')`,
      [id, orgId]
    );
  }

  /**
   * Update organization memory
   */
  async updateOrgMemory(
    orgId: string,
    updates: Partial<Omit<OrgMemory, 'organizationId'>>
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: (string | null)[] = [];

    if (updates.industry !== undefined) {
      fields.push('industry = ?');
      values.push(updates.industry);
    }
    if (updates.companySize !== undefined) {
      fields.push('company_size = ?');
      values.push(updates.companySize);
    }
    if (updates.companyContext !== undefined) {
      fields.push('company_context = ?');
      values.push(JSON.stringify(updates.companyContext));
    }
    if (updates.terminology !== undefined) {
      fields.push('terminology = ?');
      values.push(JSON.stringify(updates.terminology));
    }
    if (updates.decisionPatterns !== undefined) {
      fields.push('decision_patterns = ?');
      values.push(JSON.stringify(updates.decisionPatterns));
    }
    if (updates.aiMaturityStage !== undefined) {
      fields.push('ai_maturity_stage = ?');
      values.push(updates.aiMaturityStage);
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(now);
      values.push(orgId);

      await db.run(
        `UPDATE ai_org_memory SET ${fields.join(', ')} WHERE organization_id = ?`,
        values
      );
    }
  }

  /**
   * Add decision pattern to organization memory
   */
  async recordDecisionPattern(
    orgId: string,
    pattern: Omit<DecisionPattern, 'frequency' | 'lastOccurrence'>
  ): Promise<void> {
    const memory = await this.getOrgMemory(orgId);
    const now = new Date().toISOString();

    const existingIndex = memory.decisionPatterns.findIndex(
      (p) => p.type === pattern.type && p.commonOutcome === pattern.commonOutcome
    );

    if (existingIndex >= 0) {
      memory.decisionPatterns[existingIndex].frequency++;
      memory.decisionPatterns[existingIndex].lastOccurrence = now;
    } else {
      memory.decisionPatterns.push({
        ...pattern,
        frequency: 1,
        lastOccurrence: now,
      });
    }

    // Keep only top 50 patterns
    memory.decisionPatterns.sort((a, b) => b.frequency - a.frequency);
    memory.decisionPatterns = memory.decisionPatterns.slice(0, 50);

    await this.updateOrgMemory(orgId, { decisionPatterns: memory.decisionPatterns });
  }

  // ==========================================
  // AI ACTIONS CONFIG
  // ==========================================

  /**
   * Get AI actions configuration
   */
  async getActionsConfig(orgId: string, projectId?: string): Promise<AIActionsConfig> {
    const db = await this.getDb();

    // Try project-specific first
    if (projectId) {
      const projectConfig = await db.get<{
        allowed_actions: string;
        approval_required: string;
        autonomy_level: string;
      }>(
        `SELECT allowed_actions, approval_required, autonomy_level 
                 FROM ai_actions_config 
                 WHERE organization_id = ? AND project_id = ?`,
        [orgId, projectId]
      );

      if (projectConfig) {
        return {
          allowedActions: JSON.parse(projectConfig.allowed_actions),
          approvalRequired: JSON.parse(projectConfig.approval_required),
          autonomyLevel: projectConfig.autonomy_level as AIActionsConfig['autonomyLevel'],
        };
      }
    }

    // Fall back to org-wide config
    const orgConfig = await db.get<{
      allowed_actions: string;
      approval_required: string;
      autonomy_level: string;
    }>(
      `SELECT allowed_actions, approval_required, autonomy_level 
             FROM ai_actions_config 
             WHERE organization_id = ? AND project_id IS NULL`,
      [orgId]
    );

    if (orgConfig) {
      return {
        allowedActions: JSON.parse(orgConfig.allowed_actions),
        approvalRequired: JSON.parse(orgConfig.approval_required),
        autonomyLevel: orgConfig.autonomy_level as AIActionsConfig['autonomyLevel'],
      };
    }

    // Return defaults
    return this.getDefaultActionsConfig();
  }

  /**
   * Update AI actions configuration
   */
  async updateActionsConfig(
    orgId: string,
    userId: string,
    config: Partial<AIActionsConfig>,
    projectId?: string
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const id = `config-${uuidv4()}`;

    const current = await this.getActionsConfig(orgId, projectId);
    const updated = {
      allowedActions: { ...current.allowedActions, ...config.allowedActions },
      approvalRequired: { ...current.approvalRequired, ...config.approvalRequired },
      autonomyLevel: config.autonomyLevel || current.autonomyLevel,
    };

    await db.run(
      `INSERT OR REPLACE INTO ai_actions_config 
             (id, organization_id, project_id, allowed_actions, approval_required, autonomy_level, created_by, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        projectId || null,
        JSON.stringify(updated.allowedActions),
        JSON.stringify(updated.approvalRequired),
        updated.autonomyLevel,
        userId,
        now,
      ]
    );

    logger.info(
      `[AIMemoryService] Updated actions config for org ${orgId}${projectId ? ` project ${projectId}` : ''}`
    );
  }

  private getDefaultActionsConfig(): AIActionsConfig {
    return {
      allowedActions: {
        suggestInitiatives: true,
        createDraftInitiatives: false,
        createTasks: false,
        assignTasks: false,
        updateTaskStatus: false,
        createDecisionRequests: false,
        makeRecommendations: true,
        sendNotifications: false,
        modifyBudgets: false,
        approveItems: false,
      },
      approvalRequired: {
        createInitiatives: true,
        createTasks: true,
        assignTasks: true,
      },
      autonomyLevel: 'advisory',
    };
  }

  // ==========================================
  // BUILD CONTEXT FOR PROMPT
  // ==========================================

  /**
   * Build full context for AI prompt
   */
  async buildPromptContext(
    userId: string,
    orgId: string,
    conversationContext?: { type: string; id: string }
  ): Promise<{
    userMemory: UserMemory;
    orgMemory: OrgMemory;
    actionsConfig: AIActionsConfig;
    systemInstructions: string[];
    orgInstructions: string[];
  }> {
    const db = await this.getDb();

    const [userMemory, orgMemory, actionsConfig] = await Promise.all([
      this.getUserMemory(userId),
      this.getOrgMemory(orgId),
      this.getActionsConfig(orgId, conversationContext?.id),
    ]);

    // Get system instructions
    const systemInstr = await db.all<{ instruction: string }>(
      `SELECT instruction FROM ai_instructions_system 
             WHERE is_active = 1 
             ORDER BY priority DESC`,
      []
    );

    // Get org instructions
    const orgInstr = await db.all<{ instruction: string }>(
      `SELECT instruction FROM ai_instructions_org 
             WHERE organization_id = ? AND is_active = 1 
             ORDER BY priority DESC`,
      [orgId]
    );

    return {
      userMemory,
      orgMemory,
      actionsConfig,
      systemInstructions: (systemInstr || []).map((i) => i.instruction),
      orgInstructions: (orgInstr || []).map((i) => i.instruction),
    };
  }
}

// Export singleton
const aiMemoryService = new AIMemoryService();
export default aiMemoryService;

// Named exports
export const getUserMemory = (userId: string) => aiMemoryService.getUserMemory(userId);
export const getOrgMemory = (orgId: string) => aiMemoryService.getOrgMemory(orgId);
export const updateUserMemoryAfterInteraction = (
  userId: string,
  topic?: string,
  msgCount?: number
) => aiMemoryService.updateUserMemoryAfterInteraction(userId, topic, msgCount);
export const updateUserPreferences = (userId: string, prefs: Partial<UserMemory['preferences']>) =>
  aiMemoryService.updateUserPreferences(userId, prefs);
export const updateOrgMemory = (
  orgId: string,
  updates: Partial<Omit<OrgMemory, 'organizationId'>>
) => aiMemoryService.updateOrgMemory(orgId, updates);
export const getActionsConfig = (orgId: string, projectId?: string) =>
  aiMemoryService.getActionsConfig(orgId, projectId);
export const updateActionsConfig = (
  orgId: string,
  userId: string,
  config: Partial<AIActionsConfig>,
  projectId?: string
) => aiMemoryService.updateActionsConfig(orgId, userId, config, projectId);
export const buildPromptContext = (
  userId: string,
  orgId: string,
  ctx?: { type: string; id: string }
) => aiMemoryService.buildPromptContext(userId, orgId, ctx);

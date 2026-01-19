/**
 * Knowledge Hub Service
 * 
 * Central repository for organization facts and cross-project insights.
 * Manages knowledge extraction, storage, and retrieval for AI context.
 * 
 * @version 1.0.0
 */

import crypto from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface KnowledgeFact {
  id: string;
  organizationId: string;
  category: 'company' | 'market' | 'technical' | 'process' | 'stakeholder' | 'competitor' | 'custom';
  subcategory?: string;
  title: string;
  content: string;
  sourceType: 'manual' | 'extracted' | 'conversation' | 'document';
  sourceId?: string;
  confidence: number;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  metadata?: Record<string, any>;
  usageCount: number;
  lastUsedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrossProjectInsight {
  id: string;
  organizationId: string;
  insightType: 'pattern' | 'risk' | 'opportunity' | 'lesson';
  title: string;
  description: string;
  sourceProjects: string[];
  applicability: 'all' | 'similar' | 'specific';
  impactLevel: 'low' | 'medium' | 'high';
  confidence: number;
  supportingData?: Record<string, any>;
  recommendations?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeCategory {
  id: string;
  organizationId?: string;
  parentId?: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  isSystem: boolean;
}

export interface AddFactOptions {
  subcategory?: string;
  sourceType?: KnowledgeFact['sourceType'];
  sourceId?: string;
  confidence?: number;
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface ExtractionResult {
  factsExtracted: number;
  insightsExtracted: number;
  facts: KnowledgeFact[];
  insights: CrossProjectInsight[];
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class KnowledgeHubServiceImpl {
  private static instance: KnowledgeHubServiceImpl;

  private constructor() {}

  public static getInstance(): KnowledgeHubServiceImpl {
    if (!KnowledgeHubServiceImpl.instance) {
      KnowledgeHubServiceImpl.instance = new KnowledgeHubServiceImpl();
    }
    return KnowledgeHubServiceImpl.instance;
  }

  // ==========================================
  // KNOWLEDGE FACTS
  // ==========================================

  /**
   * Get all knowledge facts for an organization
   */
  async getOrganizationKnowledge(
    organizationId: string,
    options: {
      category?: string;
      verified?: boolean;
      limit?: number;
    } = {}
  ): Promise<KnowledgeFact[]> {
    try {
      let sql = `
        SELECT * FROM ai_knowledge_facts 
        WHERE organization_id = ?
      `;
      const params: any[] = [organizationId];

      if (options.category) {
        sql += ` AND category = ?`;
        params.push(options.category);
      }

      if (options.verified !== undefined) {
        sql += ` AND is_verified = ?`;
        params.push(options.verified ? 1 : 0);
      }

      sql += ` ORDER BY usage_count DESC, created_at DESC`;

      if (options.limit) {
        sql += ` LIMIT ?`;
        params.push(options.limit);
      }

      const rows = await dbAll(sql, params);
      return rows.map(this.mapFactFromDb);
    } catch (error: any) {
      logger.error('[KnowledgeHubService] getOrganizationKnowledge failed:', error);
      return [];
    }
  }

  /**
   * Get a single fact by ID
   */
  async getFact(factId: string): Promise<KnowledgeFact | null> {
    try {
      const row = await dbGet(
        `SELECT * FROM ai_knowledge_facts WHERE id = ?`,
        [factId]
      );
      return row ? this.mapFactFromDb(row) : null;
    } catch (error: any) {
      logger.error('[KnowledgeHubService] getFact failed:', error);
      return null;
    }
  }

  /**
   * Add a new knowledge fact
   */
  async addFact(
    organizationId: string,
    category: KnowledgeFact['category'],
    title: string,
    content: string,
    options: AddFactOptions = {}
  ): Promise<KnowledgeFact | null> {
    try {
      const id = `fact-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await dbRun(
        `INSERT INTO ai_knowledge_facts (
          id, organization_id, category, subcategory, title, content,
          source_type, source_id, confidence, metadata, created_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          organizationId,
          category,
          options.subcategory || null,
          title,
          content,
          options.sourceType || 'manual',
          options.sourceId || null,
          options.confidence ?? 1.0,
          options.metadata ? JSON.stringify(options.metadata) : '{}',
          options.createdBy || null,
          now,
          now,
        ]
      );

      return this.getFact(id);
    } catch (error: any) {
      logger.error('[KnowledgeHubService] addFact failed:', error);
      return null;
    }
  }

  /**
   * Update an existing fact
   */
  async updateFact(
    factId: string,
    updates: Partial<Pick<KnowledgeFact, 'title' | 'content' | 'category' | 'subcategory' | 'confidence' | 'metadata'>>
  ): Promise<KnowledgeFact | null> {
    try {
      const setClauses: string[] = ['updated_at = ?'];
      const params: any[] = [new Date().toISOString()];

      if (updates.title !== undefined) {
        setClauses.push('title = ?');
        params.push(updates.title);
      }
      if (updates.content !== undefined) {
        setClauses.push('content = ?');
        params.push(updates.content);
      }
      if (updates.category !== undefined) {
        setClauses.push('category = ?');
        params.push(updates.category);
      }
      if (updates.subcategory !== undefined) {
        setClauses.push('subcategory = ?');
        params.push(updates.subcategory);
      }
      if (updates.confidence !== undefined) {
        setClauses.push('confidence = ?');
        params.push(updates.confidence);
      }
      if (updates.metadata !== undefined) {
        setClauses.push('metadata = ?');
        params.push(JSON.stringify(updates.metadata));
      }

      params.push(factId);

      await dbRun(
        `UPDATE ai_knowledge_facts SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );

      return this.getFact(factId);
    } catch (error: any) {
      logger.error('[KnowledgeHubService] updateFact failed:', error);
      return null;
    }
  }

  /**
   * Delete a fact
   */
  async deleteFact(factId: string): Promise<boolean> {
    try {
      await dbRun(`DELETE FROM ai_knowledge_facts WHERE id = ?`, [factId]);
      return true;
    } catch (error: any) {
      logger.error('[KnowledgeHubService] deleteFact failed:', error);
      return false;
    }
  }

  /**
   * Verify a fact
   */
  async verifyFact(factId: string, userId: string, verified: boolean): Promise<KnowledgeFact | null> {
    try {
      const now = new Date().toISOString();
      await dbRun(
        `UPDATE ai_knowledge_facts 
         SET is_verified = ?, verified_by = ?, verified_at = ?, updated_at = ?
         WHERE id = ?`,
        [verified ? 1 : 0, userId, verified ? now : null, now, factId]
      );
      return this.getFact(factId);
    } catch (error: any) {
      logger.error('[KnowledgeHubService] verifyFact failed:', error);
      return null;
    }
  }

  /**
   * Record fact usage (for relevance tracking)
   */
  async recordFactUsage(factId: string): Promise<void> {
    try {
      await dbRun(
        `UPDATE ai_knowledge_facts 
         SET usage_count = usage_count + 1, last_used_at = ?
         WHERE id = ?`,
        [new Date().toISOString(), factId]
      );
    } catch (error: any) {
      logger.error('[KnowledgeHubService] recordFactUsage failed:', error);
    }
  }

  // ==========================================
  // KNOWLEDGE EXTRACTION
  // ==========================================

  /**
   * Extract facts from an initiative
   */
  async extractFactsFromInitiative(
    initiative: any,
    organizationId: string
  ): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      factsExtracted: 0,
      insightsExtracted: 0,
      facts: [],
      insights: [],
    };

    try {
      // Extract business goals
      if (initiative.business_goals) {
        const goals = typeof initiative.business_goals === 'string' 
          ? JSON.parse(initiative.business_goals) 
          : initiative.business_goals;
        
        if (Array.isArray(goals)) {
          for (const goal of goals) {
            const fact = await this.addFact(
              organizationId,
              'company',
              `Business Goal: ${goal.name || goal}`,
              typeof goal === 'string' ? goal : JSON.stringify(goal),
              {
                sourceType: 'extracted',
                sourceId: initiative.id,
                confidence: 0.8,
                metadata: { initiativeId: initiative.id, initiativeName: initiative.name },
              }
            );
            if (fact) {
              result.facts.push(fact);
              result.factsExtracted++;
            }
          }
        }
      }

      // Extract key stakeholders
      if (initiative.stakeholders) {
        const stakeholders = typeof initiative.stakeholders === 'string'
          ? JSON.parse(initiative.stakeholders)
          : initiative.stakeholders;

        if (Array.isArray(stakeholders)) {
          for (const stakeholder of stakeholders) {
            const fact = await this.addFact(
              organizationId,
              'stakeholder',
              `Stakeholder: ${stakeholder.name || stakeholder.role}`,
              JSON.stringify(stakeholder),
              {
                sourceType: 'extracted',
                sourceId: initiative.id,
                confidence: 0.9,
                metadata: { initiativeId: initiative.id },
              }
            );
            if (fact) {
              result.facts.push(fact);
              result.factsExtracted++;
            }
          }
        }
      }

      // Log extraction
      await this.logExtraction(organizationId, 'initiative', initiative.id, result);

    } catch (error: any) {
      logger.error('[KnowledgeHubService] extractFactsFromInitiative failed:', error);
    }

    return result;
  }

  /**
   * Extract facts from an assessment
   */
  async extractFactsFromAssessment(
    assessment: any,
    organizationId: string
  ): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      factsExtracted: 0,
      insightsExtracted: 0,
      facts: [],
      insights: [],
    };

    try {
      // Extract maturity levels
      if (assessment.maturity_scores) {
        const scores = typeof assessment.maturity_scores === 'string'
          ? JSON.parse(assessment.maturity_scores)
          : assessment.maturity_scores;

        for (const [axis, score] of Object.entries(scores)) {
          const fact = await this.addFact(
            organizationId,
            'company',
            `Maturity Level: ${axis}`,
            `Current maturity level for ${axis}: ${score}/5`,
            {
              sourceType: 'extracted',
              sourceId: assessment.id,
              confidence: 0.95,
              metadata: { assessmentId: assessment.id, axis, score },
            }
          );
          if (fact) {
            result.facts.push(fact);
            result.factsExtracted++;
          }
        }
      }

      // Extract gaps and recommendations
      if (assessment.gaps) {
        const gaps = typeof assessment.gaps === 'string'
          ? JSON.parse(assessment.gaps)
          : assessment.gaps;

        if (Array.isArray(gaps)) {
          for (const gap of gaps) {
            const fact = await this.addFact(
              organizationId,
              'process',
              `Gap: ${gap.area || gap.title || 'Process Gap'}`,
              gap.description || JSON.stringify(gap),
              {
                sourceType: 'extracted',
                sourceId: assessment.id,
                confidence: 0.85,
                metadata: { assessmentId: assessment.id },
              }
            );
            if (fact) {
              result.facts.push(fact);
              result.factsExtracted++;
            }
          }
        }
      }

      // Log extraction
      await this.logExtraction(organizationId, 'assessment', assessment.id, result);

    } catch (error: any) {
      logger.error('[KnowledgeHubService] extractFactsFromAssessment failed:', error);
    }

    return result;
  }

  /**
   * Extract facts from a conversation
   */
  async extractFactsFromConversation(
    conversationId: string,
    organizationId: string,
    messages: { role: string; content: string }[]
  ): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      factsExtracted: 0,
      insightsExtracted: 0,
      facts: [],
      insights: [],
    };

    try {
      // Simple pattern-based extraction (could be enhanced with AI)
      const patterns = [
        { regex: /our company (?:is|was|has been) (.+?)(?:\.|,|$)/gi, category: 'company' as const },
        { regex: /we (?:use|utilize|implement) (.+?) (?:for|to|in)/gi, category: 'technical' as const },
        { regex: /our (?:main|key|primary) competitor(?:s)? (?:is|are) (.+?)(?:\.|,|$)/gi, category: 'competitor' as const },
        { regex: /our market (?:is|includes|covers) (.+?)(?:\.|,|$)/gi, category: 'market' as const },
      ];

      const userMessages = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.regex.exec(userMessages)) !== null) {
          const fact = await this.addFact(
            organizationId,
            pattern.category,
            `Extracted: ${match[1].substring(0, 50)}`,
            match[1],
            {
              sourceType: 'conversation',
              sourceId: conversationId,
              confidence: 0.6, // Lower confidence for pattern extraction
              metadata: { conversationId },
            }
          );
          if (fact) {
            result.facts.push(fact);
            result.factsExtracted++;
          }
        }
      }

      if (result.factsExtracted > 0) {
        await this.logExtraction(organizationId, 'conversation', conversationId, result);
      }

    } catch (error: any) {
      logger.error('[KnowledgeHubService] extractFactsFromConversation failed:', error);
    }

    return result;
  }

  // ==========================================
  // CROSS-PROJECT INSIGHTS
  // ==========================================

  /**
   * Get cross-project insights
   */
  async getCrossProjectInsights(
    organizationId: string,
    options: {
      type?: CrossProjectInsight['insightType'];
      active?: boolean;
      limit?: number;
    } = {}
  ): Promise<CrossProjectInsight[]> {
    try {
      let sql = `
        SELECT * FROM ai_cross_project_insights 
        WHERE organization_id = ?
      `;
      const params: any[] = [organizationId];

      if (options.type) {
        sql += ` AND insight_type = ?`;
        params.push(options.type);
      }

      if (options.active !== undefined) {
        sql += ` AND is_active = ?`;
        params.push(options.active ? 1 : 0);
      }

      sql += ` ORDER BY impact_level DESC, confidence DESC`;

      if (options.limit) {
        sql += ` LIMIT ?`;
        params.push(options.limit);
      }

      const rows = await dbAll(sql, params);
      return rows.map(this.mapInsightFromDb);
    } catch (error: any) {
      logger.error('[KnowledgeHubService] getCrossProjectInsights failed:', error);
      return [];
    }
  }

  /**
   * Add a cross-project insight
   */
  async addInsight(
    organizationId: string,
    type: CrossProjectInsight['insightType'],
    title: string,
    description: string,
    sourceProjects: string[],
    options: {
      applicability?: CrossProjectInsight['applicability'];
      impactLevel?: CrossProjectInsight['impactLevel'];
      confidence?: number;
      supportingData?: Record<string, any>;
      recommendations?: string[];
    } = {}
  ): Promise<CrossProjectInsight | null> {
    try {
      const id = `insight-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await dbRun(
        `INSERT INTO ai_cross_project_insights (
          id, organization_id, insight_type, title, description,
          source_projects, applicability, impact_level, confidence,
          supporting_data, recommendations, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          organizationId,
          type,
          title,
          description,
          JSON.stringify(sourceProjects),
          options.applicability || 'all',
          options.impactLevel || 'medium',
          options.confidence ?? 0.8,
          options.supportingData ? JSON.stringify(options.supportingData) : '{}',
          options.recommendations ? JSON.stringify(options.recommendations) : '[]',
          now,
          now,
        ]
      );

      const row = await dbGet(
        `SELECT * FROM ai_cross_project_insights WHERE id = ?`,
        [id]
      );
      return row ? this.mapInsightFromDb(row) : null;
    } catch (error: any) {
      logger.error('[KnowledgeHubService] addInsight failed:', error);
      return null;
    }
  }

  /**
   * Aggregate insights across projects
   */
  async aggregateCrossProjectInsights(organizationId: string): Promise<void> {
    try {
      // Get all projects for organization
      const projects = await dbAll(
        `SELECT id, name, current_phase, status FROM projects 
         WHERE organization_id = ? AND is_closed = 0`,
        [organizationId]
      );

      if (projects.length < 2) {
        logger.info('[KnowledgeHubService] Not enough projects for cross-project insights');
        return;
      }

      // Find common patterns in project statuses
      const statusCounts: Record<string, string[]> = {};
      for (const project of projects) {
        const status = (project as any).status || 'unknown';
        if (!statusCounts[status]) statusCounts[status] = [];
        statusCounts[status].push((project as any).id);
      }

      // Create insight for common patterns
      for (const [status, projectIds] of Object.entries(statusCounts)) {
        if (projectIds.length >= 2) {
          await this.addInsight(
            organizationId,
            'pattern',
            `Common Status Pattern: ${status}`,
            `${projectIds.length} projects share the status "${status}"`,
            projectIds,
            {
              applicability: 'similar',
              impactLevel: 'medium',
              confidence: 0.7,
              supportingData: { status, count: projectIds.length },
            }
          );
        }
      }

      logger.info(`[KnowledgeHubService] Aggregated insights for org ${organizationId}`);
    } catch (error: any) {
      logger.error('[KnowledgeHubService] aggregateCrossProjectInsights failed:', error);
    }
  }

  // ==========================================
  // CATEGORIES
  // ==========================================

  /**
   * Get knowledge categories
   */
  async getCategories(organizationId?: string): Promise<KnowledgeCategory[]> {
    try {
      const rows = await dbAll(
        `SELECT * FROM ai_knowledge_categories 
         WHERE organization_id IS NULL OR organization_id = ?
         ORDER BY sort_order ASC`,
        [organizationId || null]
      );
      return rows.map((row: any) => ({
        id: row.id,
        organizationId: row.organization_id,
        parentId: row.parent_id,
        name: row.name,
        description: row.description,
        icon: row.icon,
        color: row.color,
        sortOrder: row.sort_order,
        isSystem: row.is_system === 1,
      }));
    } catch (error: any) {
      logger.error('[KnowledgeHubService] getCategories failed:', error);
      return [];
    }
  }

  // ==========================================
  // CONTEXT BUILDING
  // ==========================================

  /**
   * Build knowledge context for AI prompts
   */
  async buildKnowledgeContext(
    organizationId: string,
    options: {
      projectId?: string;
      maxFacts?: number;
      maxInsights?: number;
      categories?: string[];
    } = {}
  ): Promise<{
    facts: KnowledgeFact[];
    insights: CrossProjectInsight[];
    summary: string;
  }> {
    try {
      // Get relevant facts
      let facts: KnowledgeFact[] = [];
      
      if (options.categories && options.categories.length > 0) {
        for (const category of options.categories) {
          const categoryFacts = await this.getOrganizationKnowledge(organizationId, {
            category,
            verified: true,
            limit: Math.floor((options.maxFacts || 20) / options.categories.length),
          });
          facts = facts.concat(categoryFacts);
        }
      } else {
        facts = await this.getOrganizationKnowledge(organizationId, {
          verified: true,
          limit: options.maxFacts || 20,
        });
      }

      // Get relevant insights
      const insights = await this.getCrossProjectInsights(organizationId, {
        active: true,
        limit: options.maxInsights || 10,
      });

      // Record usage for retrieved facts
      for (const fact of facts) {
        await this.recordFactUsage(fact.id);
      }

      // Build summary
      const summary = this.buildContextSummary(facts, insights);

      return { facts, insights, summary };
    } catch (error: any) {
      logger.error('[KnowledgeHubService] buildKnowledgeContext failed:', error);
      return { facts: [], insights: [], summary: '' };
    }
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private mapFactFromDb(row: any): KnowledgeFact {
    return {
      id: row.id,
      organizationId: row.organization_id,
      category: row.category,
      subcategory: row.subcategory,
      title: row.title,
      content: row.content,
      sourceType: row.source_type,
      sourceId: row.source_id,
      confidence: row.confidence,
      isVerified: row.is_verified === 1,
      verifiedBy: row.verified_by,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      usageCount: row.usage_count || 0,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapInsightFromDb(row: any): CrossProjectInsight {
    return {
      id: row.id,
      organizationId: row.organization_id,
      insightType: row.insight_type,
      title: row.title,
      description: row.description,
      sourceProjects: row.source_projects ? JSON.parse(row.source_projects) : [],
      applicability: row.applicability,
      impactLevel: row.impact_level,
      confidence: row.confidence,
      supportingData: row.supporting_data ? JSON.parse(row.supporting_data) : {},
      recommendations: row.recommendations ? JSON.parse(row.recommendations) : [],
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async logExtraction(
    organizationId: string,
    sourceType: string,
    sourceId: string,
    result: ExtractionResult
  ): Promise<void> {
    try {
      await dbRun(
        `INSERT INTO ai_knowledge_extraction_log (
          id, organization_id, source_type, source_id, 
          facts_extracted, insights_extracted, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
        [
          `log-${crypto.randomUUID()}`,
          organizationId,
          sourceType,
          sourceId,
          result.factsExtracted,
          result.insightsExtracted,
          new Date().toISOString(),
        ]
      );
    } catch (error: any) {
      logger.warn('[KnowledgeHubService] Failed to log extraction:', error.message);
    }
  }

  private buildContextSummary(facts: KnowledgeFact[], insights: CrossProjectInsight[]): string {
    const lines: string[] = [];

    if (facts.length > 0) {
      lines.push('## Organization Knowledge');
      
      // Group by category
      const byCategory: Record<string, KnowledgeFact[]> = {};
      for (const fact of facts) {
        if (!byCategory[fact.category]) byCategory[fact.category] = [];
        byCategory[fact.category].push(fact);
      }

      for (const [category, categoryFacts] of Object.entries(byCategory)) {
        lines.push(`\n### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
        for (const fact of categoryFacts.slice(0, 5)) {
          lines.push(`- ${fact.title}: ${fact.content.substring(0, 100)}...`);
        }
      }
    }

    if (insights.length > 0) {
      lines.push('\n## Cross-Project Insights');
      for (const insight of insights.slice(0, 5)) {
        lines.push(`- [${insight.insightType.toUpperCase()}] ${insight.title}`);
      }
    }

    return lines.join('\n');
  }
}

// ==========================================
// EXPORTS
// ==========================================

export const KnowledgeHubService = KnowledgeHubServiceImpl.getInstance();
export default KnowledgeHubService;

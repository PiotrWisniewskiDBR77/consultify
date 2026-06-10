/**
 * Initiative Section AI Generation Service
 *
 * Generates content for initiative sections using AI prompts
 * defined in initiative_section_types.ai_prompt_template.
 *
 * Pattern follows reportGenerationService.ts
 */

import { getDatabase } from '../database/Database.js';
import DbPromise from '../utils/DbPromise.js';
import { AppError } from '../utils/ErrorHandler.js';
import logger from '../utils/Logger.js';
import initiativeSectionTypeService from './initiativeSectionTypeService.js';

// ==========================================
// TYPES
// ==========================================

export interface GenerationContext {
  initiativeId: string;
  initiativeName: string;
  summary?: string;
  problemStatement?: string;
  category?: string;
  module?: string;
  status?: string;
  currentPhase?: string;
  targetState?: string;
  scope?: string;
  benefits?: string;
  kpis?: string;
  timeline?: string;
  phases?: string;
  completedTasks?: number;
  totalTasks?: number;
  openRisks?: number;
  openDecisions?: number;
  language: 'en' | 'pl';
  [key: string]: any;
}

export interface GenerationResult {
  content: string;
  isJson: boolean;
  parsedContent?: any;
  tokensUsed: number;
  model: string;
}

// ==========================================
// LLM SERVICE
// ==========================================

let _llmServiceInstance: any = null;

async function getLLMServiceInstance(): Promise<any> {
  if (_llmServiceInstance) return _llmServiceInstance;
  try {
    const mod = await import('./ai/llmService.js');
    _llmServiceInstance = mod.llmService || mod.default;
    return _llmServiceInstance;
  } catch (err) {
    logger.warn('[InitiativeGeneration] LLM Service not available');
    return null;
  }
}

// ==========================================
// TEMPLATE INTERPOLATION
// ==========================================

function interpolateTemplate(template: string, context: GenerationContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = context[key];
    if (value === undefined || value === null) return `[not provided]`;
    // Make language explicit for LLMs (templates often use: "Language: {{language}}")
    if (key === 'language') {
      const lang = String(value).toLowerCase().trim();
      if (lang === 'pl' || lang === 'polish') return 'Polish';
      if (lang === 'en' || lang === 'english') return 'English';
      return String(value);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

// ==========================================
// SERVICE
// ==========================================

export class InitiativeGenerationService {
  private db;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Generate content for a specific initiative section using AI
   */
  async generateSectionContent(
    sectionKey: string,
    context: GenerationContext,
    organizationId?: string
  ): Promise<GenerationResult> {
    // 1. Get section type definition (with prompt template)
    let sectionType: any = null;
    try {
      sectionType = await initiativeSectionTypeService.getSectionTypeByKey(
        sectionKey,
        organizationId || undefined
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      // If schema/migrations are missing, do not 500 — be explicit and honest.
      if (msg.includes('no such table') || msg.includes('SQLITE_ERROR')) {
        throw new AppError(
          'Initiative section types are not available (schema missing)',
          503,
          'FEATURE_UNAVAILABLE',
          { message: msg }
        );
      }
      throw err;
    }

    if (!sectionType) {
      throw new Error(`Section type "${sectionKey}" not found`);
    }

    const promptTemplate = sectionType.aiPromptTemplate;
    if (!promptTemplate) {
      throw new AppError(
        `AI prompt template is not configured for section "${sectionKey}"`,
        503,
        'FEATURE_UNAVAILABLE'
      );
    }

    // 2. Enrich context with initiative data from DB
    const enrichedContext = await this.enrichContext(context);

    // 3. Interpolate template
    const userPrompt = interpolateTemplate(promptTemplate, enrichedContext);

    // 4. Call LLM
    const systemPrompt = `You are an expert strategic initiative advisor helping to build comprehensive initiative documentation. 
You generate high-quality, actionable content tailored to the specific section being requested.
When asked to return JSON, return ONLY valid JSON with no additional text or markdown formatting.
When asked to write in Polish, use professional business Polish.`;

    const llm = await getLLMServiceInstance();
    if (!llm) {
      const name = context.initiativeName || 'Initiative';
      const lang = String(context.language || 'en').toLowerCase();
      const content =
        lang === 'pl' || lang === 'polish'
          ? `Uzupełnij sekcję "${sectionKey}" dla inicjatywy "${name}". (Placeholder — moduł AI/LLM nie jest skonfigurowany lub niedostępny.)`
          : `Fill in section "${sectionKey}" for initiative "${name}". (Placeholder — AI/LLM is not configured or unavailable.)`;

      return {
        content,
        isJson: false,
        parsedContent: undefined,
        tokensUsed: 0,
        model: 'placeholder',
      };
    }

    try {
      const result = await llm.call({
        type: 'text',
        modelConfig: { id: 'standard' },
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 4096,
        temperature: 0.7,
        cache: true,
        cacheTtl: 3600,
      });

      const content = String(result?.content || '');
      const usage = (result?.usage || {}) as Record<string, number>;
      const tokensUsed =
        usage.totalTokens || usage.completionTokens || Math.floor(content.length / 4);
      const model = String(result?.model || result?.modelId || 'llm-standard');

      // Try to parse as JSON if the prompt requests it
      const isJson = promptTemplate.includes('Return valid JSON');
      let parsedContent: any = undefined;

      if (isJson) {
        try {
          // Extract JSON from potential markdown code blocks
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
          parsedContent = JSON.parse(jsonMatch[1] || content);
        } catch {
          // Content might not be valid JSON - return as-is
          parsedContent = undefined;
        }
      }

      return {
        content,
        isJson,
        parsedContent,
        tokensUsed,
        model,
      };
    } catch (err: any) {
      logger.error('[InitiativeGeneration] LLM call failed:', err?.message || err);
      if (err instanceof AppError) throw err;
      throw new AppError('AI initiative generation failed', 503, 'FEATURE_UNAVAILABLE', {
        message: err?.message || String(err),
      });
    }
  }

  /**
   * Get AI suggestions for which sections to enable based on initiative context
   */
  async suggestSections(
    context: GenerationContext,
    organizationId?: string
  ): Promise<{ key: string; reason: string; priority: 'high' | 'medium' | 'low' }[]> {
    const llm = await getLLMServiceInstance();
    if (!llm) {
      return [
        {
          key: 'overview',
          reason: 'Core summary for stakeholders and context',
          priority: 'high',
        },
        {
          key: 'tasks',
          reason: 'Concrete execution plan and ownership',
          priority: 'medium',
        },
        {
          key: 'decisions',
          reason: 'Key decisions and approvals required to proceed',
          priority: 'medium',
        },
      ];
    }

    // Get all available section types
    let allSections: any[] = [];
    try {
      allSections = await initiativeSectionTypeService.getAllSectionTypes(
        organizationId || undefined
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      if (msg.includes('no such table') || msg.includes('SQLITE_ERROR')) {
        throw new AppError(
          'Initiative section types are not available (schema missing)',
          503,
          'FEATURE_UNAVAILABLE',
          { message: msg }
        );
      }
      throw err;
    }

    const langName = context.language === 'pl' ? 'Polish' : 'English';
    const prompt = `Given this initiative context, suggest which sections should be enabled and their priority.

Initiative: ${context.initiativeName}
Description: ${context.summary || 'Not yet defined'}
Category: ${context.category || 'general'}
Module: ${context.module || 'general'}
Language: ${langName}

Available sections:
${allSections.map((s) => `- ${s.key}: ${s.name} (${s.description || 'No description'})`).join('\n')}

Return a JSON array of section suggestions:
[{ "key": "section_key", "reason": "Why this section is important", "priority": "high|medium|low" }]

Only include sections that are truly relevant. Order by priority.
Respond in the requested language only.
Return valid JSON array only.`;

    try {
      const result = await llm.call({
        type: 'text',
        modelConfig: { id: 'standard' },
        systemPrompt: `You are an expert in initiative planning. Suggest relevant sections based on context. Respond in ${langName}.`,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2048,
        temperature: 0.5,
        cache: true,
      });

      const content = String(result?.content || '[]');
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
      return JSON.parse(jsonMatch[1] || content);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      logger.error('[InitiativeGeneration] suggestSections failed:', msg);
      if (err instanceof AppError) throw err;
      throw new AppError('AI section suggestions failed', 503, 'FEATURE_UNAVAILABLE', {
        message: msg,
      });
    }
  }

  /**
   * Enrich context with data from the database
   */
  private async enrichContext(context: GenerationContext): Promise<GenerationContext> {
    if (!context.initiativeId) return context;

    try {
      // Get initiative data
      const initiative = await DbPromise.get<any>(
        this.db,
        'SELECT * FROM initiatives WHERE id = ?',
        [context.initiativeId]
      );

      if (initiative) {
        return {
          ...context,
          initiativeName: context.initiativeName || initiative.name,
          summary: context.summary || initiative.summary || initiative.description,
          problemStatement: context.problemStatement || initiative.problem_statement,
          category: context.category || initiative.category,
          module: context.module || initiative.module,
          status: context.status || initiative.status,
          currentPhase: context.currentPhase || initiative.current_phase,
          language: context.language || 'en',
        };
      }
    } catch (err: any) {
      logger.warn('[InitiativeGeneration] Failed to enrich context:', err.message);
    }

    return context;
  }

  /**
   * Dependency injection for tests
   */
  setDependencies(deps: { db?: any }) {
    if (deps.db) this.db = deps.db;
  }
}

export default new InitiativeGenerationService();

/**
 * Teresa last-mile (backlog #1): create a REAL initiative from a Teresa handoff.
 *
 * Exported as a NAMED function because `teresaCopilotService.handleInitiativesHandoff`
 * looks for `createInitiative` on this module. Previously no such export existed
 * (the module only default-exports a generation class), so the handoff silently
 * fell back to a synthetic UUID (`real_entity:false`). This delegates to the
 * canonical `InitiativeService` so a real `initiatives` row is written.
 */
export async function createInitiative(params: {
  organizationId: string;
  title?: unknown;
  description?: unknown;
  source?: string;
  proposalId?: string;
}): Promise<{ id: string }> {
  const { default: initiativeService } = await import('./initiativeService.js');
  const created: any = await initiativeService.createInitiative({
    organization_id: params.organizationId,
    title: String(params.title || 'Teresa initiative').slice(0, 500),
    summary: String(params.description || ''),
    status: 'step3',
  } as any);
  return { id: String(created?.id || '') };
}

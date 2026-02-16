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
    console.warn('[InitiativeGeneration] LLM Service not available');
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
    const sectionType = await initiativeSectionTypeService.getSectionTypeByKey(
      sectionKey,
      organizationId || undefined
    );

    if (!sectionType) {
      throw new Error(`Section type "${sectionKey}" not found`);
    }

    const promptTemplate = sectionType.aiPromptTemplate;
    if (!promptTemplate) {
      throw new Error(`No AI prompt template defined for section "${sectionKey}"`);
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
      // Fallback: return placeholder content
      return this.generatePlaceholder(sectionKey, enrichedContext);
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
      console.error('[InitiativeGeneration] LLM call failed:', err.message);
      // Fallback
      return this.generatePlaceholder(sectionKey, enrichedContext);
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
      // Default suggestion: all core sections
      return [
        { key: 'overview', reason: 'Essential for any initiative', priority: 'high' },
        { key: 'tasks', reason: 'Required for tracking progress', priority: 'high' },
        { key: 'decisions', reason: 'Governance tracking', priority: 'medium' },
      ];
    }

    // Get all available section types
    const allSections = await initiativeSectionTypeService.getAllSectionTypes(
      organizationId || undefined
    );

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
    } catch {
      return [
        { key: 'overview', reason: 'Essential for any initiative', priority: 'high' },
        { key: 'tasks', reason: 'Required for tracking progress', priority: 'high' },
      ];
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
      console.warn('[InitiativeGeneration] Failed to enrich context:', err.message);
    }

    return context;
  }

  /**
   * Generate placeholder content when LLM is unavailable
   */
  private generatePlaceholder(sectionKey: string, context: GenerationContext): GenerationResult {
    const isPolish = context.language === 'pl';

    const placeholders: Record<string, string> = {
      overview: isPolish
        ? `Inicjatywa "${context.initiativeName}" wymaga dalszej analizy. Uzupełnij opis ręcznie lub spróbuj ponownie później.`
        : `The "${context.initiativeName}" initiative requires further analysis. Please fill in manually or try again later.`,
      problem_definition: JSON.stringify({
        symptom: isPolish ? 'Do uzupełnienia' : 'To be defined',
        rootCause: isPolish ? 'Do uzupełnienia' : 'To be defined',
        costOfInaction: isPolish ? 'Do uzupełnienia' : 'To be defined',
      }),
      target_state: JSON.stringify({
        targetDescription: isPolish ? 'Do uzupełnienia' : 'To be defined',
        successCriteria: [],
        deliverables: [],
      }),
    };

    const content =
      placeholders[sectionKey] ||
      (isPolish
        ? `Generowanie AI nie jest dostępne dla tej sekcji. Uzupełnij ręcznie.`
        : `AI generation is not available for this section. Please fill in manually.`);

    const isJson = content.startsWith('{') || content.startsWith('[');
    let parsedContent: any;
    if (isJson) {
      try {
        parsedContent = JSON.parse(content);
      } catch {
        /* ignore */
      }
    }

    return {
      content,
      isJson,
      parsedContent,
      tokensUsed: 0,
      model: 'placeholder',
    };
  }

  /**
   * Dependency injection for tests
   */
  setDependencies(deps: { db?: any }) {
    if (deps.db) this.db = deps.db;
  }
}

export default new InitiativeGenerationService();

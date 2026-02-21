/**
 * Prompt Assembler — Runtime prompt compilation pipeline (T116)
 *
 * Compiles a final prompt from:
 *   1. Base system prompt (from ai_system_prompts by key)
 *   2. Prompt blocks (from ai_prompt_blocks by codes)
 *   3. Org-specific learned instructions (from ai_instruction_suggestions, status=applied)
 *   4. Variable interpolation (safe, no eval)
 *   5. Language policy enforcement
 *
 * Used by:
 *   - prompt-assistant preview / test bench
 *   - production AI endpoints (runtime)
 */

import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface AssembledPrompt {
  systemPrompt: string;
  userPromptTemplate: string | null;
  metadata: {
    promptKey: string;
    promptVersion: number;
    blockCodes: string[];
    appliedInstructions: number;
    language: string;
    compiledAt: string;
  };
}

export interface AssembleOptions {
  promptKey: string;
  blockCodes?: string[];
  variables?: Record<string, string>;
  organizationId?: string;
  language?: string;
}

const SUPPORTED_LANGUAGES = ['en', 'pl', 'de', 'fr', 'es', 'it'] as const;

function interpolateVariables(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
  }
  return result;
}

function buildLanguageDirective(lang: string): string {
  const langName: Record<string, string> = {
    en: 'English',
    pl: 'Polish',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    it: 'Italian',
  };
  const name = langName[lang] || langName.en;
  return `\n\n[Language Policy]\nAlways respond in ${name}. All outputs, labels, and explanations must be in ${name}.`;
}

class PromptAssemblerService {
  /**
   * Assemble a complete prompt from registry + blocks + org instructions.
   */
  async assemble(options: AssembleOptions): Promise<AssembledPrompt> {
    const { promptKey, blockCodes = [], variables = {}, organizationId, language = 'en' } = options;

    const prompt = await this.loadPrompt(promptKey);
    if (!prompt) {
      throw new Error(`Prompt not found for key: ${promptKey}`);
    }

    let systemPrompt = prompt.content || prompt.template || '';
    const userPromptTemplate = prompt.user_prompt_template || null;

    if (blockCodes.length > 0) {
      const blocks = await this.loadBlocks(blockCodes);
      if (blocks.length > 0) {
        const blockSection = blocks.map((b: any) => b.content).join('\n\n');
        systemPrompt += `\n\n[Prompt Blocks]\n${blockSection}`;
      }
    }

    let appliedInstructions = 0;
    if (organizationId) {
      const instructions = await this.loadOrgInstructions(organizationId);
      if (instructions.length > 0) {
        appliedInstructions = instructions.length;
        const instrSection = instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n');
        systemPrompt += `\n\n[Learned Instructions]\n${instrSection}`;
      }
    }

    const safeLang = SUPPORTED_LANGUAGES.includes(language as any) ? language : 'en';
    systemPrompt += buildLanguageDirective(safeLang);

    if (Object.keys(variables).length > 0) {
      systemPrompt = interpolateVariables(systemPrompt, variables);
    }

    return {
      systemPrompt,
      userPromptTemplate: userPromptTemplate
        ? interpolateVariables(userPromptTemplate, variables)
        : null,
      metadata: {
        promptKey,
        promptVersion: prompt.version || 1,
        blockCodes,
        appliedInstructions,
        language: safeLang,
        compiledAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Preview assembled prompt without executing (for test bench / prompt-assistant).
   */
  async preview(options: AssembleOptions): Promise<AssembledPrompt & { characterCount: number }> {
    const assembled = await this.assemble(options);
    return {
      ...assembled,
      characterCount: assembled.systemPrompt.length + (assembled.userPromptTemplate?.length || 0),
    };
  }

  /**
   * Load a prompt by key from the canonical registry.
   */
  private async loadPrompt(key: string): Promise<any | null> {
    const queries = [
      `SELECT * FROM ai_system_prompts WHERE key = ? AND is_active = 1 LIMIT 1`,
      `SELECT * FROM ai_system_prompts WHERE key = ? LIMIT 1`,
      `SELECT * FROM ai_system_prompts WHERE name = ? AND is_active = 1 LIMIT 1`,
    ];

    for (const sql of queries) {
      try {
        const row = await dbGet(sql, [key]);
        if (row) return row;
      } catch {
        // schema mismatch — try next
      }
    }
    return null;
  }

  /**
   * Load prompt blocks by their codes.
   */
  private async loadBlocks(codes: string[]): Promise<Array<{ code: string; content: string }>> {
    if (!codes.length) return [];
    try {
      const placeholders = codes.map(() => '?').join(',');
      const rows = (await dbAll(
        `SELECT code, name, content FROM ai_prompt_blocks WHERE (code IN (${placeholders}) OR name IN (${placeholders})) AND is_active = 1 ORDER BY category`,
        [...codes, ...codes]
      )) as any[];
      return rows || [];
    } catch {
      return [];
    }
  }

  /**
   * Load applied instruction suggestions for an organization.
   * Public so learningSystem.ts can delegate here.
   */
  async loadOrgInstructions(orgId: string): Promise<string[]> {
    const queries = [
      {
        sql: `SELECT instruction FROM ai_instruction_suggestions WHERE organization_id = ? AND status = 'applied' ORDER BY confidence DESC LIMIT 10`,
        params: [orgId],
      },
      {
        sql: `SELECT suggested_instruction as instruction FROM ai_instruction_suggestions WHERE organization_id = ? AND status = 'applied' ORDER BY confidence_score DESC LIMIT 10`,
        params: [orgId],
      },
    ];

    for (const q of queries) {
      try {
        const rows = (await dbAll(q.sql, q.params)) as any[];
        if (rows?.length) {
          return rows.map((r: any) => r.instruction).filter(Boolean);
        }
      } catch {
        // schema variant — try next
      }
    }
    return [];
  }
}

export const promptAssembler = new PromptAssemblerService();
export default promptAssembler;

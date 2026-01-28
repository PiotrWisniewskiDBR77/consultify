/**
 * ToolInitiativeService
 * Generates draft initiatives from tool sessions.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
// @ts-ignore TS1149 - Case sensitivity: aiPipeline.js is created in Docker, AIPipeline.js exists in git
// On macOS both resolve to same file, but Docker needs aiPipeline.js for case-sensitive imports
import { AIPipeline } from './ai/aiPipeline.js';

type ToolSessionRow = {
  id: string;
  organization_id: string;
  project_id?: string | null;
  tool_type: string;
  answers_json?: string | null;
  context_snapshot?: string | null;
};

type GeneratedInitiative = {
  title: string;
  description: string;
  category?: string;
  priority?: string;
  risk?: string;
};

const parseJsonPayload = (content: string): { initiatives: GeneratedInitiative[] } | null => {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (parsed && Array.isArray(parsed.initiatives)) {
      return parsed;
    }
    return null;
  } catch (err) {
    return null;
  }
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

const buildPrompt = ({
  toolType,
  methodologyId,
  count,
  answers,
  context,
}: {
  toolType: string;
  methodologyId: string;
  count: number;
  answers: Record<string, unknown>;
  context: Record<string, unknown>;
}): string => {
  return `You are a senior transformation consultant.
Generate ${count} initiatives in JSON only.

Tool type: ${toolType}
Methodology: ${methodologyId}

Tool answers (JSON):
${JSON.stringify(answers)}

Context (JSON):
${JSON.stringify(context)}

Return ONLY valid JSON in this format:
{"initiatives":[{"title":"...","description":"...","category":"Strategy|Operations|Digital|Process Auto","priority":"P1|P2|P3","risk":"Low|Medium|High"}]}`;
};

const methodologyDefaults = (methodologyId: string) => {
  switch (methodologyId) {
    case 'impact-feasibility':
      return { category: 'Strategy', priority: 'P1', risk: 'Medium' };
    case 'value-effort':
      return { category: 'Operations', priority: 'P2', risk: 'Low' };
    case 'risk-compliance':
      return { category: 'Process Auto', priority: 'P1', risk: 'High' };
    case 'customer-market':
      return { category: 'Digital', priority: 'P2', risk: 'Medium' };
    case 'operational-efficiency':
      return { category: 'Operations', priority: 'P2', risk: 'Low' };
    default:
      return { category: 'Operations', priority: 'P3', risk: 'Medium' };
  }
};

const normalizeInitiative = (
  initiative: GeneratedInitiative,
  methodologyId: string,
  index: number
): GeneratedInitiative => {
  const defaults = methodologyDefaults(methodologyId);
  return {
    title: initiative.title?.trim() || `Initiative ${index + 1}`,
    description: initiative.description?.trim() || 'Draft initiative generated from tool analysis.',
    category: initiative.category || defaults.category,
    priority: initiative.priority || defaults.priority,
    risk: initiative.risk || defaults.risk,
  };
};

const fallbackInitiatives = (
  count: number,
  toolType: string,
  methodologyId: string
): GeneratedInitiative[] => {
  const defaults = methodologyDefaults(methodologyId);
  return Array.from({ length: count }).map((_, index) => ({
    title: `${toolType} Initiative ${index + 1}`,
    description: 'Draft initiative generated without AI context.',
    category: defaults.category,
    priority: index === 0 ? defaults.priority : defaults.priority,
    risk: defaults.risk,
  }));
};

export class ToolInitiativeService {
  private aiPipeline = AIPipeline.getInstance();

  async generateFromSession(params: {
    toolSession: ToolSessionRow;
    methodologyId: string;
    count: number;
    includeChatContext: boolean;
    userId: string;
  }): Promise<GeneratedInitiative[]> {
    const { toolSession, methodologyId, count, includeChatContext, userId } = params;
    const answers = toolSession.answers_json ? JSON.parse(toolSession.answers_json) : {};
    const context = toolSession.context_snapshot ? JSON.parse(toolSession.context_snapshot) : {};
    const aiTimeoutMs = Number(process.env.TOOL_AI_TIMEOUT_MS || 8000);

    const prompt = buildPrompt({
      toolType: toolSession.tool_type,
      methodologyId,
      count,
      answers,
      context: includeChatContext ? context : { org: context?.org || {} },
    });

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await withTimeout(
          this.aiPipeline.process({
            capability: 'generateInitiatives',
            prompt,
            userId,
            organizationId: toolSession.organization_id,
            projectId: toolSession.project_id || undefined,
          }),
          aiTimeoutMs,
          'AI initiative generation'
        ) as { content?: string } | null | undefined;

        if (response?.content) {
          const parsed = parseJsonPayload(response.content);
          if (parsed?.initiatives?.length) {
            const normalized = parsed.initiatives
              .slice(0, count)
              .map((item, index) => normalizeInitiative(item, methodologyId, index));
            const unique = Array.from(
              new Map(normalized.map((i) => [i.title.toLowerCase(), i])).values()
            );
            return unique.slice(0, count);
          }
        }
      } catch (err) {
        logger.warn(
          `[ToolInitiativeService] AI generation attempt ${attempt} failed`,
          err as Error
        );
      }
    }

    return fallbackInitiatives(count, toolSession.tool_type, methodologyId);
  }

  async persistInitiatives(params: {
    toolSession: ToolSessionRow;
    batchId: string;
    initiatives: GeneratedInitiative[];
    userId: string;
  }): Promise<{ id: string; title: string; status: string }[]> {
    const { toolSession, batchId, initiatives, userId } = params;
    const now = new Date().toISOString();
    const created: { id: string; title: string; status: string }[] = [];

    for (const initiative of initiatives) {
      const initiativeId = uuidv4();
      const priorityOrder =
        initiative.priority?.toUpperCase() === 'P1'
          ? 1
          : initiative.priority?.toUpperCase() === 'P2'
            ? 2
            : 3;
      await queryHelpers.queryRun(
        `INSERT INTO initiatives (
          id, organization_id, project_id, name, summary, status, axis, source_type, source_id,
          priority_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          initiativeId,
          toolSession.organization_id,
          toolSession.project_id || null,
          initiative.title,
          initiative.description,
          'DRAFT',
          (initiative.category || 'Operations').toLowerCase(),
          'tool',
          toolSession.id,
          priorityOrder,
          now,
          now,
        ]
      );

      await queryHelpers.queryRun(
        `INSERT INTO tool_initiative_links (
          id, tool_session_id, batch_id, initiative_id, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), toolSession.id, batchId, initiativeId, now]
      );

      created.push({ id: initiativeId, title: initiative.title, status: 'DRAFT' });
    }

    // Audit log (simple insert into audit_log if exists)
    try {
      await queryHelpers.queryRun(
        `INSERT INTO audit_log (id, organization_id, user_id, action, resource_type, resource_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          toolSession.organization_id,
          userId,
          'initiatives_generated_from_tool',
          'tool_session',
          toolSession.id,
          JSON.stringify({ batchId, count: initiatives.length }),
          now,
        ]
      );
    } catch {
      // audit_log table may not exist in all environments
    }

    return created;
  }
}

export default new ToolInitiativeService();

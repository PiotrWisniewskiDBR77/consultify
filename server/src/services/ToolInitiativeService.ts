/**
 * ToolInitiativeService
 * Generates draft initiatives from tool sessions.
 */

import { v4 as uuidv4 } from 'uuid';

import { AIPipeline } from './ai/AIPipeline.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

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

const fallbackInitiatives = (count: number, toolType: string): GeneratedInitiative[] => {
  return Array.from({ length: count }).map((_, index) => ({
    title: `${toolType} Initiative ${index + 1}`,
    description: 'Draft initiative generated without AI context.',
    category: 'Operations',
    priority: index === 0 ? 'P1' : index === 1 ? 'P2' : 'P3',
    risk: 'Medium',
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

    const prompt = buildPrompt({
      toolType: toolSession.tool_type,
      methodologyId,
      count,
      answers,
      context: includeChatContext ? context : { org: context?.org || {} },
    });

    try {
      const response = await this.aiPipeline.process({
        capability: 'generateInitiatives',
        prompt,
        userId,
        organizationId: toolSession.organization_id,
        projectId: toolSession.project_id || undefined,
      });

      if (response?.content) {
        const parsed = parseJsonPayload(response.content);
        if (parsed?.initiatives?.length) {
          return parsed.initiatives.slice(0, count);
        }
      }
    } catch (err) {
      logger.warn('[ToolInitiativeService] AI generation failed, falling back', err as Error);
    }

    return fallbackInitiatives(count, toolSession.tool_type);
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
      await queryHelpers.queryRun(
        `INSERT INTO initiatives (
          id, organization_id, project_id, name, summary, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          initiativeId,
          toolSession.organization_id,
          toolSession.project_id || null,
          initiative.title,
          initiative.description,
          'draft',
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

      created.push({ id: initiativeId, title: initiative.title, status: 'draft' });
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

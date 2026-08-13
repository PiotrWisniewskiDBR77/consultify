/**
 * ToolInitiativeService
 * Generates draft initiatives from tool sessions.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { AIPipeline } from './ai/AIPipeline.js';
import { CARD_CONTENT_FORMULA_A3_LITE } from './initiative/cardContentFormulaPrompt.js';
import { createInitiative as funnelCreateInitiative } from './initiative/createInitiativeService.js';

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

/**
 * D2 — render the interview-insight handoff payload (governed P10 findings)
 * into the tool prompt. When an interview insight is exported to a tool
 * session, its findings ride in `context.boundedInsightPayload`. Previously
 * the whole context was either JSON.stringify-dumped raw or stripped to
 * `{org}`, so the evidence discipline was lost. This produces a structured,
 * readable findings block. Returns '' for non-interview contexts.
 */
const buildInterviewFindingsSection = (context: Record<string, unknown>): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (context as any)?.boundedInsightPayload;
  if (!payload || !Array.isArray(payload.findings) || payload.findings.length === 0) return '';
  const findingsText = payload.findings
    .slice(0, 25)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((f: any, i: number) => {
      const evidence = Array.isArray(f.evidencePointers)
        ? f.evidencePointers
            .slice(0, 5)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((p: any) => `    - ${String(p.excerpt || p.source_id || '').slice(0, 240)}`)
            .join('\n')
        : '';
      return [
        `${i + 1}. ${f.findingStatement}`,
        f.confidenceLevel != null ? `   Confidence: ${f.confidenceLevel}%` : '',
        f.limits ? `   Limits: ${f.limits}` : '',
        f.nextAction ? `   Recommended next action: ${f.nextAction}` : '',
        evidence ? `   Evidence:\n${evidence}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
  return `\nInterview findings (evidence-bounded, from a governed stakeholder interview — base the initiatives on these):\n${findingsText}\n`;
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
${buildInterviewFindingsSection(context)}
${CARD_CONTENT_FORMULA_A3_LITE}
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
      // D2 — preserve the interview handoff payload (+ source) even when chat
      // context is excluded, so governed findings always reach the prompt via
      // buildInterviewFindingsSection. Previously `{org}` stripped them out.
      context: includeChatContext
        ? context
        : {
            org: context?.org || {},
            boundedInsightPayload: (context as any)?.boundedInsightPayload,
            source: (context as any)?.source,
          },
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
        );

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
      const axis = (initiative.category || 'Operations').toLowerCase();
      // Uspójnienie F1.8 — per-record przez kanoniczny lejek (DRAFT + name/title + lineage).
      let effectiveInitiativeId = initiativeId;
      if (process.env.INITIATIVE_FUNNEL_ENABLED === 'true') {
        const __r = await funnelCreateInitiative(
          toolSession.organization_id,
          {
            title: initiative.title,
            projectId: toolSession.project_id || null,
            summary: initiative.description,
            axis,
            sourceType: 'tool',
            sourceId: toolSession.id,
          },
          { validate: false, actor: { id: userId } }
        );
        effectiveInitiativeId = __r.id;
        // Extra column not set by the funnel — post-create UPDATE (best-effort).
        try {
          await queryHelpers.queryRun(
            `UPDATE initiatives SET priority_order = ? WHERE id = ? AND organization_id = ?`,
            [priorityOrder, effectiveInitiativeId, toolSession.organization_id]
          );
        } catch {
          // priority_order column may be absent on legacy schemas
        }
      } else {
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
            axis,
            'tool',
            toolSession.id,
            priorityOrder,
            now,
            now,
          ]
        );
      }

      // C15 close-out (docs/program/METHOD_TOOLS_2026-08-13/IDP_SEMANTICS.md §1/§11):
      // this bulk-generate path intentionally inserts MANY rows sharing one
      // `batchId` (one per generated initiative) — the opposite shape from
      // ToolController.promoteToOutput's one-row-per-promotion. The new
      // uq_tool_initiative_links_promotion index therefore cannot use
      // `batch_id` as (part of) its differentiator for this path; each row
      // gets its own unique `idempotency_key` derived from the batch + the
      // initiative it links, so the constraint never collides here. This
      // path already has its own dedup guard one level up, against
      // `tool_initiative_batches` (ToolController.ts generateInitiatives).
      const linkId = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO tool_initiative_links (
          id, tool_session_id, batch_id, initiative_id, organization_id,
          source_revision, output_type, idempotency_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          linkId,
          toolSession.id,
          batchId,
          effectiveInitiativeId,
          toolSession.organization_id,
          1,
          'initiative',
          `bulk:${batchId}:${effectiveInitiativeId}`,
          now,
        ]
      );

      created.push({ id: effectiveInitiativeId, title: initiative.title, status: 'DRAFT' });
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

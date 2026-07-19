// @ts-nocheck
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import AIPlaybookService from '../../ai/aiPlaybookService.js';
import { NODE_TYPES, stepsToGraph } from '../../ai/templateGraphService.js';
import templateValidationService from '../../ai/templateValidationService.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

function isSchemaMissingError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return (
    msg.includes('no such table') || msg.includes('does not exist') || msg.includes('relation')
  );
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toNullableString(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function coerceScalar(value: string): string | number | boolean {
  const raw = value.trim();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && raw !== '' ? numeric : raw;
}

function parseConditionExpression(input: string | undefined): Record<string, unknown> | null {
  const source = String(input || '').trim();
  if (!source) return null;

  const match = source.match(/^([a-z_]+)\((.*)\)$/i);
  if (!match) return null;

  const [, operator, argsRaw] = match;
  const args = argsRaw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^["']|["']$/g, ''));

  switch (operator) {
    case 'metric_lte':
    case 'metric_gte':
    case 'flag_eq':
    case 'time_since_step_gte':
      return args.length >= 2 ? { [operator]: [args[0], coerceScalar(args[1])] } : null;
    case 'signal_present':
      return args.length >= 1 ? { signal_present: args[0] } : null;
    default:
      return null;
  }
}

function normalizeTemplateGraph(templateGraph: any, triggerSignal?: string) {
  if (!templateGraph || typeof templateGraph !== 'object') return null;
  const graph = {
    nodes: Array.isArray(templateGraph.nodes) ? templateGraph.nodes : [],
    edges: Array.isArray(templateGraph.edges) ? templateGraph.edges : [],
    meta: {
      ...(templateGraph.meta && typeof templateGraph.meta === 'object' ? templateGraph.meta : {}),
      trigger_signal:
        String(templateGraph?.meta?.trigger_signal || triggerSignal || '').trim() || undefined,
    },
  };
  return graph;
}

function buildTemplateStepsFromGraph(templateId: string, templateGraph: any) {
  const graph = normalizeTemplateGraph(templateGraph);
  if (!graph) return [];

  const orderedSteps = (stepsToGraph(graph) as Array<any>) || [];
  const nodeIdToStepId = new Map(orderedSteps.map((step) => [step.id, `apts-${uuidv4()}`]));
  const nodeById = new Map((graph.nodes || []).map((node: any) => [node.id, node]));
  const outgoingEdges = new Map<string, Array<any>>();
  for (const edge of graph.edges || []) {
    if (!outgoingEdges.has(edge.from)) outgoingEdges.set(edge.from, []);
    outgoingEdges.get(edge.from)!.push(edge);
  }

  return orderedSteps.map((step, index) => {
    const node = nodeById.get(step.id);
    const nodeType = String(node?.type || NODE_TYPES.ACTION).toUpperCase();
    const nodeData = (node?.data && typeof node.data === 'object' ? node.data : {}) as Record<
      string,
      any
    >;
    const edges = outgoingEdges.get(step.id) || [];
    const nonTerminalEdges = edges.filter((edge) => {
      const targetNode = nodeById.get(edge.to);
      return targetNode?.type !== NODE_TYPES.END;
    });
    const defaultEdge =
      nonTerminalEdges.find((edge) => String(edge.label || '').toLowerCase() === 'default') ||
      nonTerminalEdges.find((edge) => String(edge.label || '').toLowerCase() === 'if') ||
      nonTerminalEdges[0] ||
      null;
    const elseEdge =
      nonTerminalEdges.find((edge) =>
        String(edge.label || '')
          .toLowerCase()
          .includes('else')
      ) || null;

    const parsedCondition = parseConditionExpression(nodeData.condition);
    let branchRules: Record<string, unknown> | null = null;
    if ((nodeType === NODE_TYPES.BRANCH || nodeType === NODE_TYPES.CHECK) && parsedCondition) {
      branchRules = {
        mode: 'first_match',
        rules:
          defaultEdge && nodeIdToStepId.get(defaultEdge.to)
            ? [{ if: parsedCondition, goto: nodeIdToStepId.get(defaultEdge.to) }]
            : [],
        else_goto: (elseEdge && nodeIdToStepId.get(elseEdge.to)) || null,
      };
    }

    return {
      id: nodeIdToStepId.get(step.id)!,
      templateId,
      templateNodeId: step.id,
      stepOrder: index + 1,
      stepType: nodeType,
      actionType:
        nodeType === NODE_TYPES.ACTION
          ? String(nodeData.actionType || step.actionType || '').trim()
          : null,
      title: String(step.title || node?.title || `Step ${index + 1}`),
      description: String(nodeData.description || step.description || ''),
      payloadTemplate: nodeData.payloadTemplate || step.payloadTemplate || {},
      isOptional: !!nodeData.isOptional,
      waitForPrevious: nodeData.waitForPrevious !== false,
      nextStepId:
        nodeType === NODE_TYPES.BRANCH || nodeType === NODE_TYPES.CHECK
          ? null
          : (defaultEdge && nodeIdToStepId.get(defaultEdge.to)) ||
            (elseEdge && nodeIdToStepId.get(elseEdge.to)) ||
            null,
      branchRules,
    };
  });
}

async function syncTemplateStepsFromGraph(templateId: string, templateGraph: any): Promise<void> {
  await dbRun('DELETE FROM ai_playbook_template_steps WHERE template_id = ?', [templateId]);
  const steps = buildTemplateStepsFromGraph(templateId, templateGraph);
  for (const step of steps) {
    await dbRun(
      `INSERT INTO ai_playbook_template_steps (
         id, template_id, step_order, step_type, action_type, title, description,
         payload_template, is_optional, wait_for_previous, next_step_id, branch_rules
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        step.id,
        step.templateId,
        step.stepOrder,
        step.stepType,
        step.actionType,
        step.title,
        step.description,
        JSON.stringify(step.payloadTemplate || {}),
        step.isOptional ? 1 : 0,
        step.waitForPrevious ? 1 : 0,
        step.nextStepId,
        step.branchRules ? JSON.stringify(step.branchRules) : null,
      ]
    );
  }
}

async function ensureTemplateRuntimeMaterialized(templateId: string): Promise<void> {
  const existingSteps = await dbGet<{ count: number }>(
    'SELECT COUNT(*) as count FROM ai_playbook_template_steps WHERE template_id = ?',
    [templateId]
  );
  if (Number(existingSteps?.count || 0) > 0) return;

  const template = await dbGet<{ template_graph?: string | null; trigger_signal?: string | null }>(
    'SELECT template_graph, trigger_signal FROM ai_playbook_templates WHERE id = ?',
    [templateId]
  );
  if (!template?.template_graph) return;

  const graph = normalizeTemplateGraph(
    parseJson(template.template_graph, null),
    template.trigger_signal || ''
  );
  if (!graph) return;
  await syncTemplateStepsFromGraph(templateId, graph);
}

function mapRunStatusToInstanceStatus(status: string | null | undefined): string {
  switch (String(status || '').toUpperCase()) {
    case 'PENDING':
    case 'IN_PROGRESS':
      return 'RUNNING';
    case 'PAUSED':
      return 'PAUSED';
    case 'FAILED':
      return 'FAILED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'COMPLETED':
      return 'COMPLETED';
    default:
      return 'RUNNING';
  }
}

async function getScopedRun(runId: string, organizationId?: string | null) {
  const run = await AIPlaybookService.getRun(runId);
  if (!run) return null;
  if (organizationId && run.organizationId && run.organizationId !== organizationId) return null;
  return run;
}

async function getAsyncJobService() {
  const module = await import('../../ai/asyncJobService.js');
  return module.default;
}

function buildInstanceFromRun(run: any) {
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const totalSteps = steps.length;
  const completedSteps = steps.filter((step) =>
    ['EXECUTED', 'SKIPPED', 'COMPLETED'].includes(String(step.status || '').toUpperCase())
  ).length;
  const failedStep =
    steps.find((step) => String(step.status || '').toUpperCase() === 'FAILED') || null;
  const currentStep =
    steps.find((step) =>
      ['PENDING', 'APPROVED', 'IN_PROGRESS', 'MODIFIED'].includes(
        String(step.status || '').toUpperCase()
      )
    ) || failedStep;

  const startedAtMs = run.startedAt
    ? Date.parse(run.startedAt)
    : Date.parse(run.createdAt || '') || Date.now();
  const endAtMs = run.completedAt
    ? Date.parse(run.completedAt)
    : ['COMPLETED', 'FAILED', 'CANCELLED'].includes(String(run.status || '').toUpperCase())
      ? Date.now()
      : null;
  const totalExecutionTime =
    Number.isFinite(startedAtMs) && endAtMs
      ? Math.max(0, Math.round((endAtMs - startedAtMs) / 1000))
      : null;
  const averageStepTime =
    totalExecutionTime && completedSteps > 0
      ? Number((totalExecutionTime / completedSteps).toFixed(1))
      : null;

  return {
    id: run.id,
    templateId: run.templateId,
    templateKey: run.templateKey,
    templateTitle: run.templateTitle,
    organizationId: run.organizationId,
    correlationId: run.correlationId,
    status: mapRunStatusToInstanceStatus(run.status),
    progress: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    startedAt: run.startedAt || run.createdAt,
    completedAt: run.completedAt || undefined,
    currentStep: currentStep?.title || currentStep?.id || null,
    currentStepId: currentStep?.id || null,
    stepCount: totalSteps,
    executionLog: steps.map((step) => ({
      timestamp: run.completedAt || run.startedAt || run.createdAt,
      message: `${step.title || step.id}: ${step.status}`,
      status: step.status,
    })),
    stepResults: steps.map((step) => ({
      id: step.id,
      title: step.title,
      status: step.status,
      actionType: step.actionType,
      reason: step.statusReason,
    })),
    averageStepTime,
    totalExecutionTime,
    failedAt: failedStep ? run.completedAt || new Date().toISOString() : undefined,
    failedStep: failedStep?.title || failedStep?.id || undefined,
    failureReason: failedStep?.statusReason || undefined,
    errorMessage: failedStep?.statusReason || undefined,
    retryCount: 0,
    successRate: totalSteps > 0 ? Number((completedSteps / totalSteps).toFixed(2)) : undefined,
  };
}

export class AIPlaybooksController {
  /**
   * GET /api/ai/playbooks/templates
   */
  static async getTemplates(req: AuthRequest, res: Response) {
    try {
      const status = req.query.status as string | undefined;

      let query = `
                SELECT 
                    apt.id,
                    apt.key,
                    apt.title,
                    apt.description,
                    COALESCE(apt.status, 'DRAFT') as status,
                    apt.trigger_signal as "triggerSignal",
                    apt.estimated_duration_mins as "estimatedDurationMins",
                    COALESCE(apt.version, 1) as version,
                    apt.template_graph as "templateGraph",
                    apt.created_at as "createdAt",
                    COALESCE(apt.updated_at, apt.created_at) as updatedAt,
                    COALESCE(apt.usage_count, 0) as usageCount,
                    apt.success_rate as "successRate",
                    apt.category_id as "categoryId",
                    cc.name as "categoryName",
                    cc.color as "categoryColor"
                FROM ai_playbook_templates apt
                LEFT JOIN content_categories cc ON apt.category_id = cc.id
                WHERE 1=1
            `;
      const params: (string | number)[] = [];

      if (status) {
        query += " AND COALESCE(apt.status, 'DRAFT') = ?";
        params.push(status);
      }

      query += ' ORDER BY apt.created_at DESC';

      const templates = await dbAll(query, params, { fallback: false });

      if (!templates || templates.length === 0) {
        return res.json([]);
      }

      // Transform templates
      const transformedTemplates = templates.map((t: any) => ({
        id: t.id,
        key: t.key,
        title: t.title,
        description: t.description,
        status: t.status,
        triggerSignal: t.triggerSignal,
        estimatedDurationMins: t.estimatedDurationMins,
        version: t.version,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        templateGraph: t.templateGraph ? JSON.parse(t.templateGraph) : null,
        usageStats: {
          totalRuns: t.usageCount || 0,
          successRate: t.successRate || 0,
        },
        category: t.categoryId
          ? {
              id: t.categoryId,
              name: t.categoryName,
              color: t.categoryColor,
            }
          : null,
      }));

      return res.json(transformedTemplates);
    } catch (err: any) {
      logger.error('[AIPlaybooks] Get templates error:', err);
      if (isSchemaMissingError(err)) {
        return res
          .status(503)
          .json({ error: 'AI playbooks storage not available (schema missing or misconfigured)' });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/playbooks/templates/published
   * Public endpoint for published templates (users can view to start runs)
   */
  static async getPublishedTemplates(req: AuthRequest, res: Response) {
    try {
      const templates = await dbAll(
        `
                SELECT 
                    id, key, title, description, 
                    COALESCE(status, 'DRAFT') as status,
                    trigger_signal as "triggerSignal",
                    estimated_duration_mins as "estimatedDurationMins",
                    COALESCE(version, 1) as version,
                    created_at as "createdAt",
                    COALESCE(updated_at, created_at) as updatedAt
                FROM ai_playbook_templates
                WHERE COALESCE(status, 'DRAFT') = 'PUBLISHED'
                ORDER BY title ASC
	            `,
        [],
        { fallback: false }
      );

      if (!templates || templates.length === 0) {
        return res.json([]);
      }

      return res.json(templates);
    } catch (err: any) {
      logger.error('[AIPlaybooks] Get published templates error:', err);
      if (isSchemaMissingError(err)) {
        return res
          .status(503)
          .json({ error: 'AI playbooks storage not available (schema missing or misconfigured)' });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/playbooks/templates
   */
  static async createTemplate(req: AuthRequest, res: Response) {
    try {
      const {
        key,
        title,
        triggerSignal,
        templateGraph,
        description,
        estimatedDurationMins,
        categoryId,
      } = req.body;

      if (!key || !title || !triggerSignal) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check for duplicate key
      const existing = await dbGet('SELECT id FROM ai_playbook_templates WHERE key = ?', [key]);
      if (existing) {
        return res.status(409).json({ error: 'Key already exists (duplicate)' });
      }

      const normalizedGraph = normalizeTemplateGraph(templateGraph, triggerSignal);
      if (templateGraph && !normalizedGraph)
        return res.status(400).json({ error: 'Invalid graph structure' });
      const validation = normalizedGraph
        ? templateValidationService.validate({
            templateGraph: normalizedGraph,
            triggerSignal,
          })
        : { ok: true, errors: [] };
      if (!validation.ok) {
        return res
          .status(400)
          .json({ error: 'Template graph is invalid', details: validation.errors });
      }

      const id = `tpl-${uuidv4()}`;
      const now = new Date().toISOString();

      await dbRun(
        `
                INSERT INTO ai_playbook_templates (
                    id, key, title, description, trigger_signal, 
                    template_graph, estimated_duration_mins, status, 
                    version, category_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', 1, ?, ?, ?)
            `,
        [
          id,
          key,
          title,
          description || '',
          triggerSignal,
          templateGraph ? JSON.stringify(templateGraph) : null,
          estimatedDurationMins || null,
          categoryId || null,
          now,
          now,
        ]
      );

      if (normalizedGraph) {
        await syncTemplateStepsFromGraph(id, normalizedGraph);
      }

      logger.info(`[AIPlaybooks] Created template: ${key}`);

      return res.status(201).json({
        id,
        key,
        title,
        description: description || '',
        triggerSignal,
        status: 'DRAFT',
        version: 1,
        templateGraph: normalizedGraph,
        estimatedDurationMins: estimatedDurationMins || null,
        usageStats: { totalRuns: 0, successRate: 0 },
        createdAt: now,
      });
    } catch (err: any) {
      logger.error('[AIPlaybooks] Create template error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/playbooks/templates/:id
   */
  static async getTemplateDetails(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id;

      const template = (await dbGet(
        `
                SELECT 
                    apt.id, apt.key, apt.title, apt.description,
                    COALESCE(apt.status, 'DRAFT') as status,
                    apt.trigger_signal as "triggerSignal",
                    apt.estimated_duration_mins as "estimatedDurationMins",
                    COALESCE(apt.version, 1) as version,
                    apt.template_graph as "templateGraph",
                    apt.created_at as "createdAt",
                    COALESCE(apt.updated_at, apt.created_at) as updatedAt,
                    COALESCE(apt.usage_count, 0) as usageCount,
                    apt.success_rate as "successRate"
                FROM ai_playbook_templates apt
                WHERE apt.id = ?
            `,
        [id]
      )) as any;

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const templateSteps = await dbAll(
        `SELECT * FROM ai_playbook_template_steps WHERE template_id = ? ORDER BY step_order ASC`,
        [id],
        { fallback: false }
      );
      const templateGraph =
        parseJson(template.templateGraph, null) ||
        (Array.isArray(templateSteps) && templateSteps.length > 0
          ? stepsToGraph(templateSteps, template.triggerSignal || '')
          : { nodes: [], edges: [], meta: { trigger_signal: template.triggerSignal || '' } });

      return res.json({
        ...template,
        templateGraph,
        usageStats: {
          totalRuns: template.usageCount || 0,
          successRate: template.successRate || 0,
        },
      });
    } catch (err: any) {
      logger.error('[AIPlaybooks] Get template details error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * PUT /api/ai/playbooks/templates/:id
   */
  static async updateTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        triggerSignal,
        templateGraph,
        estimatedDurationMins,
        categoryId,
      } = req.body;

      if (req.body.estimatedDurationMins !== undefined && req.body.estimatedDurationMins < 0) {
        return res.status(400).json({ error: 'Invalid duration' });
      }

      const existing = (await dbGet('SELECT id, version FROM ai_playbook_templates WHERE id = ?', [
        id,
      ])) as any;

      if (!existing) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const normalizedGraph =
        templateGraph !== undefined ? normalizeTemplateGraph(templateGraph, triggerSignal) : null;
      if (templateGraph !== undefined && !normalizedGraph) {
        return res.status(400).json({ error: 'Invalid graph structure' });
      }
      if (normalizedGraph) {
        const validation = templateValidationService.validate({
          templateGraph: normalizedGraph,
          triggerSignal,
        });
        if (!validation.ok) {
          return res
            .status(400)
            .json({ error: 'Template graph is invalid', details: validation.errors });
        }
      }

      const now = new Date().toISOString();
      const newVersion = (existing.version || 1) + 1;

      await dbRun(
        `
                UPDATE ai_playbook_templates SET
                    title = COALESCE(?, title),
                    description = COALESCE(?, description),
                    trigger_signal = COALESCE(?, trigger_signal),
                    template_graph = COALESCE(?, template_graph),
                    estimated_duration_mins = COALESCE(?, estimated_duration_mins),
                    category_id = ?,
                    version = ?,
                    updated_at = ?
                WHERE id = ?
            `,
        [
          title,
          description,
          triggerSignal,
          normalizedGraph ? JSON.stringify(normalizedGraph) : null,
          estimatedDurationMins,
          categoryId,
          newVersion,
          now,
          id,
        ]
      );

      if (normalizedGraph) {
        await syncTemplateStepsFromGraph(id, normalizedGraph);
      }

      logger.info(`[AIPlaybooks] Updated template: ${id}`);

      return res.json({
        ...req.body,
        id,
        version: newVersion,
        templateGraph: normalizedGraph ?? undefined,
        updatedAt: now,
      });
    } catch (err: any) {
      logger.error('[AIPlaybooks] Update template error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * DELETE /api/ai/playbooks/templates/:id
   */
  static async deleteTemplate(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id;

      const template = (await dbGet('SELECT id, status FROM ai_playbook_templates WHERE id = ?', [
        id,
      ])) as any;

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      if (template.status === 'PUBLISHED') {
        return res.status(400).json({ error: 'Cannot delete published templates' });
      }

      await dbRun('DELETE FROM ai_playbook_templates WHERE id = ?', [id]);
      logger.info(`[AIPlaybooks] Deleted template: ${id}`);

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[AIPlaybooks] Delete template error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/playbooks/templates/:id/publish
   */
  static async publishTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const template = (await dbGet(
        `SELECT id, template_graph, trigger_signal FROM ai_playbook_templates WHERE id = ?`,
        [id]
      )) as any;
      if (!template) return res.status(404).json({ error: 'Template not found' });

      const validation = templateValidationService.validate({
        template_graph: template.template_graph,
        trigger_signal: template.trigger_signal,
      });
      if (!validation.ok) {
        return res.status(400).json({ error: 'Template is invalid', details: validation.errors });
      }

      if (template.template_graph) {
        await syncTemplateStepsFromGraph(id, parseJson(template.template_graph, null));
      }

      const published = (await AIPlaybookService.publishTemplate(id, req.user?.id || null)) as any;

      logger.info(`[AIPlaybooks] Published template: ${id}`);

      return res.json({
        id,
        status: published?.status || 'PUBLISHED',
        publishedAt: published?.publishedAt,
      });
    } catch (err: any) {
      logger.error('[AIPlaybooks] Publish template error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/playbooks/templates/:id/validate
   */
  static async validateTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const template = (await dbGet(
        'SELECT id, template_graph FROM ai_playbook_templates WHERE id = ?',
        [id]
      )) as any;

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const result = templateValidationService.validate({
        template_graph: template.template_graph,
      });
      const warnings = templateValidationService.quickValidate({
        template_graph: template.template_graph,
      }).warnings;

      return res.json({
        ok: result.ok,
        errors: result.errors,
        warnings,
      });
    } catch (err: any) {
      logger.error('[AIPlaybooks] Validate template error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/playbooks/templates/:id/deprecate
   */
  static async deprecateTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const template = (await dbGet(`SELECT id FROM ai_playbook_templates WHERE id = ?`, [
        id,
      ])) as any;
      if (!template) return res.status(404).json({ error: 'Template not found' });
      await AIPlaybookService.deprecateTemplate(id);

      logger.info(`[AIPlaybooks] Deprecated template: ${id}`);

      return res.json({ id, status: 'DEPRECATED' });
    } catch (err: any) {
      logger.error('[AIPlaybooks] Deprecate template error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/playbooks/templates/:id/export
   */
  static async exportTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const template = (await dbGet(
        `
                SELECT * FROM ai_playbook_templates WHERE id = ?
            `,
        [id]
      )) as any;

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const exportData = {
        id: template.id,
        key: template.key,
        title: template.title,
        description: template.description,
        triggerSignal: template.trigger_signal,
        templateGraph:
          parseJson(template.template_graph, null) ||
          stepsToGraph(
            (await dbAll(
              `SELECT * FROM ai_playbook_template_steps WHERE template_id = ? ORDER BY step_order ASC`,
              [id],
              { fallback: false }
            )) as any[],
            template.trigger_signal || ''
          ),
        estimatedDurationMins: template.estimated_duration_mins,
        version: template.version,
        status: template.status,
        exportedAt: new Date().toISOString(),
      };

      return res.json(exportData);
    } catch (err: any) {
      logger.error('[AIPlaybooks] Export template error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ==========================================
  // PLAYBOOK RUNS
  // ==========================================

  /**
   * GET /api/ai/playbooks/runs
   */
  static async getRuns(req: AuthRequest, res: Response) {
    try {
      const runs = await dbAll(
        `
                SELECT 
                    apr.id, apr.template_id as "templateId",
                    apt.key as "templateKey", apt.title as "templateTitle",
                    apr.organization_id as "organizationId",
                    apr.correlation_id as "correlationId",
                    apr.initiated_by as "initiatedBy",
                    apr.status, apr.started_at as "startedAt",
                    apr.completed_at as "completedAt",
                    apr.created_at as "createdAt"
                FROM ai_playbook_runs apr
                LEFT JOIN ai_playbook_templates apt ON apr.template_id = apt.id
                WHERE apr.organization_id = ? OR ? IS NULL
                ORDER BY apr.created_at DESC
                LIMIT 100
	            `,
        [req.user?.organizationId, req.user?.organizationId],
        { fallback: false }
      );

      return res.json(runs || []);
    } catch (err: any) {
      logger.error('[AIPlaybooks] Get runs error:', err);
      if (isSchemaMissingError(err)) {
        return res
          .status(503)
          .json({ error: 'AI playbooks storage not available (schema missing or misconfigured)' });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/playbooks/runs
   * Start a new playbook run
   */
  static async createRun(req: AuthRequest, res: Response) {
    try {
      const { templateId } = req.body;
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;

      if (!templateId || !organizationId || !userId) {
        return res.status(400).json({ error: 'templateId is required' });
      }

      const template = (await dbGet(
        `SELECT id, key, title, status, template_graph, trigger_signal FROM ai_playbook_templates WHERE id = ?`,
        [templateId]
      )) as any;
      if (!template) return res.status(404).json({ error: 'Template not found' });
      if (String(template.status || 'DRAFT').toUpperCase() !== 'PUBLISHED') {
        return res.status(400).json({ error: 'Only published templates can be started' });
      }

      await ensureTemplateRuntimeMaterialized(templateId);

      const run = (await AIPlaybookService.initiateRun({
        templateId,
        organizationId,
        initiatedBy: userId,
        contextSnapshot: {
          organizationId,
          initiatedBy: userId,
          triggerSignal: template.trigger_signal || null,
          templateKey: template.key,
        },
      })) as any;

      await AIPlaybookService.incrementUsageCount(templateId);

      const asyncJobService = await getAsyncJobService();
      const queuedJob = await asyncJobService.enqueuePlaybookAdvance({
        runId: run.runId,
        organizationId,
        correlationId: run.correlationId,
        createdBy: userId,
      });

      const hydratedRun = await AIPlaybookService.getRun(run.runId);

      return res.status(201).json({
        id: run.runId,
        templateId,
        templateKey: hydratedRun?.templateKey || template.key,
        templateTitle: hydratedRun?.templateTitle || template.title,
        organizationId,
        correlationId: run.correlationId,
        initiatedBy: userId,
        status: hydratedRun?.status || 'PENDING',
        createdAt: hydratedRun?.createdAt || new Date().toISOString(),
        steps: hydratedRun?.steps || [],
        job: queuedJob,
      });
    } catch (err: any) {
      logger.error('[AIPlaybooks] Create run error:', err);
      if (isSchemaMissingError(err)) {
        return res
          .status(503)
          .json({ error: 'AI playbooks storage not available (schema missing or misconfigured)' });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/playbooks/runs/:id
   */
  static async getRunDetails(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const run = await getScopedRun(id, req.user?.organizationId);
      if (!run) return res.status(404).json({ error: 'Run not found' });
      return res.json(run);
    } catch (err: any) {
      logger.error('[AIPlaybooks] Get run details error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/playbooks/instances
   */
  static async getInstances(req: AuthRequest, res: Response) {
    try {
      const status = String(req.query.status || '').toUpperCase();
      const runs = (await dbAll(
        `
          SELECT id
          FROM ai_playbook_runs
          WHERE organization_id = ?
          ORDER BY created_at DESC
          LIMIT 100
        `,
        [req.user?.organizationId],
        { fallback: false }
      )) as Array<{ id: string }>;

      const hydratedRuns = await Promise.all(
        (runs || []).map((run) => AIPlaybookService.getRun(run.id))
      );
      let instances = hydratedRuns.filter(Boolean).map(buildInstanceFromRun);
      if (status)
        instances = instances.filter(
          (instance) => String(instance.status).toUpperCase() === status
        );
      return res.json(instances);
    } catch (err: any) {
      logger.error('[AIPlaybooks] Get instances error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/playbooks/instances
   */
  static async createInstance(req: AuthRequest, res: Response) {
    try {
      const runResponse = {
        statusCode: 201,
        jsonBody: null as any,
      };
      const proxyRes = {
        status(code: number) {
          runResponse.statusCode = code;
          return this;
        },
        json(body: any) {
          runResponse.jsonBody = body;
          return this;
        },
      } as Response;
      await AIPlaybooksController.createRun(req, proxyRes);
      return res.status(runResponse.statusCode).json(runResponse.jsonBody);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/playbooks/instances/:id
   */
  static async getInstanceDetails(req: AuthRequest, res: Response) {
    try {
      const run = await getScopedRun(req.params.id, req.user?.organizationId);
      if (!run) return res.status(404).json({ error: 'Instance not found' });
      return res.json(buildInstanceFromRun(run));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/playbooks/instances/:id/pause
   */
  static async pauseInstance(req: AuthRequest, res: Response) {
    try {
      const run = await getScopedRun(req.params.id, req.user?.organizationId);
      if (!run) return res.status(404).json({ error: 'Instance not found' });
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(String(run.status || '').toUpperCase())) {
        return res.status(400).json({ error: `Cannot pause a ${run.status} run` });
      }
      await AIPlaybookService.updateRunStatus(run.id, 'PAUSED');
      return res.json({ id: req.params.id, status: 'PAUSED' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/playbooks/instances/:id/resume
   */
  static async resumeInstance(req: AuthRequest, res: Response) {
    try {
      const run = await getScopedRun(req.params.id, req.user?.organizationId);
      if (!run) return res.status(404).json({ error: 'Instance not found' });
      const pendingStep = (run.steps || []).find((step: any) => step.status === 'PENDING');
      if (!pendingStep) {
        return res.status(400).json({ error: 'No pending step available to resume' });
      }
      await AIPlaybookService.updateRunStatus(run.id, 'IN_PROGRESS');
      const asyncJobService = await getAsyncJobService();
      const queuedJob = await asyncJobService.enqueuePlaybookAdvance({
        runId: run.id,
        stepId: pendingStep.id,
        organizationId: run.organizationId,
        correlationId: run.correlationId,
        createdBy: req.user?.id,
      });
      return res.json({ id: req.params.id, status: 'RUNNING', job: queuedJob });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/playbooks/instances/:id/cancel
   */
  static async cancelInstance(req: AuthRequest, res: Response) {
    try {
      const run = await getScopedRun(req.params.id, req.user?.organizationId);
      if (!run) return res.status(404).json({ error: 'Instance not found' });
      await AIPlaybookService.updateRunStatus(run.id, 'CANCELLED');
      return res.json({ id: req.params.id, status: 'CANCELLED' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/playbooks/instances/:id/retry
   */
  static async retryInstance(req: AuthRequest, res: Response) {
    try {
      const run = await getScopedRun(req.params.id, req.user?.organizationId);
      if (!run) return res.status(404).json({ error: 'Instance not found' });

      const failedStep = (run.steps || []).find((step: any) => step.status === 'FAILED');
      if (!failedStep) {
        return res.status(400).json({ error: 'No failed step available to retry' });
      }

      await AIPlaybookService.updateStepStatus(failedStep.id, 'PENDING', {
        decisionId: null,
        executionId: null,
      } as any);
      await AIPlaybookService.updateRunStepWithRouting(failedStep.id, {
        outputs: {},
        evaluationTrace: {},
        statusReason: null,
      });
      await AIPlaybookService.updateRunStatus(run.id, 'IN_PROGRESS');
      const asyncJobService = await getAsyncJobService();
      const queuedJob = await asyncJobService.enqueuePlaybookAdvance({
        runId: run.id,
        stepId: failedStep.id,
        organizationId: run.organizationId,
        correlationId: run.correlationId,
        createdBy: req.user?.id,
      });

      return res.json({
        id: req.params.id,
        status: 'RUNNING',
        retried: true,
        retryCount: 1,
        job: queuedJob,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}

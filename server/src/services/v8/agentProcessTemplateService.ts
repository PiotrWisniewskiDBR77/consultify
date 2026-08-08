import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun, transaction } from '../../utils/DbPromise.js';
import type { BranchTaskDraft, WorkGraphMode } from './multiAgentWorkManagerService.js';
import { createWorkGraph } from './multiAgentWorkManagerService.js';
import { validateAndCompileTransformationPlan } from './transformationCaseService.js';
import type { TransformationPlanStep } from '../../types/transformationCase.js';

export interface AgentPlanningBlueprint {
  intakeDefaults: {
    mandate: string;
    measurableOutcomes?: string[];
    sponsor?: string | null;
    scope?: string | null;
    horizon?: string | null;
  };
  steps: Array<Omit<TransformationPlanStep, 'stepId' | 'stepIndex' | 'status'>>;
}

export interface AgentProcessTemplateGraph {
  mode: WorkGraphMode;
  leadAgentId: string;
  budget?: Record<string, unknown>;
  tasks: BranchTaskDraft[];
  runtimeBundle?: AgentRuntimeBundle;
  planningBlueprint?: AgentPlanningBlueprint;
}

export interface AgentRuntimeBundle {
  promptKey: string;
  promptVersion: string;
  modelId: string;
  modelVersion: string;
  policyVersion: string;
  toolPolicyRefs: string[];
  agentDefinitionVersions: Record<string, string>;
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function runtimeBundleDigest(bundle: AgentRuntimeBundle): string {
  return createHash('sha256').update(canonicalJson(bundle)).digest('hex');
}

export function templateContentDigest(graph: AgentProcessTemplateGraph): string {
  return createHash('sha256').update(canonicalJson(graph)).digest('hex');
}

function validateRuntimeBundle(
  bundle: AgentRuntimeBundle | undefined
): asserts bundle is AgentRuntimeBundle {
  if (
    !bundle ||
    !bundle.promptKey ||
    !bundle.promptVersion ||
    !bundle.modelId ||
    !bundle.modelVersion ||
    !bundle.policyVersion ||
    !Array.isArray(bundle.toolPolicyRefs) ||
    Object.keys(bundle.agentDefinitionVersions || {}).length === 0
  )
    throw new Error('agent_template_runtime_bundle_incomplete');
}

function validateGraph(graph: AgentProcessTemplateGraph): void {
  if (
    !graph?.leadAgentId ||
    !['sequential', 'hierarchical', 'router_parallel'].includes(graph.mode)
  )
    throw new Error('invalid_agent_template_graph');
  if (!Array.isArray(graph.tasks) || graph.tasks.length === 0)
    throw new Error('agent_template_tasks_required');
  if (graph.planningBlueprint) {
    if (!graph.planningBlueprint.intakeDefaults?.mandate?.trim())
      throw new Error('agent_template_planning_mandate_required');
    validateAndCompileTransformationPlan(graph.planningBlueprint.steps);
  }
}

async function recordEvent(input: {
  templateId: string;
  organizationId: string | null;
  version: number;
  eventType: string;
  actorUserId: string;
  reason?: string;
  executionRunId?: string;
}): Promise<void> {
  await dbRun(
    `INSERT INTO v8_agent_template_governance_events
      (event_id, template_id, organization_id, version, event_type, actor_user_id, reason, execution_run_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `template-event-${uuidv4()}`,
      input.templateId,
      input.organizationId,
      input.version,
      input.eventType,
      input.actorUserId,
      input.reason || null,
      input.executionRunId || null,
    ]
  );
}

export async function createAgentProcessTemplate(input: {
  organizationId: string;
  actorUserId: string;
  key: string;
  title: string;
  description?: string;
  graph: AgentProcessTemplateGraph;
}): Promise<{ templateId: string; version: number; status: 'DRAFT' }> {
  validateGraph(input.graph);
  const templateId = `agent-template-${uuidv4()}`;
  const versionId = `agent-template-version-${uuidv4()}`;
  const graphJson = JSON.stringify(input.graph);
  const result = await transaction([
    {
      sql: `INSERT INTO ai_playbook_templates (id, key, title, description, template_graph, status, version, organization_id, created_by) VALUES (?, ?, ?, ?, ?, 'DRAFT', 1, ?, ?)`,
      params: [
        templateId,
        input.key,
        input.title,
        input.description || null,
        graphJson,
        input.organizationId,
        input.actorUserId,
      ],
    },
    {
      sql: `INSERT INTO ai_playbook_template_versions (id, template_id, version, title, description, template_graph, changed_by, change_notes, change_type, status_at_version, runtime_bundle_json, runtime_bundle_digest, content_digest) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'CREATE', 'DRAFT', ?, ?, ?)`,
      params: [
        versionId,
        templateId,
        input.title,
        input.description || null,
        graphJson,
        input.actorUserId,
        'Initial agent process template',
        input.graph.runtimeBundle ? canonicalJson(input.graph.runtimeBundle) : null,
        input.graph.runtimeBundle ? runtimeBundleDigest(input.graph.runtimeBundle) : null,
        templateContentDigest(input.graph),
      ],
    },
  ]);
  if (!result.success)
    throw new Error(`agent_template_transaction_failed:${result.error || 'unknown'}`);
  await recordEvent({
    templateId,
    organizationId: input.organizationId,
    version: 1,
    eventType: 'created',
    actorUserId: input.actorUserId,
  });
  return { templateId, version: 1, status: 'DRAFT' };
}

export async function reviseAgentProcessTemplate(input: {
  templateId: string;
  organizationId: string;
  actorUserId: string;
  graph: AgentProcessTemplateGraph;
  title?: string;
  description?: string;
  reason: string;
}): Promise<{ version: number; status: 'DRAFT' }> {
  validateGraph(input.graph);
  const current = await dbGet(
    `SELECT * FROM ai_playbook_templates WHERE id = ? AND organization_id = ?`,
    [input.templateId, input.organizationId]
  );
  if (!current) throw new Error('agent_template_not_found');
  if (current.status === 'DEPRECATED') throw new Error('deprecated_agent_template_immutable');
  const version = Number(current.version || 0) + 1;
  const title = input.title || current.title;
  const description = input.description ?? current.description;
  const graphJson = JSON.stringify(input.graph);
  const result = await transaction([
    {
      sql: `UPDATE ai_playbook_templates SET title = ?, description = ?, template_graph = ?, status = 'DRAFT', version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ? AND version = ?`,
      params: [
        title,
        description,
        graphJson,
        version,
        input.templateId,
        input.organizationId,
        current.version,
      ],
    },
    {
      sql: `INSERT INTO ai_playbook_template_versions (id, template_id, version, title, description, template_graph, changed_by, change_notes, change_type, status_at_version, runtime_bundle_json, runtime_bundle_digest, content_digest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UPDATE', 'DRAFT', ?, ?, ?)`,
      params: [
        `agent-template-version-${uuidv4()}`,
        input.templateId,
        version,
        title,
        description,
        graphJson,
        input.actorUserId,
        input.reason,
        input.graph.runtimeBundle ? canonicalJson(input.graph.runtimeBundle) : null,
        input.graph.runtimeBundle ? runtimeBundleDigest(input.graph.runtimeBundle) : null,
        templateContentDigest(input.graph),
      ],
    },
  ]);
  if (!result.success || Number(result.results[0]?.changes || 0) !== 1)
    throw new Error('agent_template_revision_conflict');
  await recordEvent({
    templateId: input.templateId,
    organizationId: input.organizationId,
    version,
    eventType: 'revised',
    actorUserId: input.actorUserId,
    reason: input.reason,
  });
  return { version, status: 'DRAFT' };
}

export async function transitionAgentProcessTemplate(input: {
  templateId: string;
  organizationId: string;
  actorUserId: string;
  action: 'publish' | 'deprecate';
  reason: string;
}): Promise<{ version: number; status: 'PUBLISHED' | 'DEPRECATED' }> {
  const current = await dbGet(
    `SELECT * FROM ai_playbook_templates WHERE id = ? AND organization_id = ?`,
    [input.templateId, input.organizationId]
  );
  if (!current) throw new Error('agent_template_not_found');
  const expected = input.action === 'publish' ? 'DRAFT' : 'PUBLISHED';
  if (current.status !== expected)
    throw new Error(`invalid_agent_template_transition:${current.status}:${input.action}`);
  if (input.action === 'publish') {
    validateRuntimeBundle(
      (JSON.parse(current.template_graph) as AgentProcessTemplateGraph).runtimeBundle
    );
    const version = await dbGet(
      `SELECT id,template_graph,content_digest FROM ai_playbook_template_versions WHERE template_id=? AND version=?`,
      [input.templateId, current.version]
    );
    if (!version) throw new Error('agent_template_version_not_found');
    const contentDigest = templateContentDigest(JSON.parse(version.template_graph));
    if (version.content_digest && version.content_digest !== contentDigest)
      throw new Error('agent_template_content_digest_mismatch');
    if (!version.content_digest)
      await dbRun(`UPDATE ai_playbook_template_versions SET content_digest=? WHERE id=? AND content_digest IS NULL`,[contentDigest,version.id]);
  }
  const status = input.action === 'publish' ? 'PUBLISHED' : 'DEPRECATED';
  const result = await dbRun(
    `UPDATE ai_playbook_templates SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ? AND status = ?`,
    [status, input.templateId, input.organizationId, expected]
  );
  if (Number(result.changes || 0) !== 1) throw new Error('agent_template_transition_conflict');
  await dbRun(
    `UPDATE ai_playbook_template_versions SET status_at_version = ? WHERE template_id = ? AND version = ?`,
    [status, input.templateId, current.version]
  );
  await recordEvent({
    templateId: input.templateId,
    organizationId: input.organizationId,
    version: Number(current.version),
    eventType: input.action === 'publish' ? 'published' : 'deprecated',
    actorUserId: input.actorUserId,
    reason: input.reason,
  });
  return { version: Number(current.version), status };
}

export async function instantiateAgentProcessTemplate(input: {
  templateId: string;
  organizationId: string;
  actorUserId: string;
  executionRunId: string;
}): Promise<{ graphId: string; templateVersion: number }> {
  const template = await dbGet(
    `SELECT * FROM ai_playbook_templates WHERE id = ? AND organization_id = ? AND status = 'PUBLISHED'`,
    [input.templateId, input.organizationId]
  );
  if (!template) throw new Error('published_agent_template_not_found');
  const version = await dbGet(
    `SELECT * FROM ai_playbook_template_versions WHERE template_id = ? AND version = ? AND status_at_version = 'PUBLISHED'`,
    [input.templateId, template.version]
  );
  if (!version) throw new Error('published_agent_template_version_not_found');
  const graph = JSON.parse(version.template_graph) as AgentProcessTemplateGraph;
  validateGraph(graph);
  validateRuntimeBundle(graph.runtimeBundle);
  const digest = runtimeBundleDigest(graph.runtimeBundle);
  if (digest !== version.runtime_bundle_digest)
    throw new Error('agent_template_runtime_bundle_digest_mismatch');
  const created = await createWorkGraph({
    executionRunId: input.executionRunId,
    organizationId: input.organizationId,
    leadAgentId: graph.leadAgentId,
    createdBy: input.actorUserId,
    mode: graph.mode,
    budget: graph.budget,
    tasks: graph.tasks,
    runtimeBundle: graph.runtimeBundle as unknown as Record<string, unknown>,
    runtimeBundleDigest: digest,
    sourceTemplateRef: { templateId: input.templateId, version: Number(template.version) },
  });
  await recordEvent({
    templateId: input.templateId,
    organizationId: input.organizationId,
    version: Number(template.version),
    eventType: 'instantiated',
    actorUserId: input.actorUserId,
    executionRunId: input.executionRunId,
  });
  return { graphId: created.graphId, templateVersion: Number(template.version) };
}

export async function listAgentProcessTemplates(organizationId: string): Promise<any[]> {
  const rows = await dbAll(
    `SELECT id, key, title, description, status, version, usage_count, template_graph, created_at, updated_at FROM ai_playbook_templates WHERE organization_id = ? ORDER BY updated_at DESC`,
    [organizationId]
  );
  return rows.map((row:any)=>({
    ...row,
    status:String(row.status || '').toLowerCase(),
    has_planning_blueprint:Boolean(JSON.parse(row.template_graph || '{}').planningBlueprint),
    template_graph:undefined,
  }));
}

export async function getAgentProcessTemplateGovernance(
  templateId: string,
  organizationId: string
): Promise<{ template: any; versions: any[]; events: any[] } | null> {
  const template = await dbGet(
    `SELECT id, key, title, description, status, version, usage_count, created_at, updated_at
       FROM ai_playbook_templates WHERE id = ? AND organization_id = ?`,
    [templateId, organizationId]
  );
  if (!template) return null;
  const versions = await dbAll(
    `SELECT id, version, title, description, change_notes, change_type, status_at_version,
            runtime_bundle_digest, content_digest, changed_by, created_at
       FROM ai_playbook_template_versions
      WHERE template_id = ? ORDER BY version DESC`,
    [templateId]
  );
  const events = await dbAll(
    `SELECT event_id, version, event_type, actor_user_id, reason, execution_run_id, created_at
       FROM v8_agent_template_governance_events
      WHERE template_id = ? AND organization_id = ? ORDER BY created_at DESC, event_id DESC`,
    [templateId, organizationId]
  );
  return { template, versions, events };
}

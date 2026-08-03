/**
 * ideaAIGeneratorService — AI generator for Idea Workspace.
 *
 * Provides context-aware AI generation for Process Flow, Mind Map, Table, Whiteboard.
 * Uses llmService.callStructured with Zod schemas per generatorType.
 * Supports: lane_generator, flow_generator, suggestions, bottleneck, enrichment,
 *           mindmap_expand, table_columns, table_views.
 */
import { z } from 'zod';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type GeneratorType =
  | 'lane_generator'
  | 'flow_generator'
  | 'suggestions'
  | 'bottleneck'
  | 'enrichment'
  | 'mindmap_expand'
  | 'table_columns'
  | 'table_views'
  | 'whiteboard_clusters'
  | 'whiteboard_brainstorm'
  | 'whiteboard_organize'
  | 'summary'
  | 'node_context'
  | 'auto_cluster'
  | 'node_expand'
  | 'process_coach'
  | 'next_step'
  | 'process_summary'
  | 'process_brief'
  | 'process_savings'
  // J26 (Kanał 2): rewrite an EXISTING process step in place (updateNodes, not addNodes)
  | 'edit_step'
  | 'vsm_generator'
  | 'sticky_summarize'
  | 'vsm_future_state'
  // V51-01: Artifact linking AI handlers
  | 'ai_retrieve_artifacts'
  | 'ai_propose_attachments'
  | 'ai_build_linked_table'
  | 'ai_autofill_mappings'
  // V51-05: Whiteboard facilitation handlers
  | 'wb_find_themes'
  | 'wb_name_clusters'
  | 'wb_to_map_branches'
  | 'wb_to_table'
  | 'wb_extract_actions'
  // V51-06: Table AI handlers
  | 'table_rows'
  | 'table_simplify'
  // Mindmap-specific aliases
  | 'mm_branch_generator'
  | 'mm_expand'
  | 'mm_what_if';

export type CanvasTool = 'process_flow' | 'mindmap' | 'table' | 'whiteboard';

export interface GeneratorContext {
  seedText: string;
  title: string;
  branch?: string;
  area?: string;
  existingNodes: any[];
  existingEdges: any[];
  existingLanes?: any[];
  language: string;
  selection?: {
    type?: string;
    count?: number;
    ids?: string[];
    primaryId?: string;
  };
}

export interface GeneratorRequest {
  generatorType: GeneratorType;
  tool: CanvasTool;
  context: GeneratorContext;
  userId: string;
  orgId: string;
}

interface OrgContext {
  name?: string;
  industry?: string;
  size?: string;
  country?: string;
  siriScore?: number | null;
  admaScore?: number | null;
  activeInitiatives?: string[];
  kpis?: string[];
}

function getScopedGeneratorContext(
  generatorType: GeneratorType,
  context: GeneratorContext
): GeneratorContext {
  if (generatorType !== 'sticky_summarize') return context;

  const selectedIds = new Set(
    Array.isArray(context.selection?.ids)
      ? context.selection?.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []
  );
  if (selectedIds.size === 0) return context;

  const selectedNodes = context.existingNodes.filter((node: any) =>
    selectedIds.has(String(node?.id))
  );
  if (selectedNodes.length === 0) return context;

  return {
    ...context,
    existingNodes: selectedNodes,
    existingEdges: context.existingEdges.filter(
      (edge: any) =>
        selectedIds.has(String(edge?.source || '')) && selectedIds.has(String(edge?.target || ''))
    ),
  };
}

// ── Zod schemas for structured LLM output ────────────────────────────────────

const LaneProposalSchema = z.object({
  lanes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      color: z.string().optional(),
      rationale: z.string().optional(),
    })
  ),
});

const FlowProposalSchema = z.object({
  addNodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      shape: z.enum(['start', 'end', 'action', 'decision']),
      laneId: z.string().optional(),
      position: z.object({ x: z.number(), y: z.number() }).optional(),
    })
  ),
  addEdges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      label: z.string().optional(),
      conditionType: z.string().optional(),
    })
  ),
});

const SuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      category: z.enum(['topics', 'findings', 'next_steps', 'frameworks', 'risks', 'benchmarks']),
      text: z.string(),
      detail: z.string().optional(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const BottleneckSchema = z.object({
  findings: z.array(
    z.object({
      nodeId: z.string().optional(),
      issue: z.string(),
      suggestion: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const EnrichmentSchema = z.object({
  updateNodes: z.array(
    z.object({
      id: z.string(),
      data: z.record(z.string(), z.unknown()),
    })
  ),
});

const MindmapExpandSchema = z.object({
  addNodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      parentId: z.string().optional(),
      branchKey: z.string().optional(),
    })
  ),
  addEdges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
    })
  ),
});

const TableColumnsSchema = z.object({
  columns: z.array(
    z.object({
      key: z.string(),
      header: z.string(),
      type: z.enum(['text', 'number', 'select', 'date', 'boolean']),
      rationale: z.string().optional(),
    })
  ),
});

const TableViewsSchema = z.object({
  views: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      groupBy: z.string().optional(),
      sortBy: z.string().optional(),
      filterBy: z.string().optional(),
      rationale: z.string().optional(),
    })
  ),
});

const WhiteboardClustersSchema = z.object({
  clusters: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      color: z.string().optional(),
      stickies: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          color: z.string().optional(),
        })
      ),
    })
  ),
});

const WhiteboardBrainstormSchema = z.object({
  stickies: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      color: z.string().optional(),
      rationale: z.string().optional(),
    })
  ),
});

const WhiteboardOrganizeSchema = z.object({
  groups: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      nodeIds: z.array(z.string()),
    })
  ),
  repositionedNodes: z
    .array(
      z.object({
        id: z.string(),
        position: z.object({ x: z.number(), y: z.number() }),
      })
    )
    .optional(),
});

const SummarySchema = z.object({
  executiveSummary: z.string(),
  keyFindings: z.array(z.string()),
  nextSteps: z.array(z.string()),
  risks: z.array(z.string()).optional(),
});

const NodeContextSchema = z.object({
  summary: z.string(),
  relatedInitiatives: z.array(z.object({ title: z.string(), relevance: z.string() })),
  relatedRisks: z.array(
    z.object({ text: z.string(), severity: z.enum(['low', 'medium', 'high']) })
  ),
  relatedKPIs: z.array(z.object({ name: z.string(), value: z.string(), status: z.string() })),
  suggestions: z.array(
    z.object({ text: z.string(), type: z.enum(['expand', 'connect', 'challenge', 'evidence']) })
  ),
});

const AutoClusterSchema = z.object({
  clusters: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      color: z.string(),
      nodeIds: z.array(z.string()),
      framePosition: z.object({ x: z.number(), y: z.number() }).optional(),
    })
  ),
});

const NodeExpandSchema = z.object({
  subSteps: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      shape: z.string().optional(),
      description: z.string().optional(),
    })
  ),
  risks: z.array(z.object({ text: z.string(), severity: z.enum(['low', 'medium', 'high']) })),
  metrics: z.array(z.object({ name: z.string(), value: z.string(), unit: z.string() })),
  optimizations: z.array(z.object({ text: z.string(), impact: z.enum(['low', 'medium', 'high']) })),
});

const ProcessCoachSchema = z.object({
  insights: z.array(
    z.object({
      type: z.enum([
        'missing_step',
        'too_many_handoffs',
        'parallel_opportunity',
        'validation_gap',
        'bottleneck',
      ]),
      message: z.string(),
      affectedNodeIds: z.array(z.string()).optional(),
      suggestion: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const NextStepSchema = z.object({
  steps: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      shape: z.enum(['action', 'decision', 'end']),
      rationale: z.string().optional(),
    })
  ),
});

const ProcessSummarySchema = z.object({
  totalSteps: z.number(),
  totalDecisions: z.number(),
  totalLanes: z.number(),
  criticalPath: z.array(z.string()),
  estimatedDuration: z.string(),
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
});

const ProcessBriefSchema = z.object({
  objective: z.string(),
  currentGaps: z.array(z.string()),
  nextMoves: z.array(z.string()),
  reviewCheckpoints: z.array(z.string()),
});

const ProcessSavingsSchema = z.object({
  recommendations: z.array(
    z.object({
      nodeId: z.string(),
      automationPotential: z.enum(['low', 'medium', 'high']),
      savingsEstimate: z.string(),
      implementationEffort: z.enum(['low', 'medium', 'high']),
      rationale: z.string(),
    })
  ),
  summary: z.object({
    totalSavingsEstimate: z.string(),
    topOpportunityNodeIds: z.array(z.string()),
    notes: z.array(z.string()),
  }),
});

const VSMGeneratorSchema = z.object({
  addNodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      shape: z.string(),
      position: z.object({ x: z.number(), y: z.number() }).optional(),
      data: z
        .object({
          cycleTime: z.string().optional(),
          changeoverTime: z.string().optional(),
          uptimePercent: z.number().optional(),
          batchSize: z.number().optional(),
          operators: z.number().optional(),
          inventory: z.number().optional(),
        })
        .optional(),
    })
  ),
  addEdges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      label: z.string().optional(),
    })
  ),
  timeline: z
    .object({
      leadTime: z.string(),
      valueAddedTime: z.string(),
      pce: z.number(),
    })
    .optional(),
});

const StickySummarizeSchema = z.object({
  summary: z.string(),
  keyThemes: z.array(z.string()),
});

const VSMFutureStateSchema = z.object({
  addNodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      shape: z.string(),
      data: z
        .object({
          cycleTime: z.string().optional(),
          changeoverTime: z.string().optional(),
          uptimePercent: z.number().optional(),
          batchSize: z.number().optional(),
          operators: z.number().optional(),
        })
        .optional(),
    })
  ),
  addEdges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
    })
  ),
  improvements: z.array(
    z.object({
      text: z.string(),
      impact: z.string(),
      affectedNodeIds: z.array(z.string()).optional(),
    })
  ),
});

// V51-01: Artifact linking AI schemas
const ArtifactRetrievalSchema = z.object({
  artifacts: z.array(
    z.object({
      type: z.string(),
      id: z.string(),
      title: z.string(),
      relevance: z.string(),
      confidence: z.number().min(0).max(1),
      rationale: z.string(),
    })
  ),
});

const AttachmentProposalSchema = z.object({
  proposals: z.array(
    z.object({
      objectId: z.string(),
      objectLabel: z.string(),
      artifactType: z.string(),
      artifactId: z.string(),
      artifactTitle: z.string(),
      linkRole: z.enum(['context', 'source', 'output', 'evidence', 'related']),
      rationale: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const LinkedTableSchema = z.object({
  columns: z.array(
    z.object({
      key: z.string(),
      header: z.string(),
      sourceField: z.string().optional(),
    })
  ),
  rows: z.array(
    z.object({
      artifactType: z.string(),
      artifactId: z.string(),
      artifactTitle: z.string(),
      cells: z.record(z.string(), z.unknown()),
    })
  ),
});

const AutofillMappingsSchema = z.object({
  mappings: z.array(
    z.object({
      columnKey: z.string(),
      sourceField: z.string(),
      transform: z.string().optional(),
      rationale: z.string(),
    })
  ),
});

// V51-05: Whiteboard facilitation schemas
const WbFindThemesSchema = z.object({
  themes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
      nodeIds: z.array(z.string()),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const WbNameClustersSchema = z.object({
  namedClusters: z.array(
    z.object({
      clusterId: z.string(),
      name: z.string(),
      rationale: z.string(),
    })
  ),
});

// J26 (Kanał 2): edit_step — rewrite ONE existing process step. LLM returns the
// rewritten label (+ optional description) for the target node; the formatter
// wraps it in patch.updateNodes so Propose→Accept modifies that node in place
// (no new nodes, neighbours untouched). Pattern mirrors wb_name_clusters.
const EditStepSchema = z.object({
  label: z.string(),
  description: z.string().optional().nullable(),
  rationale: z.string().optional().nullable(),
});

const WbToMapBranchesSchema = z.object({
  rootLabel: z.string(),
  branches: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      children: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
        })
      ),
    })
  ),
});

const WbToTableSchema = z.object({
  columns: z.array(
    z.object({
      key: z.string(),
      header: z.string(),
    })
  ),
  rows: z.array(
    z.object({
      cells: z.record(z.string(), z.string()),
      sourceNodeId: z.string().optional(),
    })
  ),
});

const WbExtractActionsSchema = z.object({
  actions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      owner: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      sourceNodeId: z.string().optional(),
    })
  ),
});

// V51-06: Table AI schemas
const TableRowsSchema = z.object({
  rows: z.array(
    z.object({
      id: z.string(),
      cells: z.record(z.string(), z.unknown()),
      rationale: z.string().optional(),
    })
  ),
});

const TableSimplifySchema = z.object({
  removedColumnKeys: z.array(z.string()),
  mergedColumns: z.array(
    z.object({
      sourceKeys: z.array(z.string()),
      targetKey: z.string(),
      targetHeader: z.string(),
    })
  ),
  rationale: z.string(),
});

const SCHEMA_MAP: Record<GeneratorType, z.ZodSchema<any>> = {
  lane_generator: LaneProposalSchema,
  flow_generator: FlowProposalSchema,
  suggestions: SuggestionSchema,
  bottleneck: BottleneckSchema,
  enrichment: EnrichmentSchema,
  mindmap_expand: MindmapExpandSchema,
  table_columns: TableColumnsSchema,
  table_views: TableViewsSchema,
  whiteboard_clusters: WhiteboardClustersSchema,
  whiteboard_brainstorm: WhiteboardBrainstormSchema,
  whiteboard_organize: WhiteboardOrganizeSchema,
  summary: SummarySchema,
  node_context: NodeContextSchema,
  auto_cluster: AutoClusterSchema,
  node_expand: NodeExpandSchema,
  process_coach: ProcessCoachSchema,
  next_step: NextStepSchema,
  process_summary: ProcessSummarySchema,
  process_brief: ProcessBriefSchema,
  process_savings: ProcessSavingsSchema,
  edit_step: EditStepSchema,
  vsm_generator: VSMGeneratorSchema,
  sticky_summarize: StickySummarizeSchema,
  vsm_future_state: VSMFutureStateSchema,
  // V51-01: Artifact linking
  ai_retrieve_artifacts: ArtifactRetrievalSchema,
  ai_propose_attachments: AttachmentProposalSchema,
  ai_build_linked_table: LinkedTableSchema,
  ai_autofill_mappings: AutofillMappingsSchema,
  // V51-05: Whiteboard facilitation
  wb_find_themes: WbFindThemesSchema,
  wb_name_clusters: WbNameClustersSchema,
  wb_to_map_branches: WbToMapBranchesSchema,
  wb_to_table: WbToTableSchema,
  wb_extract_actions: WbExtractActionsSchema,
  // V51-06: Table AI
  table_rows: TableRowsSchema,
  table_simplify: TableSimplifySchema,
  // Mindmap-specific aliases
  mm_branch_generator: MindmapExpandSchema,
  mm_expand: NodeExpandSchema,
  mm_what_if: NodeExpandSchema,
};

// ── Context builder ──────────────────────────────────────────────────────────

async function buildOrgContext(orgId: string): Promise<OrgContext> {
  const ctx: OrgContext = {};
  try {
    const { default: orgContextService } =
      await import('./organizationContext/OrganizationContextService.js');
    const resolved = await orgContextService.buildResolvedContext(orgId);
    if (resolved) {
      ctx.name = resolved.profile.companyName || undefined;
      ctx.industry = resolved.profile.industry || undefined;
      ctx.size = resolved.profile.companySize || undefined;
      ctx.country = resolved.profile.location || undefined;
    }
  } catch {
    /* keep context sparse rather than bypass Organization SSOT */
  }

  try {
    const siri = await queryHelpers.queryOne<any>(
      `SELECT overall_score FROM assessments WHERE organization_id = ? AND framework = 'SIRI' ORDER BY updated_at DESC LIMIT 1`,
      [orgId]
    );
    if (siri?.overall_score != null) ctx.siriScore = Number(siri.overall_score);
  } catch {
    /* optional */
  }

  try {
    const adma = await queryHelpers.queryOne<any>(
      `SELECT overall_score FROM assessments WHERE organization_id = ? AND framework = 'ADMA' ORDER BY updated_at DESC LIMIT 1`,
      [orgId]
    );
    if (adma?.overall_score != null) ctx.admaScore = Number(adma.overall_score);
  } catch {
    /* optional */
  }

  try {
    const initiatives = await queryHelpers.queryAll<any>(
      `SELECT title FROM initiatives WHERE organization_id = ? AND status != 'archived' ORDER BY updated_at DESC LIMIT 10`,
      [orgId]
    );
    if (initiatives?.length) ctx.activeInitiatives = initiatives.map((i: any) => String(i.title));
  } catch {
    /* optional */
  }

  try {
    const kpis = await queryHelpers.queryAll<any>(
      `SELECT name FROM kpis WHERE organization_id = ? ORDER BY updated_at DESC LIMIT 10`,
      [orgId]
    );
    if (kpis?.length) ctx.kpis = kpis.map((k: any) => String(k.name));
  } catch {
    /* optional */
  }

  return ctx;
}

async function verifyArtifactCandidate(orgId: string, artifact: any): Promise<any> {
  const type = String(artifact?.type || '').toLowerCase();
  const rawId = String(artifact?.id || '').trim();
  if (!type || !rawId) {
    return { ...artifact, verified: false, verificationStatus: 'missing_id' };
  }

  const TABLE_MAP: Record<string, { table: string; title: string }> = {
    initiative: { table: 'initiatives', title: 'title' },
    task: { table: 'tasks', title: 'title' },
    decision: { table: 'decisions', title: 'title' },
    idea: { table: 'my_ideas', title: 'title' },
    report: { table: 'reports', title: 'title' },
    presentation: { table: 'presentations', title: 'title' },
    notebook: { table: 'notebooks', title: 'title' },
  };

  const tableCfg = TABLE_MAP[type];
  if (!tableCfg) {
    return { ...artifact, verified: false, verificationStatus: 'unsupported_type' };
  }

  try {
    const row = await queryHelpers.queryOne<any>(
      `SELECT id, ${tableCfg.title} AS title
       FROM ${tableCfg.table}
       WHERE id = ? AND organization_id = ?
       LIMIT 1`,
      [rawId, orgId]
    );
    if (!row) {
      return { ...artifact, verified: false, verificationStatus: 'not_found' };
    }
    return {
      ...artifact,
      id: row.id,
      title: row.title || artifact.title,
      verified: true,
      verificationStatus: 'verified',
    };
  } catch {
    return { ...artifact, verified: false, verificationStatus: 'lookup_failed' };
  }
}

async function verifyRetrievedArtifacts(orgId: string, output: any): Promise<any> {
  if (!Array.isArray(output?.artifacts) || output.artifacts.length === 0) return output;
  const verifiedArtifacts = await Promise.all(
    output.artifacts.map((artifact: any) => verifyArtifactCandidate(orgId, artifact))
  );
  return {
    ...output,
    artifacts: verifiedArtifacts,
  };
}

function buildOrgContextBlock(org: OrgContext, isPl: boolean): string {
  const parts: string[] = [];
  if (org.industry) parts.push(isPl ? `Branża: ${org.industry}` : `Industry: ${org.industry}`);
  if (org.size) parts.push(isPl ? `Wielkość: ${org.size}` : `Size: ${org.size}`);
  if (org.country) parts.push(isPl ? `Kraj: ${org.country}` : `Country: ${org.country}`);
  if (org.siriScore != null) parts.push(`SIRI maturity: ${org.siriScore}/5`);
  if (org.admaScore != null) parts.push(`ADMA score: ${org.admaScore}`);
  if (org.activeInitiatives?.length) {
    parts.push(
      isPl
        ? `Aktywne inicjatywy: ${org.activeInitiatives.join(', ')}`
        : `Active initiatives: ${org.activeInitiatives.join(', ')}`
    );
  }
  if (org.kpis?.length) {
    parts.push(isPl ? `KPI: ${org.kpis.join(', ')}` : `KPIs: ${org.kpis.join(', ')}`);
  }
  return parts.length > 0
    ? (isPl ? '\n\nKontekst firmy:\n' : '\n\nCompany context:\n') + parts.join('\n')
    : '';
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(
  generatorType: GeneratorType,
  ctx: GeneratorContext,
  orgCtx: OrgContext
): string {
  const isPl = ctx.language?.startsWith('pl');
  const orgBlock = buildOrgContextBlock(orgCtx, isPl);

  const existingNodeLabels = ctx.existingNodes
    .map((n: any) => String(n?.data?.label || n?.label || '').trim())
    .filter(Boolean)
    .slice(0, 50);
  const existingLaneLabels = (ctx.existingLanes || [])
    .map((l: any) => String(l?.label || '').trim())
    .filter(Boolean);

  // J26 (Kanał 2, edit_step): resolve the target step + its neighbours for grounding.
  const editStepTargetId = String(ctx.selection?.primaryId || ctx.selection?.ids?.[0] || '');
  const labelOfNode = (id: string): string => {
    const n = ctx.existingNodes.find((x: any) => String(x?.id) === String(id));
    return String(n?.data?.label || n?.label || '').trim();
  };
  const editStepTargetNode = ctx.existingNodes.find((n: any) => String(n?.id) === editStepTargetId);
  const editStepTargetLabel = String(
    editStepTargetNode?.data?.label || editStepTargetNode?.label || ''
  ).trim();
  const editStepTargetDesc = String(editStepTargetNode?.data?.description || '').trim();
  const editStepPredLabels = (ctx.existingEdges || [])
    .filter((e: any) => String(e?.target) === editStepTargetId)
    .map((e: any) => labelOfNode(String(e?.source)))
    .filter(Boolean);
  const editStepSuccLabels = (ctx.existingEdges || [])
    .filter((e: any) => String(e?.source) === editStepTargetId)
    .map((e: any) => labelOfNode(String(e?.target)))
    .filter(Boolean);

  const prompts: Record<GeneratorType, string> = {
    lane_generator: isPl
      ? `Jesteś konsultantem zarządzania. Na podstawie opisu wyzwania biznesowego zaproponuj 3-7 swimlanes dla mapy procesu. Każdy lane to rola, departament lub faza procesu. Odpowiedz TYLKO w formacie JSON zgodnym ze schematem.${orgBlock}

Istniejące elementy na mapie: ${existingNodeLabels.join(', ') || 'brak'}
Istniejące lane'y: ${existingLaneLabels.join(', ') || 'brak'}`
      : `You are a management consultant. Based on the business challenge description, propose 3-7 swimlanes for a process map. Each lane represents a role, department, or process phase. Respond ONLY in JSON matching the schema.${orgBlock}

Existing map elements: ${existingNodeLabels.join(', ') || 'none'}
Existing lanes: ${existingLaneLabels.join(', ') || 'none'}`,

    flow_generator: isPl
      ? `Jesteś ekspertem od mapowania procesów. Na podstawie opisu wyzwania i istniejących lanes, zaproponuj kompletny przepływ procesu. Użyj kształtów: start, action, decision, end. Każdy node przypisz do lane'u (laneId). Dodaj edge labels dla decyzji (Tak/Nie). Odpowiedz TYLKO w formacie JSON.${orgBlock}

Istniejące lane'y: ${existingLaneLabels.join(', ') || 'brak'}
Istniejące elementy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a process mapping expert. Based on the challenge description and existing lanes, propose a complete process flow. Use shapes: start, action, decision, end. Assign each node to a lane (laneId). Add edge labels for decisions (Yes/No). Respond ONLY in JSON.${orgBlock}

Existing lanes: ${existingLaneLabels.join(', ') || 'none'}
Existing elements: ${existingNodeLabels.join(', ') || 'none'}`,

    suggestions: isPl
      ? `Jesteś doradcą strategicznym. Analizujesz wyzwanie biznesowe i proponujesz: tematy do analizy (topics), wnioski (findings), następne kroki (next_steps), frameworki konsultingowe (frameworks), ryzyka (risks), benchmarki branżowe (benchmarks). Każda sugestia ma confidence (0-1). Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące elementy workspace: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a strategic advisor. Analyze the business challenge and propose: topics to analyze (topics), findings/insights (findings), next steps (next_steps), consulting frameworks (frameworks), risks (risks), industry benchmarks (benchmarks). Each suggestion has confidence (0-1). Respond ONLY in JSON.${orgBlock}

Existing workspace elements: ${existingNodeLabels.join(', ') || 'none'}`,

    bottleneck: isPl
      ? `Jesteś ekspertem od optymalizacji procesów. Przeanalizuj topologię przepływu procesu i zidentyfikuj wąskie gardła, zbędne kroki, brakujące ścieżki równoległe. Odpowiedz TYLKO w JSON.${orgBlock}`
      : `You are a process optimization expert. Analyze the process flow topology and identify bottlenecks, redundant steps, missing parallel paths. Respond ONLY in JSON.${orgBlock}`,

    enrichment: isPl
      ? `Jesteś konsultantem operacyjnym. Uzupełnij brakujące informacje w węzłach procesu: opisy, właścicieli, szacowany czas, status. Odpowiedz TYLKO w JSON.${orgBlock}`
      : `You are an operations consultant. Enrich missing information in process nodes: descriptions, owners, estimated duration, status. Respond ONLY in JSON.${orgBlock}`,

    mindmap_expand: isPl
      ? `Jesteś doradcą strategicznym. Na podstawie opisu wyzwania rozbuduj mapę myśli o nowe gałęzie z konkretnymi akcjami. Zaproponuj 5-7 nowych węzłów. Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące gałęzie: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a strategic advisor. Based on the challenge description, expand the mind map with new branches and concrete actions. Propose 5-7 new nodes. Respond ONLY in JSON.${orgBlock}

Existing branches: ${existingNodeLabels.join(', ') || 'none'}`,

    table_columns: isPl
      ? `Jesteś analitykiem biznesowym. Na podstawie opisu wyzwania zaproponuj zestaw kolumn do tabeli roboczej. Kolumny powinny wspierać triage, priorytetyzację i śledzenie postępu. Odpowiedz TYLKO w JSON.${orgBlock}`
      : `You are a business analyst. Based on the challenge description, propose a set of columns for a working table. Columns should support triage, prioritization, and progress tracking. Respond ONLY in JSON.${orgBlock}`,

    table_views: isPl
      ? `Jesteś analitykiem biznesowym. Zaproponuj 2-4 gotowe widoki tabeli (triage, scoring, ryzyka, decision log). Każdy widok ma groupBy, sortBy lub filterBy. Odpowiedz TYLKO w JSON.${orgBlock}`
      : `You are a business analyst. Propose 2-4 ready-made table views (triage, scoring, risks, decision log). Each view has groupBy, sortBy, or filterBy. Respond ONLY in JSON.${orgBlock}`,

    whiteboard_clusters: isPl
      ? `Jesteś facylitatorem warsztatów strategicznych. Na podstawie opisu wyzwania i istniejących elementów na tablicy, pogrupuj pomysły w 3-5 tematycznych klastrów. Każdy klaster ma nazwę, kolor i 2-4 sticky notes. Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące elementy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a strategic workshop facilitator. Based on the challenge description and existing whiteboard elements, group ideas into 3-5 thematic clusters. Each cluster has a name, color, and 2-4 sticky notes. Respond ONLY in JSON.${orgBlock}

Existing elements: ${existingNodeLabels.join(', ') || 'none'}`,

    whiteboard_brainstorm: isPl
      ? `Jesteś kreatywnym facylitatorem brainstormingu. Na podstawie opisu wyzwania wygeneruj 5-7 sticky notes z pomysłami. Każdy pomysł powinien być konkretny, wykonalny i osadzony w kontekście firmy. Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące elementy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a creative brainstorming facilitator. Based on the challenge description, generate 5-7 sticky notes with ideas. Each idea should be specific, actionable, and grounded in company context. Respond ONLY in JSON.${orgBlock}

Existing elements: ${existingNodeLabels.join(', ') || 'none'}`,

    whiteboard_organize: isPl
      ? `Jesteś ekspertem od wizualnego myślenia. Przeanalizuj istniejące elementy na tablicy i zaproponuj logiczne grupy oraz nowy układ. Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące elementy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a visual thinking expert. Analyze existing whiteboard elements and propose logical groups and a new layout. Respond ONLY in JSON.${orgBlock}

Existing elements: ${existingNodeLabels.join(', ') || 'none'}`,

    summary: isPl
      ? `Jesteś doradcą strategicznym. Na podstawie mapy pomysłów przygotuj: executive summary (2-3 zdania), kluczowe wnioski (3-5 punktów), następne kroki (3-5 punktów), ryzyka (2-3 punkty). Odpowiedz TYLKO w JSON.${orgBlock}

Elementy mapy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a strategic advisor. Based on the idea map, prepare: executive summary (2-3 sentences), key findings (3-5 points), next steps (3-5 points), risks (2-3 points). Respond ONLY in JSON.${orgBlock}

Map elements: ${existingNodeLabels.join(', ') || 'none'}`,

    node_context: isPl
      ? `Jesteś doradcą strategicznym z głęboką wiedzą o firmie. Analizujesz konkretny element mapy pomysłów i dostarczasz kontekst: powiązane inicjatywy firmy, ryzyka, KPI, oraz sugestie rozwoju tego pomysłu. Bądź konkretny i osadzony w kontekście organizacji. Odpowiedz TYLKO w JSON.${orgBlock}

Inne elementy na mapie: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a strategic advisor with deep company knowledge. Analyze a specific idea map element and provide context: related company initiatives, risks, KPIs, and development suggestions. Be specific and grounded in organizational context. Respond ONLY in JSON.${orgBlock}

Other map elements: ${existingNodeLabels.join(', ') || 'none'}`,

    auto_cluster: isPl
      ? `Jesteś ekspertem od wizualnego myślenia i facylitatorem. Przeanalizuj elementy na tablicy i pogrupuj je w logiczne klastry tematyczne. Każdy klaster ma nazwę, kolor (hex) i listę nodeIds. Zaproponuj 3-6 klastrów. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy na tablicy: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'brak'}`
      : `You are a visual thinking expert and facilitator. Analyze whiteboard elements and group them into logical thematic clusters. Each cluster has a name, color (hex), and list of nodeIds. Propose 3-6 clusters. Respond ONLY in JSON.${orgBlock}

Whiteboard elements: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'none'}`,

    node_expand: isPl
      ? `Jesteś ekspertem od optymalizacji procesów. Przeanalizuj krok procesu i zaproponuj: pod-kroki do rozbicia, ryzyka związane z tym krokiem, metryki do pomiaru wydajności, oraz optymalizacje do poprawy. Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące elementy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a process optimization expert. Analyze the process step and propose: sub-steps to break it down, risks associated with this step, metrics to measure performance, and optimizations to improve it. Respond ONLY in JSON.${orgBlock}

Existing elements: ${existingNodeLabels.join(', ') || 'none'}`,

    process_coach: isPl
      ? `Jesteś starszym konsultantem ds. doskonalenia procesów. Przeanalizuj topologię przepływu procesu: ${ctx.existingNodes.length} kroków, ${ctx.existingEdges.length} połączeń, ${existingLaneLabels.length} lane'ów. Zidentyfikuj: brakujące kroki, zbyt wiele przekazań między lane'ami, możliwości przetwarzania równoległego, brakujące walidacje po decyzjach, wąskie gardła. Wskaż konkretnie, które węzły są dotknięte. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'brak'}
Lane'y: ${existingLaneLabels.join(', ') || 'brak'}`
      : `You are a senior process improvement consultant. Analyze the process flow topology: ${ctx.existingNodes.length} steps, ${ctx.existingEdges.length} connections, ${existingLaneLabels.length} lanes. Identify: missing steps, too many handoffs between lanes, parallel processing opportunities, missing validation after decisions, bottlenecks. Be specific about which nodes are affected. Respond ONLY in JSON.${orgBlock}

Elements: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'none'}
Lanes: ${existingLaneLabels.join(', ') || 'none'}`,

    next_step: isPl
      ? `Jesteś ekspertem od projektowania procesów. Użytkownik właśnie dodał krok w procesie "${ctx.seedText || ctx.title}". Zaproponuj 2-3 następne logiczne kroki. Każdy krok powinien mieć kształt (action/decision/end) i krótkie uzasadnienie. Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące elementy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a process design expert. The user just added a step in process "${ctx.seedText || ctx.title}". Propose 2-3 next logical steps that would follow. Each step should have a shape (action/decision/end) and brief rationale. Respond ONLY in JSON.${orgBlock}

Existing elements: ${existingNodeLabels.join(', ') || 'none'}`,

    process_summary: isPl
      ? `Jesteś analitykiem procesów. Podsumuj przepływ procesu: policz kroki, decyzje, lane'y, zidentyfikuj ścieżkę krytyczną, oszacuj całkowity czas trwania, wymień główne ryzyka i rekomendacje. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'brak'}
Lane'y: ${existingLaneLabels.join(', ') || 'brak'}`
      : `You are a process analyst. Summarize the process flow: count steps, decisions, lanes, identify the critical path, estimate total duration, list top risks and recommendations. Respond ONLY in JSON.${orgBlock}

Elements: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'none'}
Lanes: ${existingLaneLabels.join(', ') || 'none'}`,

    process_brief: isPl
      ? `Jesteś konsultantem process excellence. Przygotuj structured brief procesu gotowy do review. Zwróć: objective, currentGaps (3-5), nextMoves (3-5), reviewCheckpoints (3-5). Odpowiedz TYLKO w JSON.${orgBlock}

Elementy: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'brak'}
Lane'y: ${existingLaneLabels.join(', ') || 'brak'}`
      : `You are a process excellence consultant. Prepare a structured process brief ready for review. Return: objective, currentGaps (3-5), nextMoves (3-5), reviewCheckpoints (3-5). Respond ONLY in JSON.${orgBlock}

Elements: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'none'}
Lanes: ${existingLaneLabels.join(', ') || 'none'}`,

    process_savings: isPl
      ? `Jesteś konsultantem automatyzacji procesów. Oceń każdy ważny krok procesu pod kątem potencjału automatyzacji i oszczędności. Zwróć recommendations[] z: nodeId, automationPotential, savingsEstimate, implementationEffort, rationale oraz summary z totalSavingsEstimate, topOpportunityNodeIds i notes. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy: ${
          ctx.existingNodes
            .map(
              (node: any, i: number) =>
                `${node?.id || i}: ${node?.data?.label || existingNodeLabels[i] || 'step'} | duration=${node?.data?.duration || 'n/a'} | cost=${node?.data?.cost || 'n/a'} | automationCandidate=${node?.data?.automationCandidate ? 'yes' : 'no'}`
            )
            .join(', ') || 'brak'
        }
Lane'y: ${existingLaneLabels.join(', ') || 'brak'}`
      : `You are a process automation consultant. Assess each important process step for automation and savings potential. Return recommendations[] with: nodeId, automationPotential, savingsEstimate, implementationEffort, rationale plus a summary with totalSavingsEstimate, topOpportunityNodeIds, and notes. Respond ONLY in JSON.${orgBlock}

Elements: ${
          ctx.existingNodes
            .map(
              (node: any, i: number) =>
                `${node?.id || i}: ${node?.data?.label || existingNodeLabels[i] || 'step'} | duration=${node?.data?.duration || 'n/a'} | cost=${node?.data?.cost || 'n/a'} | automationCandidate=${node?.data?.automationCandidate ? 'yes' : 'no'}`
            )
            .join(', ') || 'none'
        }
Lanes: ${existingLaneLabels.join(', ') || 'none'}`,

    vsm_generator: isPl
      ? `Jesteś ekspertem Lean manufacturing. Na podstawie opisu procesu wygeneruj mapę strumienia wartości (VSM) stanu obecnego z realistycznymi metrykami dla branży ${orgCtx.industry || 'produkcyjnej'}. Uwzględnij: bloki procesowe z czasem cyklu/przezbrojenia/dostępności, trójkąty zapasów, strzałki push/pull, dane osi czasu. Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące elementy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a Lean manufacturing expert. Based on the process description, generate a current state Value Stream Map with realistic metrics for the ${orgCtx.industry || 'manufacturing'} industry. Include: process boxes with cycle time/changeover/uptime, inventory triangles, push/pull arrows, timeline data. Respond ONLY in JSON.${orgBlock}

Existing elements: ${existingNodeLabels.join(', ') || 'none'}`,

    sticky_summarize: isPl
      ? `Jesteś facylitatorem warsztatów. Podsumuj poniższe sticky notes w zwięzłe podsumowanie i zidentyfikuj kluczowe tematy. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy do podsumowania: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a workshop facilitator. Summarize the following sticky notes into a concise summary and identify key themes. Respond ONLY in JSON.${orgBlock}

Elements to summarize: ${existingNodeLabels.join(', ') || 'none'}`,

    vsm_future_state: isPl
      ? `Jesteś ekspertem od transformacji Lean. Przeanalizuj obecny stan VSM i zaproponuj stan przyszły z optymalizacjami: skrócone czasy cyklu, wyeliminowane marnotrawstwo, usprawniony przepływ. Wymień konkretne usprawnienia z opisem wpływu. Odpowiedz TYLKO w JSON.${orgBlock}

Obecne elementy VSM: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'brak'}`
      : `You are a Lean transformation expert. Analyze the current state VSM and propose a future state with optimizations: reduced cycle times, eliminated waste, improved flow. List specific improvements with impact. Respond ONLY in JSON.${orgBlock}

Current VSM elements: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'none'}`,

    // V51-01: Artifact linking prompts
    ai_retrieve_artifacts: isPl
      ? `Jesteś asystentem platformy konsultingowej. Na podstawie opisu pomysłu i kontekstu firmy, zaproponuj artefakty platformy (inicjatywy, zadania, decyzje, raporty, prezentacje, narzędzia, notatki, modele finansowe), które mogą być powiązane z tym pomysłem. Dla każdego artefaktu podaj typ, tytuł, relevance, confidence (0-1) i uzasadnienie. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy workspace: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a consulting platform assistant. Based on the idea description and company context, suggest platform artifacts (initiatives, tasks, decisions, reports, presentations, tools, notebooks, financial models) that may be relevant to this idea. For each artifact provide type, title, relevance, confidence (0-1), and rationale. Respond ONLY in JSON.${orgBlock}

Workspace elements: ${existingNodeLabels.join(', ') || 'none'}`,

    ai_propose_attachments: isPl
      ? `Jesteś asystentem platformy konsultingowej. Przeanalizuj elementy workspace i zaproponuj, które artefakty platformy powinny być powiązane z konkretnymi obiektami (węzłami, krokami, wierszami). Dla każdego powiązania podaj: objectId, objectLabel, artifactType, artifactTitle, linkRole (context/source/output/evidence/related), rationale i confidence. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy workspace: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'brak'}`
      : `You are a consulting platform assistant. Analyze workspace elements and propose which platform artifacts should be linked to specific objects (nodes, steps, rows). For each proposal provide: objectId, objectLabel, artifactType, artifactTitle, linkRole (context/source/output/evidence/related), rationale, and confidence. Respond ONLY in JSON.${orgBlock}

Workspace elements: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'none'}`,

    ai_build_linked_table: isPl
      ? `Jesteś analitykiem biznesowym. Na podstawie powiązanych artefaktów i kontekstu pomysłu, zaproponuj strukturę tabeli porównawczej: kolumny (z opcjonalnym sourceField wskazującym pole artefaktu) i wiersze (każdy wiersz to jeden artefakt z wypełnionymi komórkami). Odpowiedz TYLKO w JSON.${orgBlock}

Elementy workspace: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a business analyst. Based on linked artifacts and idea context, propose a comparison table structure: columns (with optional sourceField pointing to artifact field) and rows (each row is one artifact with populated cells). Respond ONLY in JSON.${orgBlock}

Workspace elements: ${existingNodeLabels.join(', ') || 'none'}`,

    ai_autofill_mappings: isPl
      ? `Jesteś analitykiem danych. Przeanalizuj kolumny tabeli i dostępne pola artefaktów, a następnie zaproponuj mapowania autofill: która kolumna powinna być wypełniana z jakiego pola artefaktu, z opcjonalną transformacją. Odpowiedz TYLKO w JSON.${orgBlock}`
      : `You are a data analyst. Analyze table columns and available artifact fields, then propose autofill mappings: which column should be populated from which artifact field, with optional transformation. Respond ONLY in JSON.${orgBlock}`,

    // V51-05: Whiteboard facilitation prompts
    wb_find_themes: isPl
      ? `Jesteś facylitatorem warsztatów strategicznych. Przeanalizuj sticky notes na tablicy i zidentyfikuj 3-6 tematów przewodnich. Dla każdego tematu podaj nazwę, opis, listę nodeIds i confidence. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'brak'}`
      : `You are a strategic workshop facilitator. Analyze sticky notes on the whiteboard and identify 3-6 overarching themes. For each theme provide name, description, list of nodeIds, and confidence. Respond ONLY in JSON.${orgBlock}

Elements: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'none'}`,

    wb_name_clusters: isPl
      ? `Jesteś facylitatorem warsztatów. Nadaj nazwy istniejącym klastrom na tablicy na podstawie ich zawartości. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a workshop facilitator. Name existing clusters on the whiteboard based on their content. Respond ONLY in JSON.${orgBlock}

Elements: ${existingNodeLabels.join(', ') || 'none'}`,

    wb_to_map_branches: isPl
      ? `Jesteś ekspertem od strukturyzacji myśli. Przekształć klastry sticky notes w strukturę mapy myśli: jeden root z gałęziami (branches), każda gałąź z dziećmi. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a thought structuring expert. Transform sticky note clusters into a mind map structure: one root with branches, each branch with children. Respond ONLY in JSON.${orgBlock}

Elements: ${existingNodeLabels.join(', ') || 'none'}`,

    wb_to_table: isPl
      ? `Jesteś analitykiem biznesowym. Przekształć sticky notes z tablicy w ustrukturyzowaną tabelę: zaproponuj kolumny i wypełnij wiersze danymi z notatek. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'brak'}`
      : `You are a business analyst. Transform whiteboard sticky notes into a structured table: propose columns and populate rows with data from notes. Respond ONLY in JSON.${orgBlock}

Elements: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'none'}`,

    wb_extract_actions: isPl
      ? `Jesteś facylitatorem warsztatów. Przeanalizuj sticky notes i wyodrębnij konkretne akcje do wykonania. Dla każdej akcji podaj tekst, opcjonalnego właściciela i priorytet. Odpowiedz TYLKO w JSON.${orgBlock}

Elementy: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'brak'}`
      : `You are a workshop facilitator. Analyze sticky notes and extract concrete action items. For each action provide text, optional owner, and priority. Respond ONLY in JSON.${orgBlock}

Elements: ${existingNodeLabels.map((l, i) => `${ctx.existingNodes[i]?.id || i}: ${l}`).join(', ') || 'none'}`,

    // Mindmap-specific aliases
    mm_branch_generator: isPl
      ? `Jesteś doradcą strategicznym. Na podstawie opisu wyzwania rozbuduj mapę myśli o nowe gałęzie z konkretnymi akcjami. Zaproponuj 5-7 nowych węzłów. Odpowiedz TYLKO w formacie JSON.${orgBlock}

Istniejące gałęzie: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a strategic advisor. Based on the challenge description, expand the mind map with new branches and concrete actions. Propose 5-7 new nodes. Respond ONLY in JSON.${orgBlock}

Existing branches: ${existingNodeLabels.join(', ') || 'none'}`,

    mm_expand: isPl
      ? `Jesteś ekspertem od optymalizacji procesów. Przeanalizuj krok procesu i zaproponuj: pod-kroki do rozbicia, ryzyka związane z tym krokiem, metryki do pomiaru wydajności, oraz optymalizacje do poprawy. Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące elementy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a process optimization expert. Analyze the process step and propose: sub-steps to break it down, risks associated with this step, metrics to measure performance, and optimizations to improve it. Respond ONLY in JSON.${orgBlock}

Existing elements: ${existingNodeLabels.join(', ') || 'none'}`,

    mm_what_if: isPl
      ? `Jesteś ekspertem od scenariuszy strategicznych. Wygeneruj scenariusze "co jeśli" dla danego kontekstu węzła. Zbadaj alternatywne wyniki i przypadki brzegowe. Zaproponuj pod-kroki, ryzyka, metryki i optymalizacje. Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące elementy: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a strategic scenario expert. Generate what-if scenarios for the given node context. Explore alternative outcomes and edge cases. Propose sub-steps, risks, metrics, and optimizations. Respond ONLY in JSON.${orgBlock}

Existing elements: ${existingNodeLabels.join(', ') || 'none'}`,

    // V51-06: Table AI prompts
    table_rows: isPl
      ? `Jesteś analitykiem biznesowym. Na podstawie opisu wyzwania i istniejących kolumn tabeli, wygeneruj 5-10 wierszy z realistycznymi danymi. Każdy wiersz ma cells (klucz kolumny → wartość). Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące kolumny: ${(ctx as any).columns?.map?.((c: any) => c.header || c.key)?.join(', ') || existingNodeLabels.join(', ') || 'brak'}`
      : `You are a business analyst. Based on the challenge description and existing table columns, generate 5-10 rows with realistic data. Each row has cells (column key → value). Respond ONLY in JSON.${orgBlock}

Existing columns: ${(ctx as any).columns?.map?.((c: any) => c.header || c.key)?.join(', ') || existingNodeLabels.join(', ') || 'none'}`,

    table_simplify: isPl
      ? `Jesteś analitykiem danych. Przeanalizuj tabelę i zaproponuj uproszczenie: które kolumny usunąć (nieistotne, puste), które połączyć (redundantne). Podaj uzasadnienie. Odpowiedz TYLKO w JSON.${orgBlock}

Istniejące kolumny: ${existingNodeLabels.join(', ') || 'brak'}`
      : `You are a data analyst. Analyze the table and propose simplification: which columns to remove (irrelevant, empty), which to merge (redundant). Provide rationale. Respond ONLY in JSON.${orgBlock}

Existing columns: ${existingNodeLabels.join(', ') || 'none'}`,

    // J26 (Kanał 2): rewrite ONE existing step in place. NEVER add or touch other steps.
    edit_step: isPl
      ? `Jesteś ekspertem od mapowania procesów. Przeredaguj JEDEN wskazany krok procesu zgodnie z instrukcją użytkownika. NIE twórz nowych kroków i NIE zmieniaj innych kroków — przepisz WYŁĄCZNIE etykietę (label) i, jeśli to zasadne, opis (description) TEGO kroku. Zachowaj spójność z sąsiednimi krokami. Odpowiedz TYLKO w formacie JSON zgodnym ze schematem: { label, description }.${orgBlock}

Krok do przeredagowania: "${editStepTargetLabel || 'brak'}"${editStepTargetDesc ? ` (obecny opis: ${editStepTargetDesc})` : ''}
Poprzednie kroki: ${editStepPredLabels.join(', ') || 'brak'}
Następne kroki: ${editStepSuccLabels.join(', ') || 'brak'}`
      : `You are a process mapping expert. Rewrite ONE specified process step according to the user's instruction. Do NOT create new steps and do NOT change other steps — rewrite ONLY the label and, if warranted, the description of THIS step. Keep it consistent with the neighbouring steps. Respond ONLY in JSON matching the schema: { label, description }.${orgBlock}

Step to rewrite: "${editStepTargetLabel || 'none'}"${editStepTargetDesc ? ` (current description: ${editStepTargetDesc})` : ''}
Previous steps: ${editStepPredLabels.join(', ') || 'none'}
Next steps: ${editStepSuccLabels.join(', ') || 'none'}`,
  };

  return prompts[generatorType] || prompts.suggestions;
}

function buildUserMessage(ctx: GeneratorContext): string {
  const isPl = ctx.language?.startsWith('pl');
  const parts: string[] = [];

  if (ctx.title) parts.push(isPl ? `Tytuł: ${ctx.title}` : `Title: ${ctx.title}`);
  if (ctx.seedText)
    parts.push(
      isPl
        ? `Opis:\n${ctx.seedText.slice(0, 3000)}`
        : `Description:\n${ctx.seedText.slice(0, 3000)}`
    );
  if (ctx.branch) parts.push(isPl ? `Gałąź: ${ctx.branch}` : `Branch: ${ctx.branch}`);
  if (ctx.area) parts.push(isPl ? `Obszar: ${ctx.area}` : `Area: ${ctx.area}`);
  if (ctx.selection?.ids?.length) {
    parts.push(
      isPl
        ? `Zaznaczenie: ${ctx.selection.ids.length} elementów`
        : `Selection: ${ctx.selection.ids.length} items`
    );
  }

  return (
    parts.join('\n\n') || (isPl ? 'Brak opisu wyzwania.' : 'No challenge description provided.')
  );
}

// ── Main generator function ──────────────────────────────────────────────────

export async function generateIdeaAI(request: GeneratorRequest): Promise<any> {
  const { generatorType, tool, context, userId, orgId } = request;
  const rawScopedContext = getScopedGeneratorContext(generatorType, context);

  // Język odpowiedzi ustalamy RAZ, na wejściu, z TREŚCI użytkownika (tytuł, seed,
  // etykiety węzłów/lane'ów) — flaga UI (`context.language` = `i18n.language`) jest
  // tylko fallbackiem. Bez tego polska mapa przy interfejsie EN dostawała angielskie
  // propozycje. Dalszy kod (buildSystemPrompt / buildUserMessage / formatIdeaGeneratorOutput)
  // czyta `context.language`, więc podmiana tutaj naprawia WSZYSTKIE generatory naraz.
  const { resolveResponseLanguage, withLanguageInstruction } =
    await import('./ai/responseLanguage.js');
  const responseLanguage = resolveResponseLanguage({
    requested: rawScopedContext.language,
    samples: [
      rawScopedContext.title,
      rawScopedContext.seedText,
      rawScopedContext.branch,
      rawScopedContext.area,
      ...(rawScopedContext.existingNodes || [])
        .slice(0, 60)
        .map((n: any) => String(n?.data?.label || n?.label || '')),
      ...(rawScopedContext.existingLanes || [])
        .slice(0, 20)
        .map((l: any) => String(l?.label || '')),
    ],
  });
  const scopedContext: GeneratorContext = { ...rawScopedContext, language: responseLanguage };

  const schema = SCHEMA_MAP[generatorType];
  if (!schema) {
    throw new Error(`Unknown generatorType: ${generatorType}`);
  }

  const orgCtx = await buildOrgContext(orgId);
  const systemPrompt = withLanguageInstruction(
    buildSystemPrompt(generatorType, scopedContext, orgCtx),
    responseLanguage
  );
  const userMessage = buildUserMessage(scopedContext);

  const { llmService } = await import('./ai/llmService.js');
  const modelRouter = (await import('./ai/modelRouter.js')).default;

  const tier = ['suggestions', 'bottleneck'].includes(generatorType) ? 'STANDARD' : 'BUDGET';
  const modelCfg = await modelRouter.select({
    capability: 'chat',
    organizationId: orgId,
    options: { tier },
  });

  logger.info(`[IdeaAIGenerator] Calling LLM for ${generatorType} (tool=${tool}, tier=${tier})`);

  const result = await llmService.callStructured({
    type: 'structured',
    modelConfig: modelCfg,
    systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    schema,
    maxTokens: 2000,
    temperature: 0.7,
    timeoutMs: 30000,
  });

  let output = (result as any)?.object || result;
  if (generatorType === 'ai_retrieve_artifacts') {
    output = await verifyRetrievedArtifacts(orgId, output);
  }
  if (generatorType === 'edit_step') {
    // The target node id is context (selection.primaryId), not part of the LLM
    // output — attach it so the formatter can build patch.updateNodes for it.
    output = {
      ...output,
      _targetId: String(
        scopedContext.selection?.primaryId || scopedContext.selection?.ids?.[0] || ''
      ),
    };
  }

  const ts = Date.now();
  const proposalId = `gen-${ts}-${Math.random().toString(36).slice(2, 6)}`;

  return formatIdeaGeneratorOutput(generatorType, tool, output, proposalId, scopedContext.language);
}

// ── Format LLM output as AIProposalBatch ─────────────────────────────────────

const WHITEBOARD_STICKY_PALETTE = [
  '#fef3c7',
  '#dbeafe',
  '#d1fae5',
  '#fce7f3',
  '#ede9fe',
  '#fee2e2',
  '#e0e7ff',
];

const WHITEBOARD_FRAME_PALETTE = [
  'rgba(245, 158, 11, 0.08)',
  'rgba(59, 130, 246, 0.08)',
  'rgba(16, 185, 129, 0.08)',
  'rgba(236, 72, 153, 0.08)',
  'rgba(139, 92, 246, 0.08)',
  'rgba(148, 163, 184, 0.12)',
];

function createGridPosition(index: number, startX = 80, startY = 80, columns = 3) {
  return {
    x: startX + (index % columns) * 240,
    y: startY + Math.floor(index / columns) * 180,
  };
}

function toWhiteboardColorIndex(color: unknown, fallback = 0): number {
  if (typeof color === 'number' && Number.isFinite(color))
    return Math.max(0, Math.round(color)) % 7;
  if (typeof color !== 'string' || !color.trim()) return fallback % 7;
  const normalized = color.trim().toLowerCase();
  const matchedIndex = WHITEBOARD_STICKY_PALETTE.findIndex(
    (entry) => entry.toLowerCase() === normalized
  );
  return matchedIndex >= 0 ? matchedIndex : fallback % 7;
}

function toWhiteboardPriority(priority: unknown): number | undefined {
  if (typeof priority === 'number' && Number.isFinite(priority)) {
    return Math.max(0, Math.min(100, Math.round(priority)));
  }
  if (typeof priority !== 'string') return undefined;
  const normalized = priority.trim().toLowerCase();
  if (normalized === 'high') return 80;
  if (normalized === 'medium') return 55;
  if (normalized === 'low') return 25;
  return undefined;
}

function createWhiteboardStickyNode(node: {
  id: string;
  label: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
  color?: unknown;
  author?: unknown;
  priority?: unknown;
}) {
  const data = node.data && typeof node.data === 'object' ? node.data : {};
  return {
    id: node.id,
    label: node.label,
    type: 'stickyNote',
    position: node.position,
    data: {
      ...data,
      label: node.label,
      author:
        typeof data.author === 'string'
          ? data.author
          : typeof node.author === 'string'
            ? node.author
            : typeof (data as Record<string, unknown>).owner === 'string'
              ? (data as Record<string, unknown>).owner
              : undefined,
      priority:
        toWhiteboardPriority((data as Record<string, unknown>).priority) ??
        toWhiteboardPriority(node.priority),
      colorIndex: toWhiteboardColorIndex(
        (data as Record<string, unknown>).colorIndex ??
          (data as Record<string, unknown>).color ??
          node.color,
        0
      ),
    },
  };
}

function createWhiteboardFrameNode(node: {
  id: string;
  label: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
  bgColor?: string;
  width?: number;
  height?: number;
}) {
  const data = node.data && typeof node.data === 'object' ? node.data : {};
  return {
    id: node.id,
    label: node.label,
    type: 'frameNode',
    position: node.position,
    data: {
      ...data,
      label: node.label,
      bgColor:
        typeof (data as Record<string, unknown>).bgColor === 'string'
          ? (data as Record<string, unknown>).bgColor
          : node.bgColor,
      width:
        typeof (data as Record<string, unknown>).width === 'number'
          ? (data as Record<string, unknown>).width
          : node.width,
      height:
        typeof (data as Record<string, unknown>).height === 'number'
          ? (data as Record<string, unknown>).height
          : node.height,
    },
  };
}

function createTableRowNodes(rows: Array<Record<string, any>>, ts: number) {
  return rows.map((row, index) => {
    const cells = row?.cells && typeof row.cells === 'object' ? row.cells : {};
    const label =
      String(cells.title || cells.label || cells.name || Object.values(cells)[0] || '').trim() ||
      `Row ${index + 1}`;
    return {
      id: `wb-table-row-${ts}-${index}`,
      type: 'idea',
      position: createGridPosition(index, 120, 120, 2),
      data: {
        label,
        ...cells,
        ...(row?.sourceNodeId ? { sourceNodeId: row.sourceNodeId } : {}),
      },
    };
  });
}

export function formatIdeaGeneratorOutput(
  generatorType: GeneratorType,
  tool: CanvasTool,
  output: any,
  batchId: string,
  language: string
): any {
  const isPl = language?.startsWith('pl');
  const ts = Date.now();

  if (generatorType === 'lane_generator') {
    const lanes = output?.lanes || [];
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-lanes`,
          type: 'graph_patch',
          rationale: lanes.map((l: any) => l.rationale || l.label).join(', '),
          confidence: 0.8,
          patch: {
            extensions: {
              processFlow: {
                lanes: lanes.map((l: any, i: number) => ({
                  id: l.id || `lane-${ts}-${i}`,
                  label: l.label,
                  color:
                    l.color ||
                    ['#e0e7ff', '#dbeafe', '#d1fae5', '#fef3c7', '#fce7f3', '#ede9fe'][i % 6],
                })),
              },
            },
          },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'flow_generator') {
    const addNodes = (output?.addNodes || []).map((n: any, i: number) => ({
      id: n.id || `pf-${ts}-${i}`,
      label: n.label,
      type: 'flowNode',
      position: n.position || { x: 100 + i * 200, y: 80 },
      data: { shape: n.shape || 'action', laneId: n.laneId },
    }));
    const addEdges = (output?.addEdges || []).map((e: any, i: number) => ({
      id: e.id || `e-${ts}-${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      data: { conditionType: e.conditionType },
    }));
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-flow`,
          type: 'graph_patch',
          rationale: isPl
            ? `Proponuję przepływ z ${addNodes.length} krokami i ${addEdges.length} połączeniami`
            : `Proposing flow with ${addNodes.length} steps and ${addEdges.length} connections`,
          confidence: 0.75,
          patch: { addNodes, addEdges },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'suggestions') {
    const suggestions = output?.suggestions || [];
    return {
      id: batchId,
      tool,
      generatorType,
      suggestions,
      createdAt: ts,
    };
  }

  if (generatorType === 'bottleneck') {
    const findings = output?.findings || [];
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: findings.map((f: any, i: number) => ({
        id: `prop-${ts}-bn-${i}`,
        type: 'graph_patch',
        rationale: `${f.issue}: ${f.suggestion}`,
        confidence: f.confidence || 0.7,
        patch: f.nodeId ? { updateNodes: [{ id: f.nodeId, data: { _bottleneck: f.issue } }] } : {},
        status: 'pending',
      })),
      createdAt: ts,
    };
  }

  if (generatorType === 'enrichment') {
    const updateNodes = output?.updateNodes || [];
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-enrich`,
          type: 'graph_patch',
          rationale: isPl
            ? `Uzupełniono ${updateNodes.length} węzłów`
            : `Enriched ${updateNodes.length} nodes`,
          confidence: 0.7,
          patch: { updateNodes },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'mindmap_expand') {
    const addNodes = (output?.addNodes || []).map((n: any, i: number) => ({
      id: n.id || `mm-${ts}-${i}`,
      label: n.label,
      type: 'leaf',
      data: { label: n.label, branchKey: n.branchKey },
    }));
    const addEdges = (output?.addEdges || []).map((e: any, i: number) => ({
      id: e.id || `mme-${ts}-${i}`,
      source: e.source,
      target: e.target,
    }));
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-mm`,
          type: 'graph_patch',
          rationale: isPl
            ? `Proponuję ${addNodes.length} nowych gałęzi`
            : `Proposing ${addNodes.length} new branches`,
          confidence: 0.75,
          patch: { addNodes, addEdges },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'table_columns') {
    const columns = output?.columns || [];
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-cols`,
          type: 'view_patch',
          rationale: columns.map((c: any) => c.rationale || c.header).join(', '),
          confidence: 0.8,
          patch: { extensions: { table: { columns } } },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'table_views') {
    const views = output?.views || [];
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: views.map((v: any, i: number) => ({
        id: `prop-${ts}-view-${i}`,
        type: 'view_patch',
        rationale: v.rationale || v.name,
        confidence: 0.8,
        patch: { extensions: { table: { views: [v] } } },
        status: 'pending',
      })),
      createdAt: ts,
    };
  }

  if (generatorType === 'whiteboard_clusters') {
    const clusters = output?.clusters || [];
    const CLUSTER_COLORS = ['#fef3c7', '#dbeafe', '#d1fae5', '#fce7f3', '#ede9fe'];
    const addNodes: any[] = [];
    const addEdges: any[] = [];
    let xOffset = 0;

    for (let ci = 0; ci < clusters.length; ci++) {
      const cluster = clusters[ci];
      const groupId = cluster.id || `grp-${ts}-${ci}`;
      addNodes.push({
        id: groupId,
        label: cluster.label,
        type: 'groupNode',
        position: { x: xOffset, y: 0 },
        data: {
          label: cluster.label,
          color: cluster.color || CLUSTER_COLORS[ci % CLUSTER_COLORS.length],
        },
      });
      const stickies = cluster.stickies || [];
      for (let si = 0; si < stickies.length; si++) {
        const s = stickies[si];
        const stickyId = s.id || `st-${ts}-${ci}-${si}`;
        addNodes.push({
          id: stickyId,
          label: s.text,
          type: 'stickyNote',
          position: { x: xOffset + 20 + (si % 2) * 180, y: 60 + Math.floor(si / 2) * 160 },
          data: {
            label: s.text,
            color: s.color || CLUSTER_COLORS[ci % CLUSTER_COLORS.length],
            parentId: groupId,
          },
        });
      }
      xOffset += 420;
    }

    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-wb-clusters`,
          type: 'graph_patch',
          rationale: isPl
            ? `Proponuję ${clusters.length} klastrów tematycznych`
            : `Proposing ${clusters.length} thematic clusters`,
          confidence: 0.8,
          patch: { addNodes, addEdges },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'whiteboard_brainstorm') {
    const stickies = output?.stickies || [];
    const STICKY_COLORS = [
      '#fef3c7',
      '#dbeafe',
      '#d1fae5',
      '#fce7f3',
      '#ede9fe',
      '#fee2e2',
      '#e0e7ff',
    ];
    const addNodes = stickies.map((s: any, i: number) => ({
      id: s.id || `bs-${ts}-${i}`,
      label: s.text,
      type: 'stickyNote',
      position: { x: 40 + (i % 3) * 200, y: 40 + Math.floor(i / 3) * 180 },
      data: {
        label: s.text,
        color: s.color || STICKY_COLORS[i % STICKY_COLORS.length],
        rationale: s.rationale,
      },
    }));

    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-wb-brainstorm`,
          type: 'graph_patch',
          rationale: isPl
            ? `Proponuję ${addNodes.length} pomysłów`
            : `Proposing ${addNodes.length} ideas`,
          confidence: 0.75,
          patch: { addNodes, addEdges: [] },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'whiteboard_organize') {
    const groups = output?.groups || [];
    const repositionMap = new Map<string, { x: number; y: number }>();
    for (const item of output?.repositionedNodes || []) {
      if (item?.id && item?.position) {
        repositionMap.set(String(item.id), item.position);
      }
    }
    const addNodes = groups.map((g: any, i: number) => {
      const framePosition = createGridPosition(i, 80, 80, 2);
      return createWhiteboardFrameNode({
        id: g.id || `org-grp-${ts}-${i}`,
        label: g.label,
        position: framePosition,
        bgColor: WHITEBOARD_FRAME_PALETTE[i % WHITEBOARD_FRAME_PALETTE.length],
        width: 420,
        height: 320,
        data: { childIds: Array.isArray(g.nodeIds) ? g.nodeIds : [] },
      });
    });
    const moveNodes = groups.flatMap((g: any, groupIndex: number) => {
      const frameId = g.id || `org-grp-${ts}-${groupIndex}`;
      const framePosition =
        addNodes[groupIndex]?.position || createGridPosition(groupIndex, 80, 80, 2);
      const nodeIds = Array.isArray(g.nodeIds) ? g.nodeIds : [];
      return nodeIds.map((nodeId: string, nodeIndex: number) => {
        const absolute = repositionMap.get(String(nodeId));
        const fallbackAbsolute = {
          x: framePosition.x + 28 + (nodeIndex % 2) * 180,
          y: framePosition.y + 70 + Math.floor(nodeIndex / 2) * 120,
        };
        const resolved = absolute || fallbackAbsolute;
        return {
          nodeId: String(nodeId),
          parentId: frameId,
          position: {
            x: Math.max(20, resolved.x - framePosition.x),
            y: Math.max(56, resolved.y - framePosition.y),
          },
        };
      });
    });
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-wb-organize`,
          type: 'graph_patch',
          rationale: isPl
            ? `Proponuję ${groups.length} grup logicznych`
            : `Proposing ${groups.length} logical groups`,
          confidence: 0.7,
          maturity: 'real',
          generatorStatus: 'real',
          patch: { addNodes, moveNodes },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'summary') {
    return {
      id: batchId,
      tool,
      generatorType,
      summary: {
        executiveSummary: output?.executiveSummary || '',
        keyFindings: output?.keyFindings || [],
        nextSteps: output?.nextSteps || [],
        risks: output?.risks || [],
      },
      createdAt: ts,
    };
  }

  if (generatorType === 'node_context') {
    return {
      id: batchId,
      tool,
      generatorType,
      nodeContext: {
        summary: output?.summary || '',
        relatedInitiatives: output?.relatedInitiatives || [],
        relatedRisks: output?.relatedRisks || [],
        relatedKPIs: output?.relatedKPIs || [],
        suggestions: output?.suggestions || [],
      },
      createdAt: ts,
    };
  }

  if (generatorType === 'auto_cluster') {
    const clusters = output?.clusters || [];
    const CLUSTER_COLORS = ['#fef3c7', '#dbeafe', '#d1fae5', '#fce7f3', '#ede9fe', '#e0e7ff'];
    const addNodes: any[] = [];
    const moveNodes: any[] = [];

    for (let ci = 0; ci < clusters.length; ci++) {
      const c = clusters[ci];
      const frameId = c.id || `acluster-${ts}-${ci}`;
      const framePos = c.framePosition || { x: ci * 450, y: 0 };
      addNodes.push({
        id: frameId,
        label: c.label,
        type: 'frameNode',
        position: framePos,
        data: {
          label: c.label,
          bgColor: c.color || CLUSTER_COLORS[ci % CLUSTER_COLORS.length],
          childIds: c.nodeIds,
          width: 400,
          height: 300,
        },
      });
      const nodeIds = Array.isArray(c.nodeIds) ? c.nodeIds : [];
      for (let ni = 0; ni < nodeIds.length; ni++) {
        moveNodes.push({
          nodeId: nodeIds[ni],
          parentId: frameId,
          position: { x: 20 + (ni % 3) * 120, y: 50 + Math.floor(ni / 3) * 120 },
        });
      }
    }

    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-auto-cluster`,
          type: 'graph_patch',
          rationale: isPl
            ? `Proponuję ${clusters.length} klastrów tematycznych`
            : `Proposing ${clusters.length} thematic clusters`,
          confidence: 0.8,
          patch: { addNodes, addEdges: [], moveNodes },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'node_expand') {
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-node-expand`,
          type: 'graph_patch',
          rationale: isPl
            ? `Analiza kroku: ${output?.subSteps?.length || 0} pod-kroków, ${output?.risks?.length || 0} ryzyk, ${output?.optimizations?.length || 0} optymalizacji`
            : `Step analysis: ${output?.subSteps?.length || 0} sub-steps, ${output?.risks?.length || 0} risks, ${output?.optimizations?.length || 0} optimizations`,
          confidence: 0.8,
          patch: {
            subSteps: output?.subSteps || [],
            risks: output?.risks || [],
            metrics: output?.metrics || [],
            optimizations: output?.optimizations || [],
          },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'process_coach') {
    const insights = output?.insights || [];
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: insights.map((insight: any, i: number) => ({
        id: `prop-${ts}-coach-${i}`,
        type: 'graph_patch',
        rationale: `[${insight.type}] ${insight.message}`,
        confidence: insight.confidence || 0.7,
        patch: {
          suggestion: insight.suggestion,
          affectedNodeIds: insight.affectedNodeIds || [],
          insightType: insight.type,
        },
        status: 'pending',
      })),
      createdAt: ts,
    };
  }

  if (generatorType === 'next_step') {
    const steps = output?.steps || [];
    const addNodes = steps.map((s: any, i: number) => ({
      id: s.id || `ns-${ts}-${i}`,
      label: s.label,
      type: 'flowNode',
      data: { shape: s.shape || 'action', ghost: true, rationale: s.rationale },
    }));
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-next-step`,
          type: 'graph_patch',
          rationale: isPl
            ? `Proponuję ${addNodes.length} następnych kroków`
            : `Proposing ${addNodes.length} next steps`,
          confidence: 0.75,
          patch: { addNodes, addEdges: [] },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'process_summary') {
    return {
      id: batchId,
      tool,
      generatorType,
      summary: {
        totalSteps: output?.totalSteps || 0,
        totalDecisions: output?.totalDecisions || 0,
        totalLanes: output?.totalLanes || 0,
        criticalPath: output?.criticalPath || [],
        estimatedDuration: output?.estimatedDuration || '',
        risks: output?.risks || [],
        recommendations: output?.recommendations || [],
      },
      createdAt: ts,
    };
  }

  if (generatorType === 'process_brief') {
    const objective = output?.objective || (isPl ? 'Brak celu' : 'No objective');
    const currentGaps = output?.currentGaps || [];
    const nextMoves = output?.nextMoves || [];
    const reviewCheckpoints = output?.reviewCheckpoints || [];
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-process-brief`,
          type: 'view_patch',
          rationale: isPl
            ? 'Structured brief procesu gotowy do review'
            : 'Structured process brief ready for review',
          confidence: 0.82,
          citations: [
            { label: `${output?.currentGaps?.length || 0} gaps`, kind: 'note' },
            { label: `${output?.nextMoves?.length || 0} next moves`, kind: 'note' },
          ],
          maturity: 'real',
          patch: {
            extensions: {
              processFlow: {
                processBrief: {
                  objective,
                  currentGaps,
                  nextMoves,
                  reviewCheckpoints,
                  generatedAt: new Date(ts).toISOString(),
                },
              },
            },
          },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'process_savings') {
    const recommendations = output?.recommendations || [];
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-process-savings`,
          type: 'graph_patch',
          rationale: isPl
            ? `Analiza savings dla ${recommendations.length} kroków`
            : `Savings analysis for ${recommendations.length} steps`,
          confidence: 0.8,
          citations: [
            {
              label:
                output?.summary?.totalSavingsEstimate || (isPl ? 'Brak sumy' : 'No total estimate'),
              kind: 'note',
            },
          ],
          maturity: 'real',
          patch: {
            updateNodes: recommendations.map((rec: any) => ({
              id: rec.nodeId,
              data: {
                automationCandidate: rec.automationPotential !== 'low',
                automationPotential: rec.automationPotential,
                savingsEstimate: rec.savingsEstimate,
                implementationEffort: rec.implementationEffort,
                automationRationale: rec.rationale,
              },
            })),
            extensions: {
              processFlow: {
                savingsAnalysis: {
                  totalSavingsEstimate: output?.summary?.totalSavingsEstimate || '',
                  topOpportunityNodeIds: output?.summary?.topOpportunityNodeIds || [],
                  notes: output?.summary?.notes || [],
                  generatedAt: new Date(ts).toISOString(),
                },
              },
            },
          },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  // J26 (Kanał 2): edit_step — one proposal that rewrites the target node in
  // place via patch.updateNodes (Propose→Accept). No addNodes → neighbours are
  // never touched. Mirrors the wb_name_clusters shape.
  if (generatorType === 'edit_step') {
    const targetId = String(output?._targetId || '');
    const newLabel = String(output?.label || '').trim();
    const newDesc =
      typeof output?.description === 'string' && output.description.trim()
        ? output.description.trim()
        : undefined;
    return {
      id: batchId,
      tool,
      generatorType,
      proposals:
        targetId && newLabel
          ? [
              {
                id: `prop-${ts}-edit-step`,
                type: 'graph_patch',
                rationale: isPl
                  ? `Przeredagowano krok: „${newLabel}"`
                  : `Rewrote step: "${newLabel}"`,
                confidence: 0.8,
                patch: {
                  updateNodes: [
                    {
                      id: targetId,
                      data: {
                        label: newLabel,
                        ...(newDesc ? { description: newDesc } : {}),
                        ...(output?.rationale ? { _rewriteRationale: output.rationale } : {}),
                      },
                    },
                  ],
                },
                status: 'pending',
              },
            ]
          : [],
      createdAt: ts,
    };
  }

  if (generatorType === 'vsm_generator') {
    const addNodes = (output?.addNodes || []).map((n: any, i: number) => ({
      id: n.id || `vsm-${ts}-${i}`,
      label: n.label,
      type: 'flowNode',
      position: n.position || { x: 100 + i * 220, y: 100 },
      data: { shape: n.shape || 'action', ...n.data },
    }));
    const addEdges = (output?.addEdges || []).map((e: any, i: number) => ({
      id: e.id || `vsme-${ts}-${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
    }));
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-vsm`,
          type: 'graph_patch',
          rationale: isPl
            ? `VSM stanu obecnego: ${addNodes.length} kroków, PCE: ${output?.timeline?.pce ?? '?'}%`
            : `Current state VSM: ${addNodes.length} steps, PCE: ${output?.timeline?.pce ?? '?'}%`,
          confidence: 0.8,
          patch: { addNodes, addEdges, timeline: output?.timeline || null },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'sticky_summarize') {
    const summaryNode = createWhiteboardStickyNode({
      id: `sum-${ts}`,
      label: output?.summary || '',
      position: createGridPosition(0, 120, 120, 1),
      data: {
        keyThemes: output?.keyThemes || [],
      },
      color: WHITEBOARD_STICKY_PALETTE[1],
    });
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-sticky-sum`,
          type: 'graph_patch',
          rationale: isPl
            ? `Podsumowanie ${output?.keyThemes?.length || 0} tematów`
            : `Summary of ${output?.keyThemes?.length || 0} themes`,
          confidence: 0.8,
          maturity: 'real',
          generatorStatus: 'real',
          patch: {
            addNodes: [summaryNode],
            addEdges: [],
          },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'vsm_future_state') {
    const addNodes = (output?.addNodes || []).map((n: any, i: number) => ({
      id: n.id || `vsmf-${ts}-${i}`,
      label: n.label,
      type: 'flowNode',
      position: { x: 100 + i * 220, y: 100 },
      data: { shape: n.shape || 'action', ...n.data },
    }));
    const addEdges = (output?.addEdges || []).map((e: any, i: number) => ({
      id: e.id || `vsmfe-${ts}-${i}`,
      source: e.source,
      target: e.target,
    }));
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-vsm-future`,
          type: 'graph_patch',
          rationale: isPl
            ? `VSM stanu przyszłego: ${addNodes.length} kroków, ${output?.improvements?.length || 0} usprawnień`
            : `Future state VSM: ${addNodes.length} steps, ${output?.improvements?.length || 0} improvements`,
          confidence: 0.8,
          patch: { addNodes, addEdges, improvements: output?.improvements || [] },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  // V51-01: Artifact linking formatters — IDs are LLM-generated suggestions, not verified DB records
  if (generatorType === 'ai_retrieve_artifacts') {
    const artifacts = output?.artifacts || [];
    return {
      id: batchId,
      tool,
      generatorType,
      artifacts,
      proposals: artifacts.map((a: any, i: number) => ({
        id: `prop-${ts}-art-${i}`,
        type: 'graph_patch',
        rationale: a.rationale || `${a.type}: ${a.title}`,
        confidence: a.confidence || 0.7,
        patch: {
          artifactRef: { type: a.type, id: a.id },
          title: a.title,
          relevance: a.relevance,
        },
        status: 'pending',
        needsVerification: true,
      })),
      createdAt: ts,
    };
  }

  if (generatorType === 'ai_propose_attachments') {
    const proposals = output?.proposals || [];
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: proposals.map((p: any, i: number) => ({
        id: `prop-${ts}-attach-${i}`,
        type: 'graph_patch',
        rationale: p.rationale || `Attach ${p.artifactType} to ${p.objectLabel}`,
        confidence: p.confidence || 0.7,
        patch: {
          objectId: p.objectId,
          objectLabel: p.objectLabel,
          artifactRef: { type: p.artifactType, id: p.artifactId },
          artifactTitle: p.artifactTitle,
          linkRole: p.linkRole || 'related',
        },
        status: 'pending',
      })),
      createdAt: ts,
    };
  }

  if (generatorType === 'ai_build_linked_table') {
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-linked-table`,
          type: 'view_patch',
          rationale: isPl
            ? `Tabela z ${output?.rows?.length || 0} powiązanymi artefaktami`
            : `Table with ${output?.rows?.length || 0} linked artifacts`,
          confidence: 0.8,
          patch: {
            extensions: {
              table: {
                columns: output?.columns || [],
                rows: output?.rows || [],
              },
            },
          },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'ai_autofill_mappings') {
    return {
      id: batchId,
      tool,
      generatorType,
      mappings: output?.mappings || [],
      proposals: [
        {
          id: `prop-${ts}-autofill`,
          type: 'view_patch',
          rationale: isPl
            ? `${output?.mappings?.length || 0} mapowań autofill`
            : `${output?.mappings?.length || 0} autofill mappings`,
          confidence: 0.8,
          patch: { autofillMappings: output?.mappings || [] },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  // V51-05: Whiteboard facilitation formatters
  if (generatorType === 'wb_find_themes') {
    const themes = output?.themes || [];
    return {
      id: batchId,
      tool,
      generatorType,
      themes,
      proposals: themes.map((t: any, i: number) => ({
        id: `prop-${ts}-theme-${i}`,
        type: 'graph_patch',
        rationale: `${t.label}: ${t.description}`,
        confidence: t.confidence || 0.7,
        maturity: 'real',
        generatorStatus: 'real',
        patch: {
          addNodes: [
            createWhiteboardFrameNode({
              id: t.id || `theme-${ts}-${i}`,
              label: t.label,
              position: createGridPosition(i, 100, 90, 2),
              bgColor: WHITEBOARD_FRAME_PALETTE[i % WHITEBOARD_FRAME_PALETTE.length],
              width: 360,
              height: 260,
              data: { description: t.description, childIds: t.nodeIds },
            }),
          ],
        },
        status: 'pending',
      })),
      createdAt: ts,
    };
  }

  if (generatorType === 'wb_name_clusters') {
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-wb-names`,
          type: 'graph_patch',
          rationale: isPl
            ? `Nazwy dla ${output?.namedClusters?.length || 0} klastrów`
            : `Names for ${output?.namedClusters?.length || 0} clusters`,
          confidence: 0.8,
          patch: {
            updateNodes: (output?.namedClusters || []).map((c: any) => ({
              id: c.clusterId,
              data: { label: c.name, _nameRationale: c.rationale },
            })),
          },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'wb_to_map_branches') {
    const branches = output?.branches || [];
    const addNodes: any[] = [];
    const addEdges: any[] = [];
    const rootId = `root-${ts}`;
    addNodes.push({
      id: rootId,
      label: output?.rootLabel || 'Root',
      type: 'branch',
      position: { x: 0, y: 0 },
      data: { label: output?.rootLabel || 'Root' },
    });
    for (let branchIndex = 0; branchIndex < branches.length; branchIndex++) {
      const branch = branches[branchIndex];
      const bId = branch.id || `br-${ts}-${addNodes.length}`;
      addNodes.push({
        id: bId,
        label: branch.label,
        type: 'branch',
        position: { x: -280 + branchIndex * 220, y: 180 },
        data: { label: branch.label },
      });
      addEdges.push({ id: `e-${rootId}-${bId}`, source: rootId, target: bId });
      for (let childIndex = 0; childIndex < (branch.children || []).length; childIndex++) {
        const child = branch.children[childIndex];
        const cId = child.id || `ch-${ts}-${addNodes.length}`;
        addNodes.push({
          id: cId,
          label: child.label,
          type: 'leaf',
          position: {
            x: -340 + branchIndex * 220,
            y: 340 + childIndex * 120,
          },
          data: { label: child.label },
        });
        addEdges.push({ id: `e-${bId}-${cId}`, source: bId, target: cId });
      }
    }
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-wb-to-map`,
          type: 'graph_patch',
          rationale: isPl
            ? `Mapa myśli z ${branches.length} gałęziami`
            : `Mind map with ${branches.length} branches`,
          confidence: 0.8,
          maturity: 'real',
          generatorStatus: 'cross-tool',
          targetTool: 'mindmap',
          focusNodeId: rootId,
          resultSummary: isPl
            ? `Przełącz po akceptacji do mapy myśli (${branches.length} gałęzi)`
            : `Switch to mind map after accept (${branches.length} branches)`,
          patch: { addNodes, addEdges },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'wb_to_table') {
    const columns = output?.columns || [];
    const rows = output?.rows || [];
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-wb-to-table`,
          type: 'view_patch',
          rationale: isPl ? `Tabela z ${rows.length} wierszami` : `Table with ${rows.length} rows`,
          confidence: 0.8,
          maturity: 'real',
          generatorStatus: 'cross-tool',
          targetTool: 'table',
          resultSummary: isPl
            ? `Przełącz po akceptacji do tabeli (${rows.length} wierszy)`
            : `Switch to table after accept (${rows.length} rows)`,
          patch: {
            extensions: {
              table: {
                columns,
                rows,
                generatedRowNodes: createTableRowNodes(rows, ts),
              },
            },
          },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'wb_extract_actions') {
    const actions = output?.actions || [];
    return {
      id: batchId,
      tool,
      generatorType,
      actions,
      proposals: [
        {
          id: `prop-${ts}-wb-actions`,
          type: 'graph_patch',
          rationale: isPl
            ? `${actions.length} akcji do wykonania`
            : `${actions.length} action items`,
          confidence: 0.8,
          maturity: 'real',
          generatorStatus: 'real',
          patch: {
            addNodes: actions.map((a: any, i: number) =>
              createWhiteboardStickyNode({
                id: a.id || `act-${ts}-${i}`,
                label: a.text,
                position: createGridPosition(i, 120, 120, 3),
                data: {
                  sourceNodeId: a.sourceNodeId,
                  status: 'todo',
                },
                color: WHITEBOARD_STICKY_PALETTE[2],
                author: a.owner,
                priority: a.priority,
              })
            ),
            addEdges: [],
          },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  // V51-06: Table AI formatters
  if (generatorType === 'table_rows') {
    const rows = output?.rows || [];
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-table-rows`,
          type: 'view_patch',
          rationale: isPl ? `${rows.length} nowych wierszy` : `${rows.length} new rows`,
          confidence: 0.8,
          patch: { extensions: { table: { addRows: rows } } },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'table_simplify') {
    return {
      id: batchId,
      tool,
      generatorType,
      proposals: [
        {
          id: `prop-${ts}-table-simplify`,
          type: 'view_patch',
          rationale: output?.rationale || (isPl ? 'Uproszczenie tabeli' : 'Table simplification'),
          confidence: 0.8,
          patch: {
            removedColumnKeys: output?.removedColumnKeys || [],
            mergedColumns: output?.mergedColumns || [],
          },
          status: 'pending',
        },
      ],
      createdAt: ts,
    };
  }

  if (generatorType === 'mm_branch_generator') {
    return formatIdeaGeneratorOutput('mindmap_expand', tool, output, batchId, language);
  }

  if (generatorType === 'mm_expand') {
    return formatIdeaGeneratorOutput('node_expand', tool, output, batchId, language);
  }

  if (generatorType === 'mm_what_if') {
    return formatIdeaGeneratorOutput('node_expand', tool, output, batchId, language);
  }

  return { id: batchId, tool, generatorType, proposals: [], createdAt: ts };
}

import { type TextToSqlResult, textToSqlService } from '../ai/textToSqlService.js';
import { buildProposalOperationContract } from './operationContractService.js';
import {
  createProposal,
  type TeresaChatProposalEnvelope,
  TeresaCopilotError,
  toChatProposalEnvelope,
} from './teresaCopilotService.js';

type SourceSurface = 'chat' | 'initiatives' | 'notebook' | 'tables' | 'agent' | 'unknown';

interface BaseOperatorParams {
  organizationId: string;
  userId: string;
  sessionId: string;
  conversationId?: string | null;
  contextSnapshotId?: string | null;
  sourceSurface?: SourceSurface;
}

export interface InitiativeDraftOperatorParams extends BaseOperatorParams {
  title: string;
  description: string;
  category?: string | null;
  estimatedRoi?: number | null;
  priority?: string | null;
  timelineWeeks?: number | null;
}

export interface NotebookEntryOperatorParams extends BaseOperatorParams {
  title: string;
  content: string;
  entryType?: string | null;
  tags?: string[];
}

export interface StructuredQueryOperatorParams extends BaseOperatorParams {
  question: string;
  dataDomain?: string | null;
  limit?: number | null;
}

export interface StructuredQueryOperatorResult {
  type: 'structured_query_result';
  surface: 'tables';
  query: TextToSqlResult;
  operationContract: ReturnType<typeof buildProposalOperationContract>;
}

function trim(value: unknown, max = 180): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
}

function buildRuntimeBinding(params: BaseOperatorParams) {
  return {
    conversation_id: params.conversationId || params.sessionId,
    session_id: params.sessionId,
    context_snapshot_id: params.contextSnapshotId || null,
  };
}

function buildBoundedContextPack(
  sourceSurface: SourceSurface | undefined,
  extra?: Array<{ ref: string; type: string; deeplink?: string | null }>
) {
  const base = [
    {
      ref: `surface:${sourceSurface || 'unknown'}`,
      type: 'surface',
      deeplink: null,
    },
  ];
  return [...base, ...(extra || [])];
}

export async function proposeInitiativeDraftOperator(
  params: InitiativeDraftOperatorParams
): Promise<TeresaChatProposalEnvelope> {
  if (!String(params.title || '').trim() || !String(params.description || '').trim()) {
    throw new TeresaCopilotError(
      'title and description are required for initiative operator',
      'P08_INITIATIVE_OPERATOR_INVALID_INPUT',
      400
    );
  }

  const proposal = await createProposal({
    organizationId: params.organizationId,
    userId: params.userId,
    sessionId: params.sessionId,
    targetModule: 'initiatives',
    handoffContext: {
      origin: 'teresa',
      user_intent: trim(params.title, 160),
      active_surface: `${params.sourceSurface || 'initiatives'}/operator`,
      org_context_ref: `org:${params.organizationId}`,
      operation_contract_ref: null,
      runtime_binding: buildRuntimeBinding(params),
      bounded_context_pack: buildBoundedContextPack(params.sourceSurface, [
        { ref: 'module:initiatives', type: 'module', deeplink: '/initiatives' },
      ]),
      constraints: ['proposal_first', 'no_silent_writes', 'initiative_operator'],
      assumptions: [],
      uncertainty_boundary: {
        missing_inputs: [],
        conflicts: [],
        what_would_change_next_action: [],
      },
      evidence_pointers: [],
      proposed_next_action: {
        target_module: 'initiatives',
        handoff_intent: 'create',
        requires_approval: true,
      },
      audit_stub: {
        actor: 'teresa:initiative_operator',
        timestamp: new Date().toISOString(),
      },
    },
    targetPayload: {
      initiative_seed: {
        problem_statement: params.title,
        proposed_outcome: params.description,
        assumptions: [],
        risks: [],
        next_steps: ['Review Teresa draft', 'Approve initiative creation'],
        time_window: params.timelineWeeks ? `${params.timelineWeeks} weeks` : null,
      },
      proposal_only: true,
      operator_metadata: {
        category: params.category || null,
        estimated_roi: params.estimatedRoi ?? null,
        priority: params.priority || 'medium',
        timeline_weeks: params.timelineWeeks ?? null,
        source_surface: params.sourceSurface || 'initiatives',
      },
    },
  });

  return toChatProposalEnvelope(proposal);
}

export async function proposeNotebookEntryOperator(
  params: NotebookEntryOperatorParams
): Promise<TeresaChatProposalEnvelope> {
  if (!String(params.title || '').trim() || !String(params.content || '').trim()) {
    throw new TeresaCopilotError(
      'title and content are required for notebook operator',
      'P08_NOTEBOOK_OPERATOR_INVALID_INPUT',
      400
    );
  }

  const tags = Array.isArray(params.tags) ? params.tags.filter(Boolean).slice(0, 10) : [];
  const proposal = await createProposal({
    organizationId: params.organizationId,
    userId: params.userId,
    sessionId: params.sessionId,
    targetModule: 'notebook',
    handoffContext: {
      origin: 'teresa',
      user_intent: trim(params.title, 160),
      active_surface: `${params.sourceSurface || 'notebook'}/operator`,
      org_context_ref: `org:${params.organizationId}`,
      operation_contract_ref: null,
      runtime_binding: buildRuntimeBinding(params),
      bounded_context_pack: buildBoundedContextPack(params.sourceSurface, [
        { ref: 'module:notebook', type: 'module', deeplink: '/my-work/notebook' },
      ]),
      constraints: ['proposal_first', 'no_silent_writes', 'notebook_operator'],
      assumptions: [],
      uncertainty_boundary: {
        missing_inputs: [],
        conflicts: [],
        what_would_change_next_action: [],
      },
      evidence_pointers: [],
      proposed_next_action: {
        target_module: 'notebook',
        handoff_intent: 'append',
        requires_approval: true,
      },
      audit_stub: {
        actor: 'teresa:notebook_operator',
        timestamp: new Date().toISOString(),
      },
    },
    targetPayload: {
      notebook_handoff_context: {
        title: params.title,
        body_preview: trim(params.content, 2000),
        source: 'teresa',
      },
      provenance_markers: {
        source: 'teresa_operator',
        user_edit: false,
        ai_transform: true,
      },
      evidence_pointers: [],
      operator_metadata: {
        entry_type: params.entryType || 'insight',
        tags,
        source_surface: params.sourceSurface || 'notebook',
      },
    },
  });

  return toChatProposalEnvelope(proposal);
}

export async function runStructuredQueryOperator(
  params: StructuredQueryOperatorParams
): Promise<StructuredQueryOperatorResult> {
  if (!String(params.question || '').trim()) {
    throw new TeresaCopilotError(
      'question is required for structured query operator',
      'P08_STRUCTURED_QUERY_INVALID_INPUT',
      400
    );
  }

  const query = await textToSqlService.query({
    question: params.question,
    dataDomain: params.dataDomain || undefined,
    organizationId: params.organizationId,
    limit: params.limit || 25,
  });

  return {
    type: 'structured_query_result',
    surface: 'tables',
    query,
    operationContract: buildProposalOperationContract({
      kind: 'tool_invocation',
      contractId: `${params.sessionId}:tables:${query.dataDomain}`,
      stage: 'completed',
      organizationId: params.organizationId,
      userId: params.userId,
      conversationId: params.conversationId || params.sessionId,
      sessionId: params.sessionId,
      contextSnapshotId: params.contextSnapshotId || null,
      targetModule: 'tables',
      title: `Structured query: ${query.dataDomain}`,
      summary: trim(params.question, 180),
      intent: params.question,
      previewLines: [
        `Domain: ${query.dataDomain}`,
        `Rows: ${query.rowCount}`,
        `Columns: ${query.columns.join(', ') || 'none'}`,
      ],
      riskLabel: 'read_only',
    }),
  };
}

/**
 * ideaAIGenerator — Frontend service for Idea Workspace AI generation.
 *
 * Calls POST /api/my-work/my-ideas/:id/ai-generate and returns
 * AIProposalBatch or suggestion arrays for the Propose → Accept UX.
 */
import type { AIProposalBatch, CanvasToolType } from '@/components/MyWork/ideaSelectionTypes';

import { Api } from './api';

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
  targetNodeLabel?: string;
  targetNodeTags?: string[];
  targetNodeSemanticType?: string;
}

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
  | 'edit_step'
  | 'vsm_generator'
  | 'sticky_summarize'
  | 'vsm_future_state'
  | 'wb_find_themes'
  | 'wb_name_clusters'
  | 'wb_to_map_branches'
  | 'wb_to_table'
  | 'wb_extract_actions'
  | 'table_rows'
  | 'table_simplify'
  | 'ai_retrieve_artifacts'
  | 'ai_propose_attachments'
  | 'ai_build_linked_table'
  | 'ai_autofill_mappings';

export interface AISuggestionItem {
  id: string;
  category: 'topics' | 'findings' | 'next_steps' | 'frameworks' | 'risks' | 'benchmarks';
  text: string;
  detail?: string;
  confidence?: number;
}

const GENERATOR_STATUS_MAP: Record<GeneratorType, 'real' | 'partial' | 'cross-tool'> = {
  lane_generator: 'real',
  flow_generator: 'real',
  suggestions: 'real',
  bottleneck: 'real',
  enrichment: 'partial',
  mindmap_expand: 'real',
  table_columns: 'real',
  table_views: 'real',
  whiteboard_clusters: 'real',
  whiteboard_brainstorm: 'real',
  whiteboard_organize: 'real',
  summary: 'real',
  node_context: 'partial',
  auto_cluster: 'real',
  node_expand: 'partial',
  process_coach: 'partial',
  next_step: 'real',
  process_summary: 'real',
  process_brief: 'partial',
  process_savings: 'partial',
  edit_step: 'real',
  vsm_generator: 'real',
  sticky_summarize: 'real',
  vsm_future_state: 'real',
  wb_find_themes: 'real',
  wb_name_clusters: 'real',
  wb_to_map_branches: 'cross-tool',
  wb_to_table: 'cross-tool',
  wb_extract_actions: 'real',
  table_rows: 'real',
  table_simplify: 'real',
  ai_retrieve_artifacts: 'partial',
  ai_propose_attachments: 'partial',
  ai_build_linked_table: 'real',
  ai_autofill_mappings: 'partial',
};

export function getGeneratorStatus(
  generatorType: GeneratorType
): 'real' | 'partial' | 'cross-tool' {
  return GENERATOR_STATUS_MAP[generatorType] || 'partial';
}

export async function generateAIProposal(params: {
  ideaId: string;
  generatorType: GeneratorType;
  tool: CanvasToolType;
  context: GeneratorContext;
}): Promise<AIProposalBatch> {
  const result = await Api.generateIdeaAI(params.ideaId, {
    generatorType: params.generatorType,
    tool: params.tool,
    context: params.context,
  });
  const batch = result as AIProposalBatch;
  return {
    ...batch,
    tool: batch?.tool || params.tool,
    generatorType: batch?.generatorType || params.generatorType,
    createdAt: batch?.createdAt || Date.now(),
    proposals: Array.isArray(batch?.proposals)
      ? batch.proposals.map((proposal) => ({
          ...proposal,
          citations: Array.isArray((proposal as any)?.citations) ? (proposal as any).citations : [],
          generatorStatus:
            (proposal as any)?.generatorStatus || getGeneratorStatus(params.generatorType),
          maturity:
            (proposal as any)?.maturity ||
            (getGeneratorStatus(params.generatorType) === 'partial' ? 'partial' : 'real'),
        }))
      : [],
  };
}

export async function generateAISuggestions(params: {
  ideaId: string;
  tool: CanvasToolType;
  context: GeneratorContext;
}): Promise<AISuggestionItem[]> {
  const result = await Api.generateIdeaAI(params.ideaId, {
    generatorType: 'suggestions',
    tool: params.tool,
    context: params.context,
  });
  const suggestions = (result as any)?.suggestions;
  if (Array.isArray(suggestions)) {
    return suggestions.map((s: any, i: number) => ({
      id: s.id || `sug-${Date.now()}-${i}`,
      category: s.category || 'topics',
      text: s.text || '',
      detail: s.detail,
      confidence: typeof s.confidence === 'number' ? s.confidence : undefined,
    }));
  }
  return [];
}

export async function expandNodeWithAI(params: {
  ideaId: string;
  tool: CanvasToolType;
  nodeId: string;
  nodeData: { label?: string; description?: string; shape?: string };
  context: GeneratorContext;
}): Promise<any> {
  const result = await Api.generateIdeaAI(params.ideaId, {
    generatorType: 'node_expand',
    tool: params.tool,
    context: {
      ...params.context,
      seedText: `Focus on node: "${params.nodeData.label}"${params.nodeData.description ? `\nDescription: ${params.nodeData.description}` : ''}`,
    },
  });
  return result;
}

export async function runProcessCoach(params: {
  ideaId: string;
  context: GeneratorContext;
}): Promise<any> {
  const result = await Api.generateIdeaAI(params.ideaId, {
    generatorType: 'process_coach',
    tool: 'process_flow',
    context: params.context,
  });
  return result;
}

export async function generateProcessSummary(params: {
  ideaId: string;
  context: GeneratorContext;
}): Promise<any> {
  const result = await Api.generateIdeaAI(params.ideaId, {
    generatorType: 'process_summary',
    tool: 'process_flow',
    context: params.context,
  });
  return result;
}

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
  | 'vsm_generator'
  | 'sticky_summarize'
  | 'vsm_future_state';

export interface AISuggestionItem {
  id: string;
  category: 'topics' | 'findings' | 'next_steps' | 'frameworks' | 'risks' | 'benchmarks';
  text: string;
  detail?: string;
  confidence?: number;
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
  return result as AIProposalBatch;
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

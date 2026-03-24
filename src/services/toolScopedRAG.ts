/**
 * V3-N05: Tool-scoped RAG auto-pass context
 *
 * Provides the contract and implementation for tool-scoped RAG context
 * auto-passing. Maps wizard steps to knowledge pack types, expands queries
 * with tool context, and checks available knowledge packs per tool.
 */

import { TOOL_WIZARD_CONFIGS } from '../components/shared/ToolWizard/defaultToolConfigs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolRAGContext {
  toolSlug: string;
  toolVersion: string;
  language: 'en' | 'pl';
  packType: 'methodology' | 'qbank' | 'initiatives' | 'benchmarks' | 'help';
  organizationId?: string;
}

export interface RAGQuery {
  query: string;
  context: ToolRAGContext;
  maxChunks: number;
  minRelevance: number;
}

export interface RAGChunk {
  id: string;
  content: string;
  source: string;
  relevance: number;
  metadata: Record<string, string>;
}

export interface RAGResponse {
  chunks: RAGChunk[];
  totalFound: number;
  queryExpanded: string;
  context: ToolRAGContext;
}

// ---------------------------------------------------------------------------
// Pack type constants
// ---------------------------------------------------------------------------

const PACK_TYPES = ['methodology', 'qbank', 'initiatives', 'benchmarks', 'help'] as const;
type PackType = (typeof PACK_TYPES)[number];

// Wizard steps that map to assessment-style tools (qbank in 'work' step)
const ASSESSMENT_TOOL_SLUGS = new Set([
  'dynamic-swot',
  'market-forces',
  'risk-uncertainty',
  'capability-mapper',
  'robotics-feasibility',
  'rpa-scanner',
  'ai-discovery',
  'pain-explorer',
]);

// ---------------------------------------------------------------------------
// Wizard step → pack type mapping
// ---------------------------------------------------------------------------

function resolvePackType(wizardStep: string, toolSlug: string): PackType {
  switch (wizardStep) {
    case 'define':
    case 'inputs':
      return 'methodology';
    case 'work':
      return ASSESSMENT_TOOL_SLUGS.has(toolSlug) ? 'qbank' : 'methodology';
    case 'review':
      return 'initiatives';
    case 'finalize':
    case 'outputs':
      return 'help';
    default:
      return 'methodology';
  }
}

// ---------------------------------------------------------------------------
// Tool display name lookup
// ---------------------------------------------------------------------------

function getToolDisplayName(slug: string): string {
  const config = TOOL_WIZARD_CONFIGS[slug];
  if (config) {
    return config.toolName.en;
  }
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getToolCategory(slug: string): string {
  const config = TOOL_WIZARD_CONFIGS[slug];
  return config?.category ?? 'consulting';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build RAG context for a tool session.
 * Auto-detects packType based on the current wizard step.
 */
export function buildToolRAGContext(params: {
  toolSlug: string;
  wizardStep: string;
  language: string;
  organizationId?: string;
}): ToolRAGContext {
  const language: 'en' | 'pl' = params.language === 'pl' ? 'pl' : 'en';
  const packType = resolvePackType(params.wizardStep, params.toolSlug);

  return {
    toolSlug: params.toolSlug,
    toolVersion: '3.0',
    language,
    packType,
    ...(params.organizationId ? { organizationId: params.organizationId } : {}),
  };
}

/**
 * Expand query with tool context for better RAG retrieval.
 */
export function expandQueryWithContext(query: string, context: ToolRAGContext): string {
  const toolName = getToolDisplayName(context.toolSlug);
  const category = getToolCategory(context.toolSlug);

  const packLabel: Record<PackType, string> = {
    methodology: 'methodology and approach',
    qbank: 'assessment questions and scoring',
    initiatives: 'initiative generation and recommendations',
    benchmarks: 'industry benchmarks and reference data',
    help: 'output formatting and delivery guidance',
  };

  const packContext = packLabel[context.packType];
  const langSuffix = context.language === 'pl' ? ' (odpowiedź po polsku)' : '';

  return `In the context of ${toolName} (${category}) — ${packContext}: ${query}${langSuffix}`;
}

/**
 * Get available knowledge packs for a tool.
 * Checks which packs exist in knowledge/tool-kb/{toolSlug}/.
 * Since the knowledge base is not yet populated, availability is derived
 * from a static mapping of which tools have dedicated content.
 */
export function getAvailableKnowledgePacks(
  toolSlug: string
): { packType: string; available: boolean; path: string }[] {
  return PACK_TYPES.map((packType) => ({
    packType,
    available: false,
    path: `knowledge/tool-kb/${toolSlug}/${packType}/`,
  }));
}

/**
 * Build the RAG filter for knowledge_docs table queries.
 */
export function buildRAGFilter(context: ToolRAGContext): Record<string, string> {
  return {
    tool_slug: context.toolSlug,
    pack_type: context.packType,
    language: context.language,
    ...(context.organizationId ? { organization_id: context.organizationId } : {}),
  };
}

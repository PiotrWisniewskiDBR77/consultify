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
 * Hand-maintained manifest of which `knowledge/tool-kb/<tool>/<packType>/`
 * folders currently hold REAL content (not empty/wydmuszka placeholders).
 *
 * FIX 2026-07-10 (`_KONCEPT_CONTENT_ENGINES_2026-07-10.md` §2.2 audit finding):
 * this function previously hardcoded `available: false` for every tool/pack
 * unconditionally, which hid the grounding badge even for packs that DO have
 * content (e.g. DRD's methodology KB — 8 axis chapters — and qbank v2 — 233
 * areas — merged 2026-07-10; dynamic-swot's full 6-slot pack, the reference
 * pattern per §3 "wzorzec kompletności"). This is browser code with no
 * filesystem access, so it cannot check disk directly — update this table
 * when a pack is filled (Faza 2/4 rollout, §12). TODO: replace with a live
 * check (e.g. a small `GET /api/ai-operations/knowledge/tool-packs/manifest`
 * endpoint reading `knowledge_docs` grouped by `tool_slug`/`pack_type`) once
 * that endpoint exists, so this table stops drifting from the real KB —
 * flagged in the handoff report for this task, not built here (out of the
 * "addytywne, mały diff" scope of this pass).
 */
const KNOWN_AVAILABLE_PACKS: Partial<Record<string, Partial<Record<PackType, boolean>>>> = {
  drd: { methodology: true, qbank: true },
  'dynamic-swot': {
    methodology: true,
    qbank: true,
    initiatives: true,
    benchmarks: true,
    help: true,
  },
  kpi: { benchmarks: true, qbank: true },
};

/**
 * Get available knowledge packs for a tool.
 * Checks which packs exist in knowledge/tool-kb/{toolSlug}/ (see
 * `KNOWN_AVAILABLE_PACKS` above for why this is a static table, not a live
 * filesystem/DB check).
 */
export function getAvailableKnowledgePacks(
  toolSlug: string
): { packType: string; available: boolean; path: string }[] {
  const known = KNOWN_AVAILABLE_PACKS[toolSlug] || {};
  return PACK_TYPES.map((packType) => ({
    packType,
    available: Boolean(known[packType]),
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

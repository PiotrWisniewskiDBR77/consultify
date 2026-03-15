/**
 * LLM-assisted Financial Line Mapping Service
 *
 * When heuristic mapping leaves lines unmapped, this service asks an LLM
 * to propose canonical ID assignments.  It works as a second pass after
 * the deterministic alias-based mapper and feeds accepted mappings back
 * into the alias table so the heuristic mapper learns over time.
 *
 * Provider priority: OpenAI (gpt-4o-mini) → Anthropic (claude-sonnet) → skip
 */

import OpenAI from 'openai';

import { llmConfigService } from './ai/llmConfigService.js';
import {
  getCanonicalLinesByStatementType,
  type CanonicalLineDefinition,
} from './financeCanonicalRegistry.js';
import { logFinanceError, logFinanceEvent } from './financeDiagnosticsService.js';
import type { ExtractedLine } from './financialStatementService.js';

// ─── types ──────────────────────────────────────────────────────────────────

export interface LlmMappingProposal {
  originalLabel: string;
  canonicalId: string | null;
  canonicalLabel: string | null;
  confidence: number;
  reason: string;
}

export interface LlmMappingResult {
  proposals: LlmMappingProposal[];
  provider: 'openai' | 'anthropic' | null;
  model: string | null;
  durationMs: number;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeBaseUrl(endpoint?: string | null): string | undefined {
  if (!endpoint) return undefined;
  let base = String(endpoint).trim().replace(/\/+$/, '');
  if (!base) return undefined;
  const suffixes = ['/chat/completions', '/v1/chat/completions', '/v1/completions', '/v1/responses'];
  const lower = base.toLowerCase();
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix)) {
      base = base.slice(0, -suffix.length).replace(/\/+$/, '');
      break;
    }
  }
  return base || undefined;
}

function extractJsonArray(raw: string): unknown[] | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const startBracket = candidate.indexOf('[');
  const endBracket = candidate.lastIndexOf(']');
  if (startBracket !== -1 && endBracket > startBracket) {
    try {
      return JSON.parse(candidate.slice(startBracket, endBracket + 1));
    } catch { /* fall through */ }
  }
  const startBrace = candidate.indexOf('{');
  const endBrace = candidate.lastIndexOf('}');
  if (startBrace !== -1 && endBrace > startBrace) {
    try {
      const obj = JSON.parse(candidate.slice(startBrace, endBrace + 1));
      if (Array.isArray(obj?.mappings)) return obj.mappings;
      if (Array.isArray(obj?.proposals)) return obj.proposals;
      if (Array.isArray(obj?.lines)) return obj.lines;
      return [obj];
    } catch { /* fall through */ }
  }
  return null;
}

// ─── prompt builder ─────────────────────────────────────────────────────────

function buildCanonicalCatalog(statementType: string): string {
  const lines = getCanonicalLinesByStatementType(
    statementType === 'P&L' ? 'P&L' : statementType === 'BS' ? 'BS' : 'CF'
  );
  return lines
    .map((l: CanonicalLineDefinition) => {
      const parent = l.parentId ? ` (parent: ${l.parentId})` : '';
      return `- ${l.id}: ${l.labelEn} / ${l.labelPl}${parent}`;
    })
    .join('\n');
}

function buildMappingPrompt(
  statementType: string,
  unmappedLines: Array<{ label: string; value: number; neighbors: string[] }>,
  catalog: string,
  alreadyUsedIds: Set<string>
): string {
  const linesList = unmappedLines
    .map((l, i) => {
      const ctx = l.neighbors.length > 0 ? ` [context: ${l.neighbors.join('; ')}]` : '';
      return `${i + 1}. "${l.label}" = ${l.value}${ctx}`;
    })
    .join('\n');

  const usedIdsList = alreadyUsedIds.size > 0
    ? `\nALREADY ASSIGNED IDs (DO NOT USE THESE):\n${[...alreadyUsedIds].join(', ')}\n`
    : '';

  return `You are a financial statement mapping expert.

TASK: Map each extracted financial line to the best matching canonical ID from the catalog below. If no reasonable match exists, set canonicalId to null.

STATEMENT TYPE: ${statementType}
${usedIdsList}
CANONICAL ID CATALOG:
${catalog}

UNMAPPED LINES TO MAP:
${linesList}

RULES:
- Each line must map to exactly ONE canonical ID or null.
- NEVER use an ID listed in "ALREADY ASSIGNED IDs" — those are already mapped to other lines.
- Consider the financial context: P&L lines should not map to BS IDs, etc.
- Use the neighboring lines as context to disambiguate.
- A parent canonical ID is acceptable if no child matches.
- If a line represents a subtotal or aggregate that is already captured by its components, set canonicalId to null.
- Confidence: 0.9+ = very certain, 0.7-0.9 = likely correct, 0.5-0.7 = best guess, <0.5 = don't map.
- When the label is in a non-English language, match it to the English canonical ID based on meaning.

Return ONLY a JSON array (no explanation text):
[
  {
    "lineIndex": 1,
    "canonicalId": "fsl-pl-revenue" or null,
    "confidence": 0.92,
    "reason": "brief reason"
  }
]`;
}

// ─── OpenAI mapping ─────────────────────────────────────────────────────────

async function mapWithOpenAI(
  prompt: string,
  traceId?: string
): Promise<{ proposals: unknown[]; model: string } | null> {
  const providerConfig = await llmConfigService.getProviderConfig('openai');
  const apiKey = providerConfig?.apiKey || process.env.OPENAI_API_KEY?.trim();
  const baseURL = normalizeBaseUrl(providerConfig?.endpoint);
  if (!apiKey) return null;

  const isOpenRouter = apiKey.startsWith('sk-or-v1') ||
    (baseURL || '').toLowerCase().includes('openrouter.ai');
  const model = isOpenRouter
    ? 'openai/gpt-4o'
    : 'gpt-4o';
  const effectiveBaseURL = isOpenRouter && !baseURL
    ? 'https://openrouter.ai/api/v1'
    : baseURL;
  const client = new OpenAI({ apiKey, ...(effectiveBaseURL ? { baseURL: effectiveBaseURL } : {}) });

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const outputText = response.choices?.[0]?.message?.content || '';
    const parsed = extractJsonArray(outputText);
    if (!parsed) throw new Error('OpenAI did not return valid mapping JSON');

    logFinanceEvent('statement.mapping.llm_completed', {
      traceId,
      provider: 'openai',
      model,
      proposalCount: parsed.length,
    });

    return { proposals: parsed, model };
  } catch (error) {
    logFinanceError('statement.mapping.llm_failed', error, {
      traceId,
      provider: 'openai',
      model,
    });
    return null;
  }
}

// ─── Anthropic mapping ──────────────────────────────────────────────────────

async function mapWithAnthropic(
  prompt: string,
  traceId?: string
): Promise<{ proposals: unknown[]; model: string } | null> {
  const providerConfig = await llmConfigService.getProviderConfig('anthropic');
  const apiKey = providerConfig?.apiKey || process.env.ANTHROPIC_API_KEY?.trim();
  const baseURL = normalizeBaseUrl(providerConfig?.endpoint);
  if (!apiKey) return null;

  const isOpenRouter = apiKey.startsWith('sk-or-v1') ||
    (baseURL || '').toLowerCase().includes('openrouter.ai');

  if (isOpenRouter) {
    const model = 'anthropic/claude-sonnet-4-6';
    const effectiveBaseURL = baseURL || 'https://openrouter.ai/api/v1';
    const client = new OpenAI({ apiKey, baseURL: effectiveBaseURL });
    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });
      const outputText = response.choices?.[0]?.message?.content || '';
      const parsed = extractJsonArray(outputText);
      if (!parsed) throw new Error('Anthropic (via OpenRouter) did not return valid mapping JSON');
      logFinanceEvent('statement.mapping.llm_completed', { traceId, provider: 'anthropic', model, proposalCount: parsed.length });
      return { proposals: parsed, model };
    } catch (error) {
      logFinanceError('statement.mapping.llm_failed', error, { traceId, provider: 'anthropic', model });
      return null;
    }
  }

  const model = providerConfig?.modelId || 'claude-sonnet-4-6';

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });

    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    });

    const outputText = response.content
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('\n');

    const parsed = extractJsonArray(outputText);
    if (!parsed) throw new Error('Anthropic did not return valid mapping JSON');

    logFinanceEvent('statement.mapping.llm_completed', {
      traceId,
      provider: 'anthropic',
      model,
      proposalCount: parsed.length,
    });

    return { proposals: parsed, model };
  } catch (error) {
    logFinanceError('statement.mapping.llm_failed', error, {
      traceId,
      provider: 'anthropic',
      model,
    });
    return null;
  }
}

// ─── main entry point ───────────────────────────────────────────────────────

const CONFIDENCE_AUTO_ACCEPT = 0.75;

export async function mapUnmappedLinesWithLLM(params: {
  allLines: ExtractedLine[];
  statementType: string;
  traceId?: string;
}): Promise<LlmMappingResult> {
  const t0 = Date.now();
  const { allLines, statementType, traceId } = params;

  const unmapped = allLines.filter(
    (l) => !l.suggestedCanonicalId && !l.isNonFinancial && l.originalLabel
  );

  if (unmapped.length === 0) {
    return { proposals: [], provider: null, model: null, durationMs: 0 };
  }

  const catalog = buildCanonicalCatalog(statementType);

  const alreadyUsedIds = new Set<string>(
    allLines
      .filter((l) => l.suggestedCanonicalId)
      .map((l) => l.suggestedCanonicalId!)
  );

  const unmappedWithContext = unmapped.map((line) => {
    const idx = allLines.indexOf(line);
    const prev = idx > 0 ? allLines[idx - 1]?.originalLabel : '';
    const next = idx < allLines.length - 1 ? allLines[idx + 1]?.originalLabel : '';
    return {
      label: line.originalLabel,
      value: line.value,
      neighbors: [prev, next].filter(Boolean) as string[],
    };
  });

  const MAX_BATCH_SIZE = 25;
  const batch = unmappedWithContext.slice(0, MAX_BATCH_SIZE);
  const prompt = buildMappingPrompt(statementType, batch, catalog, alreadyUsedIds);

  logFinanceEvent('statement.mapping.llm_started', {
    traceId,
    statementType,
    unmappedCount: unmapped.length,
    batchSize: batch.length,
  });

  let rawResult = await mapWithOpenAI(prompt, traceId);
  let provider: 'openai' | 'anthropic' | null = rawResult ? 'openai' : null;

  if (!rawResult) {
    rawResult = await mapWithAnthropic(prompt, traceId);
    provider = rawResult ? 'anthropic' : null;
  }

  if (!rawResult) {
    logFinanceEvent('statement.mapping.llm_skipped', {
      traceId,
      reason: 'no_provider_available',
    });
    return { proposals: [], provider: null, model: null, durationMs: Date.now() - t0 };
  }

  const validCanonicalIds = new Set(
    getCanonicalLinesByStatementType(
      statementType === 'P&L' ? 'P&L' : statementType === 'BS' ? 'BS' : 'CF'
    ).map((l: CanonicalLineDefinition) => l.id)
  );

  const proposals: LlmMappingProposal[] = rawResult.proposals
    .map((raw: unknown) => {
      const item = raw as Record<string, unknown>;
      const lineIndex = Number(item.lineIndex || item.line_index || 0);
      const canonicalId = String(item.canonicalId || item.canonical_id || '').trim() || null;
      const confidence = Number(item.confidence ?? 0);
      const reason = String(item.reason || '').trim();

      if (lineIndex < 1 || lineIndex > batch.length) return null;
      const originalLabel = batch[lineIndex - 1].label;

      if (canonicalId && !validCanonicalIds.has(canonicalId)) return null;
      if (canonicalId && alreadyUsedIds.has(canonicalId)) return null;

      return {
        originalLabel,
        canonicalId: confidence >= 0.5 ? canonicalId : null,
        canonicalLabel: canonicalId
          ? getCanonicalLinesByStatementType(
              statementType === 'P&L' ? 'P&L' : statementType === 'BS' ? 'BS' : 'CF'
            ).find((l: CanonicalLineDefinition) => l.id === canonicalId)?.labelEn || canonicalId
          : null,
        confidence,
        reason,
      } as LlmMappingProposal;
    })
    .filter(Boolean) as LlmMappingProposal[];

  logFinanceEvent('statement.mapping.llm_resolved', {
    traceId,
    provider,
    model: rawResult.model,
    totalProposals: proposals.length,
    autoAccepted: proposals.filter((p) => p.confidence >= CONFIDENCE_AUTO_ACCEPT && p.canonicalId).length,
    lowConfidence: proposals.filter((p) => p.confidence < CONFIDENCE_AUTO_ACCEPT && p.canonicalId).length,
    noMatch: proposals.filter((p) => !p.canonicalId).length,
    durationMs: Date.now() - t0,
  });

  return {
    proposals,
    provider,
    model: rawResult.model,
    durationMs: Date.now() - t0,
  };
}

/**
 * Apply LLM mapping proposals to extracted lines (mutates in place).
 * Only auto-accepts proposals above the confidence threshold.
 */
export function applyLlmProposals(
  lines: ExtractedLine[],
  proposals: LlmMappingProposal[],
  options?: { autoAcceptThreshold?: number }
): { applied: number; skipped: number } {
  const threshold = options?.autoAcceptThreshold ?? CONFIDENCE_AUTO_ACCEPT;
  let applied = 0;
  let skipped = 0;

  for (const proposal of proposals) {
    if (!proposal.canonicalId || proposal.confidence < threshold) {
      skipped++;
      continue;
    }

    const target = lines.find(
      (l) =>
        l.originalLabel === proposal.originalLabel &&
        !l.suggestedCanonicalId &&
        !l.isNonFinancial
    );

    if (!target) {
      skipped++;
      continue;
    }

    target.suggestedCanonicalId = proposal.canonicalId;
    target.suggestedCanonicalLabel = proposal.canonicalLabel || proposal.canonicalId;
    target.mappingReason = `llm_mapping (${proposal.confidence.toFixed(2)}): ${proposal.reason}`;

    if (!target.mappingCandidates) target.mappingCandidates = [];
    target.mappingCandidates.push({
      canonicalLineId: proposal.canonicalId,
      canonicalLabel: proposal.canonicalLabel || proposal.canonicalId,
      score: proposal.confidence,
      reason: `LLM: ${proposal.reason}`,
      selected: true,
    });

    applied++;
  }

  return { applied, skipped };
}

/**
 * Second-pass LLM mapping for lines that were stripped by duplicate resolution.
 * These lines HAD a mapping but lost to a higher-confidence competitor.
 * The LLM now sees a tighter catalog (excluding all currently-used IDs) and can
 * find alternative, non-conflicting canonical IDs.
 */
export async function mapDuplicateConflictLinesWithLLM(params: {
  allLines: ExtractedLine[];
  statementType: string;
  traceId?: string;
}): Promise<LlmMappingResult> {
  const t0 = Date.now();
  const { allLines, statementType, traceId } = params;

  const conflictLines = allLines.filter(
    (l) => l.mappingReason === 'duplicate_candidate_conflict' && l.originalLabel
  );

  if (conflictLines.length === 0) {
    return { proposals: [], provider: null, model: null, durationMs: 0 };
  }

  const catalog = buildCanonicalCatalog(statementType);

  const alreadyUsedIds = new Set<string>(
    allLines
      .filter((l) => l.suggestedCanonicalId)
      .map((l) => l.suggestedCanonicalId!)
  );

  const conflictWithContext = conflictLines.map((line) => {
    const idx = allLines.indexOf(line);
    const prev = idx > 0 ? allLines[idx - 1]?.originalLabel : '';
    const next = idx < allLines.length - 1 ? allLines[idx + 1]?.originalLabel : '';
    return {
      label: line.originalLabel,
      value: line.value,
      neighbors: [prev, next].filter(Boolean) as string[],
    };
  });

  const MAX_BATCH_SIZE = 30;
  const batch = conflictWithContext.slice(0, MAX_BATCH_SIZE);
  const prompt = buildMappingPrompt(statementType, batch, catalog, alreadyUsedIds);

  logFinanceEvent('statement.mapping.llm_second_pass_started', {
    traceId,
    statementType,
    conflictCount: conflictLines.length,
    batchSize: batch.length,
    usedIdsCount: alreadyUsedIds.size,
  });

  let rawResult = await mapWithOpenAI(prompt, traceId);
  let provider: 'openai' | 'anthropic' | null = rawResult ? 'openai' : null;

  if (!rawResult) {
    rawResult = await mapWithAnthropic(prompt, traceId);
    provider = rawResult ? 'anthropic' : null;
  }

  if (!rawResult) {
    return { proposals: [], provider: null, model: null, durationMs: Date.now() - t0 };
  }

  const validCanonicalIds = new Set(
    getCanonicalLinesByStatementType(
      statementType === 'P&L' ? 'P&L' : statementType === 'BS' ? 'BS' : 'CF'
    ).map((l: CanonicalLineDefinition) => l.id)
  );

  const proposals: LlmMappingProposal[] = rawResult.proposals
    .map((raw: unknown) => {
      const item = raw as Record<string, unknown>;
      const lineIndex = Number(item.lineIndex || item.line_index || 0);
      const canonicalId = String(item.canonicalId || item.canonical_id || '').trim() || null;
      const confidence = Number(item.confidence ?? 0);
      const reason = String(item.reason || '').trim();

      if (lineIndex < 1 || lineIndex > batch.length) return null;
      const originalLabel = batch[lineIndex - 1].label;

      if (canonicalId && !validCanonicalIds.has(canonicalId)) return null;
      if (canonicalId && alreadyUsedIds.has(canonicalId)) return null;

      return {
        originalLabel,
        canonicalId: confidence >= 0.5 ? canonicalId : null,
        canonicalLabel: canonicalId
          ? getCanonicalLinesByStatementType(
              statementType === 'P&L' ? 'P&L' : statementType === 'BS' ? 'BS' : 'CF'
            ).find((l: CanonicalLineDefinition) => l.id === canonicalId)?.labelEn || canonicalId
          : null,
        confidence,
        reason,
      } as LlmMappingProposal;
    })
    .filter(Boolean) as LlmMappingProposal[];

  logFinanceEvent('statement.mapping.llm_second_pass_resolved', {
    traceId,
    provider,
    model: rawResult.model,
    totalProposals: proposals.length,
    autoAccepted: proposals.filter((p) => p.confidence >= CONFIDENCE_AUTO_ACCEPT && p.canonicalId).length,
    durationMs: Date.now() - t0,
  });

  return {
    proposals,
    provider,
    model: rawResult.model,
    durationMs: Date.now() - t0,
  };
}

/**
 * Apply second-pass proposals to duplicate-conflict lines (mutates in place).
 * Also ensures no new duplicates are created.
 */
export function applySecondPassProposals(
  lines: ExtractedLine[],
  proposals: LlmMappingProposal[],
  options?: { autoAcceptThreshold?: number }
): { applied: number; skipped: number } {
  const threshold = options?.autoAcceptThreshold ?? CONFIDENCE_AUTO_ACCEPT;
  const currentlyUsed = new Set<string>(
    lines.filter((l) => l.suggestedCanonicalId).map((l) => l.suggestedCanonicalId!)
  );
  let applied = 0;
  let skipped = 0;

  for (const proposal of proposals) {
    if (!proposal.canonicalId || proposal.confidence < threshold) {
      skipped++;
      continue;
    }

    if (currentlyUsed.has(proposal.canonicalId)) {
      skipped++;
      continue;
    }

    const target = lines.find(
      (l) =>
        l.originalLabel === proposal.originalLabel &&
        l.mappingReason === 'duplicate_candidate_conflict'
    );

    if (!target) {
      skipped++;
      continue;
    }

    target.suggestedCanonicalId = proposal.canonicalId;
    target.suggestedCanonicalLabel = proposal.canonicalLabel || proposal.canonicalId;
    target.mappingReason = `llm_second_pass (${proposal.confidence.toFixed(2)}): ${proposal.reason}`;

    if (!target.mappingCandidates) target.mappingCandidates = [];
    target.mappingCandidates.push({
      canonicalLineId: proposal.canonicalId,
      canonicalLabel: proposal.canonicalLabel || proposal.canonicalId,
      score: proposal.confidence,
      reason: `LLM-2nd: ${proposal.reason}`,
      selected: true,
    });

    currentlyUsed.add(proposal.canonicalId);
    applied++;
  }

  return { applied, skipped };
}

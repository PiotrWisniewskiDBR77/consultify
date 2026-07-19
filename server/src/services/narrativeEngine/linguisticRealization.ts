/**
 * Narrative Engine — Layer 4: Linguistic Realization
 *
 * Builds an LLM prompt from the discourse plan, facts, and observations,
 * then calls the language model to produce the final narrative text.
 *
 * Style constraints (communication register, language, anti-hallucination rules,
 * source citations) are encoded into the system prompt.
 *
 * Calls the LLM service via dynamic import (same pattern as reportGenerationService).
 * Falls back to deterministic rendering when LLM is unavailable.
 */

import logger from '../../utils/Logger.js';
import modelRouter from '../ai/modelRouter.js';
import type {
  DiscoursePlan,
  FactSet,
  NarrativeEngineInput,
  NarrativeSegment,
  Observation,
} from './types.js';

// ── Register-specific style instructions ────────────────────────

const REGISTER_INSTRUCTIONS: Record<string, string> = {
  formal:
    'Use formal, professional language. Avoid contractions and colloquialisms. Write in third person.',
  semi_formal:
    'Use semi-formal business language. Mild contractions are acceptable. Write clearly and concisely.',
  informal: 'Use accessible, conversational language. First person plural ("we") is acceptable.',
  executive:
    'Use crisp, executive-level language. Lead with conclusions. Minimize jargon. Be direct.',
  technical:
    'Use precise technical language. Include specific numbers, units, and methodology references.',
};

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: 'CRITICAL: Write ALL content in English, regardless of the language of any source facts, labels, or the discourse plan. Every sentence must be in English.',
  pl: 'BEZWZGLĘDNIE WAŻNE: Całą treść pisz po POLSKU, niezależnie od języka faktów źródłowych, etykiet czy planu dyskursu. Każde zdanie musi być po polsku.',
};

// ── Prompt construction ─────────────────────────────────────────

// Exported (O2.5 proof): CONCLUSION_LAYER_STANDARD compliance (answer-first,
// anti-fabrication, assumption-labeling) is asserted directly against this
// builder in tests/unit/narrativeEngineConclusionLayer.test.ts — this prompt
// is shared by presentationGeneratorService (deck) and reportGenerationService
// (report), so one prompt-level test covers both surfaces.
export function buildSystemPrompt(input: NarrativeEngineInput): string {
  const { report_config } = input;
  const registerGuide =
    REGISTER_INSTRUCTIONS[report_config.communication_register] ?? REGISTER_INSTRUCTIONS.formal;
  const langGuide = LANGUAGE_INSTRUCTIONS[report_config.language] ?? LANGUAGE_INSTRUCTIONS.en;

  const instructionBlock =
    typeof input.user_instruction === 'string' && input.user_instruction.trim().length > 0
      ? [
          '',
          '## Author Instruction (HIGHEST PRIORITY)',
          'The author has requested a specific rewrite of this slide. Honour it while still obeying the factual rules above:',
          `> ${input.user_instruction.trim()}`,
        ]
      : [];

  return [
    'You are a report narrative engine. Your task is to write a single report section based on a structured discourse plan.',
    '',
    '## Rules',
    '1. ANSWER-FIRST (Pyramid Principle): the opening sentence of the section must state the conclusion or headline finding — never a preamble, a restated section title, or a warm-up sentence.',
    '2. Use ONLY the facts and observations provided. NEVER invent numbers, dates, names, or external citations ' +
      '(no "according to Gartner/McKinsey/IDC", no market-size figures) that are not backed by a provided fact. ' +
      'You MAY compute a simple derivation from given facts (e.g. a delta, ratio, or growth rate between two ' +
      'provided numbers) — present it as a computed value, not as a separate sourced fact.',
    '3. Every quantitative claim must cite its source fact (use inline [Fact: <label>] markers). If a claim goes ' +
      'beyond the provided facts, mark it explicitly as an assumption in parentheses (e.g. "(assumption: ...)") ' +
      'rather than stating it as unqualified fact — never fabricate a precise-looking number to fill a gap.',
    '4. Recommendations must include "because" + evidence from the provided facts.',
    '5. Respect the target word count for each segment (±15%).',
    '6. Output clean Markdown: use ## for the section title, ### for sub-headings, **bold** for emphasis.',
    '7. Do not add metadata, preamble, or closing remarks outside the section content.',
    '',
    `## Style: ${registerGuide}`,
    `## Language: ${langGuide}`,
    `## Report type: ${report_config.report_type_v3}`,
    `## Report goal: ${report_config.goal_v3}`,
    `## Density: ${report_config.density}`,
    `## Data level: ${report_config.data_level}`,
    ...instructionBlock,
  ].join('\n');
}

function formatFactsForPrompt(facts: FactSet[]): string {
  if (facts.length === 0) return 'No structured facts available.';

  return facts
    .map((f) => {
      const unitStr = f.unit ? ` ${f.unit}` : '';
      const src = f.source_ref.artifact_name;
      return `- [${f.fact_id}] ${f.label}: ${f.value}${unitStr} (source: ${src}, category: ${f.category})`;
    })
    .join('\n');
}

function formatObservationsForPrompt(observations: Observation[]): string {
  if (observations.length === 0) return 'No observations identified.';

  return observations
    .map((o) => `- [${o.observation_id}] (${o.type}, severity: ${o.severity}) ${o.narrative_hint}`)
    .join('\n');
}

function formatDiscoursePlanForPrompt(plan: DiscoursePlan): string {
  const lines = [
    `Section: "${plan.section_title}" (key: ${plan.section_key})`,
    `Register: ${plan.communication_register} | Density: ${plan.density}`,
    '',
    'Segment plan:',
  ];

  for (const seg of plan.segments) {
    lines.push(
      `  ${seg.order + 1}. [${seg.segment_type}] ${seg.content_hint} (~${seg.target_word_count} words)`
    );
    if (seg.related_observations.length > 0) {
      lines.push(`     Related observations: ${seg.related_observations.join(', ')}`);
    }
  }

  return lines.join('\n');
}

function buildUserPrompt(
  plan: DiscoursePlan,
  facts: FactSet[],
  observations: Observation[],
  input: NarrativeEngineInput
): string {
  const parts = [
    `# Section: ${plan.section_title}`,
    '',
    '## Available Facts',
    formatFactsForPrompt(facts),
    '',
    '## Identified Observations',
    formatObservationsForPrompt(observations),
    '',
    '## Discourse Plan',
    formatDiscoursePlanForPrompt(plan),
  ];

  if (input.previous_sections_summaries && input.previous_sections_summaries.length > 0) {
    parts.push('', '## Previous Sections Context');
    for (const prev of input.previous_sections_summaries) {
      parts.push(`- ${prev.key}: ${prev.summary}`);
    }
  }

  parts.push(
    '',
    '## Instructions',
    'Write the full section content following the discourse plan above.',
    'Output Markdown only. Start with ## as the section heading.'
  );

  if (typeof input.user_instruction === 'string' && input.user_instruction.trim().length > 0) {
    parts.push(
      '',
      'IMPORTANT — apply the author instruction declared in the system prompt:',
      `"${input.user_instruction.trim()}"`
    );
  }

  return parts.join('\n');
}

// ── LLM integration ─────────────────────────────────────────────

let _llmService: any = null;

async function getLLMService(): Promise<any> {
  if (_llmService) return _llmService;
  try {
    const mod = await import('../ai/llmService.js');
    _llmService = mod.llmService || mod.default;
    return _llmService;
  } catch {
    return null;
  }
}

function buildFallbackContent(
  plan: DiscoursePlan,
  facts: FactSet[],
  observations: Observation[]
): string {
  const lines: string[] = [`## ${plan.section_title}`, ''];

  const segmentsByType = new Map<string, NarrativeSegment[]>();
  for (const seg of plan.segments) {
    if (!segmentsByType.has(seg.segment_type)) segmentsByType.set(seg.segment_type, []);
    segmentsByType.get(seg.segment_type)!.push(seg);
  }

  const obsSegments = segmentsByType.get('observation') ?? [];
  if (obsSegments.length > 0) {
    lines.push('### Key Observations', '');
    for (const seg of obsSegments) {
      const relObs = observations.filter((o) =>
        seg.related_observations.includes(o.observation_id)
      );
      for (const o of relObs) {
        const relFacts = facts.filter((f) => o.related_facts.includes(f.fact_id));
        const citations = relFacts.map((f) => `[Fact: ${f.label}]`).join(', ');
        lines.push(`- ${o.narrative_hint}${citations ? ` (${citations})` : ''}`);
      }
      if (relObs.length === 0) {
        lines.push(`- ${seg.content_hint}`);
      }
    }
    lines.push('');
  }

  const explSegments = segmentsByType.get('explanation') ?? [];
  if (explSegments.length > 0) {
    lines.push('### Analysis', '');
    for (const seg of explSegments) {
      lines.push(`${seg.content_hint}`, '');
    }
  }

  const implSegments = segmentsByType.get('implication') ?? [];
  if (implSegments.length > 0) {
    lines.push('### Implications', '');
    for (const seg of implSegments) {
      lines.push(`- ${seg.content_hint}`);
    }
    lines.push('');
  }

  const recSegments = segmentsByType.get('recommendation') ?? [];
  if (recSegments.length > 0) {
    lines.push('### Recommendations', '');
    for (const seg of recSegments) {
      lines.push(`- ${seg.content_hint}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  input: NarrativeEngineInput
): Promise<string> {
  const llm = await getLLMService();
  if (!llm) {
    logger.warn('[NarrativeEngine:L4] LLM service not available, using fallback');
    return '';
  }

  try {
    const totalWords = userPrompt.split(/\s+/).length;
    const maxTokens = Math.max(800, Math.min(totalWords * 3, 4096));
    const modelConfig = await modelRouter.select({
      capability: 'report_section',
      purpose: input.aiPurpose || 'report_section_draft',
      organizationId: input.organizationId,
      tier: 'STANDARD',
    });

    const result = await llm.call({
      type: 'text',
      modelConfig: {
        provider: modelConfig.provider,
        id: modelConfig.id,
        endpoint: modelConfig.endpoint || undefined,
        apiKey: modelConfig.apiKey || undefined,
      },
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens,
      temperature: 0.6,
      cache: true,
      cacheTtl: 3600,
    });

    const content = String(result?.content || '');
    if (content.trim().length < 30) {
      logger.warn('[NarrativeEngine:L4] LLM returned too-short content, using fallback');
      return '';
    }

    return content;
  } catch (err) {
    logger.error('[NarrativeEngine:L4] LLM call failed, using fallback', { error: err });
    return '';
  }
}

/**
 * Realize the discourse plan into natural-language Markdown text.
 */
export async function realizeLinguistically(
  plan: DiscoursePlan,
  facts: FactSet[],
  observations: Observation[],
  input: NarrativeEngineInput
): Promise<string> {
  const systemPrompt = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt(plan, facts, observations, input);

  const llmResponse = await callLLM(systemPrompt, userPrompt, input);

  if (llmResponse && llmResponse.trim().length > 0) {
    return llmResponse;
  }

  return buildFallbackContent(plan, facts, observations);
}

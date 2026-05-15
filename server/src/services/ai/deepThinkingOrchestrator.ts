/**
 * Deep Thinking Orchestrator (v2.0)
 *
 * Standalone orchestration that:
 * - emits state events for UI (SSE-friendly payloads)
 * - runs web research with iterative deepening (Tavily + deepResearchService)
 * - injects organization context for personalized research
 * - returns a system-instruction addon to enforce decision-grade output
 *
 * v2.0 changes:
 * - Iterative deepening support (2 rounds)
 * - Organization context injection
 * - Enhanced research addon with full content + Tavily answer
 * - Research type detection & task-specific format
 * - Clarification answers support
 *
 * Important: This is one-way / composable. It does not know or care about downstream consumers.
 */
import logger from '../../utils/Logger.js';
import type { DeepResearchOutput, ResearchType } from './deepResearchService.js';

export type DeepThinkingDepth = 'light' | 'standard' | 'hard';

export type DtState = 'research_visibility' | 'research' | 'thinking' | 'synthesis' | 'closure';

export type EmitFn = (payload: Record<string, unknown>) => void;

export type DeepThinkingPreludeInput = {
  message: string;
  language?: string;
  context?: Record<string, unknown> | null;
  aiModes?: { deepResearch?: boolean; webSearch?: boolean; showReasoning?: boolean } | null;
  /** Organization context for personalized research */
  orgContext?: {
    industry?: string;
    region?: string;
    maturityLevel?: string;
    organizationName?: string;
    terminology?: Record<string, string>;
    strategicPriorities?: string[];
    openGaps?: string[];
    keyMetrics?: string[];
  } | null;
  /** Clarification answers from user */
  clarificationAnswers?: Record<string, string> | null;
  emit: EmitFn;
};

export type DeepThinkingPreludeOutput = {
  systemInstructionAddon: string;
  researchOutput?: DeepResearchOutput | null;
  researchType?: ResearchType;
};

function normalizeDepth(raw: unknown): DeepThinkingDepth {
  const d = String(raw || '').toLowerCase();
  if (d === 'light') return 'light';
  if (d === 'hard') return 'hard';
  return 'standard';
}

function buildDeepThinkingFormatAddon(
  showHighlights?: boolean,
  researchType?: ResearchType,
  expectedOutput?: 'Decision' | 'StructuredAnalysis' | 'FullReport'
): string {
  const outputMode = expectedOutput || 'FullReport';
  // If research has task-specific synthesis, use lighter format rules
  if (researchType && researchType !== 'general_research') {
    return [
      '\n\n## OUTPUT QUALITY RULES (must follow)',
      `- Output mode: ${outputMode}.`,
      '- No fluff. No blog style. This is boardroom-grade.',
      '- Separate facts vs assumptions explicitly.',
      '- Use citation markers [n] to reference sources.',
      '- Include specific data: company names, numbers, dates, financial figures.',
      '- Be opinionated — give clear recommendations, not just neutral descriptions.',
      ...(outputMode === 'Decision'
        ? [
            '- Lead with one recommended decision and explain the trade-offs briefly.',
            '- Keep the response compact and executive. Focus on recommendation, rationale, risks, next moves.',
          ]
        : []),
      ...(outputMode === 'StructuredAnalysis'
        ? [
            '- Use a structured analysis format with explicit comparison criteria and evidence.',
            '- Keep recommendations concise; the core deliverable is the analysis itself.',
          ]
        : []),
      ...(outputMode === 'FullReport'
        ? [
            '- Deliver a comprehensive report with clear sections, evidence, and implementation guidance.',
          ]
        : []),
      ...(showHighlights
        ? ['- Include a "Reasoning highlights" section (3–6 bullets, high-level).']
        : []),
      '- Do NOT reveal chain-of-thought.',
    ].join('\n');
  }

  return [
    '\n\n## DEEP THINKING OUTPUT FORMAT (must follow)',
    `Output mode: ${outputMode}`,
    ...(outputMode === 'Decision'
      ? [
          '1) Decision recommendation',
          '2) Why this decision now',
          '3) Trade-offs and rejected options',
          '4) Risks & blind spots (Assumptions & Gaps)',
          ...(showHighlights ? ['5) Reasoning highlights (3–6 bullets, high-level)'] : []),
          `5${showHighlights ? 'b' : ''}) Next actions (owners / signals / timing)`,
        ]
      : outputMode === 'StructuredAnalysis'
        ? [
            '1) Executive Summary (3–5 lines)',
            '2) Problem Framing',
            '3) Evaluation criteria',
            '4) Options analysis (2–4)',
            '5) Recommendation + boundary conditions',
            ...(showHighlights ? ['6) Reasoning highlights (3–6 bullets, high-level)'] : []),
            `6${showHighlights ? 'b' : ''}) Risks & Blind spots (Assumptions & Gaps)`,
            '7) Next actions (checklist + early signals)',
          ]
        : [
            '1) Executive Summary (5–7 lines)',
            '2) Problem Framing',
            '3) Options (2–4)',
            '4) Recommendation + boundary conditions',
            ...(showHighlights ? ['5) Reasoning highlights (3–6 bullets, high-level)'] : []),
            `5${showHighlights ? 'b' : ''}) Risks & Blind spots (Assumptions & Gaps)`,
            '6) Next actions (checklist + early signals)',
          ]),
    '',
    'Rules:',
    '- No fluff. No blog style. This is boardroom-grade.',
    '- Separate facts vs assumptions explicitly.',
    '- Do NOT reveal chain-of-thought. If reasoning highlights are requested, keep them high-level.',
  ].join('\n');
}

function buildResearchAddon(researchOutput: DeepResearchOutput): string {
  const topSources = (researchOutput.sources || []).slice(0, 20);

  // Build source block with full content when available
  const sourcesBlock = topSources
    .map((s: any, i: number) => {
      const content = s.fullContent
        ? s.fullContent.slice(0, 2000)
        : s.snippets?.join(' ').slice(0, 800) || '';
      return `[${i + 1}] ${s.title} (${s.domain})\nURL: ${s.url}\n${content}`;
    })
    .join('\n\n');

  const parts = [
    '\n\n## WEB RESEARCH (provided by system)',
    `Research type: ${researchOutput.researchType || 'general'}`,
    `Sources found: ${researchOutput.metadata?.totalSources || 0} from ${researchOutput.metadata?.uniqueDomains || 0} domains`,
    `Research rounds: ${researchOutput.metadata?.rounds || 1}`,
    '',
    'Use these sources to ground your recommendations. Cite sources using [n] markers.',
    'Do not claim you searched the web beyond the provided sources.',
  ];

  // Include Tavily's built-in answer as additional context
  if (researchOutput.tavilyAnswer) {
    parts.push('', `### Quick Answer (AI-generated summary):\n${researchOutput.tavilyAnswer}`);
  }

  // Include the full synthesis from deep research
  if (researchOutput.synthesis) {
    parts.push('', `### Research Synthesis:\n${researchOutput.synthesis}`);
  }

  // Include detailed source material
  if (sourcesBlock) {
    parts.push('', `### Detailed Sources:\n${sourcesBlock}`);
  }

  return parts.filter(Boolean).join('\n');
}

/**
 * Extract lightweight org context for research personalization.
 */
async function extractOrgContext(
  userId?: string,
  organizationId?: string
): Promise<DeepThinkingPreludeInput['orgContext']> {
  if (!userId || !organizationId) return null;

  try {
    const orgContextMod = await import('../organizationContext/OrganizationContextService.js');
    const orgContextService = (orgContextMod.default || orgContextMod) as any;
    const resolved = await orgContextService.buildResolvedContext(organizationId);

    return {
      organizationName: resolved.profile?.companyName || undefined,
      industry: resolved.profile?.industry || undefined,
      region: resolved.profile?.location || undefined,
      maturityLevel: resolved.systems?.cloudAdoption || undefined,
      terminology: undefined,
      strategicPriorities: resolved.strategic?.priorities || [],
      openGaps: (resolved.operations?.gaps || []).map(
        (g: any) => g.description || g.title || JSON.stringify(g)
      ),
      keyMetrics: (resolved.operations?.keyMetrics || []).map((m: any) =>
        m.name ? `${m.name}: ${m.value ?? ''}` : JSON.stringify(m)
      ),
    };
  } catch (err: any) {
    logger.debug(`[DeepThinking] Org context extraction failed: ${err?.message}`);
    return null;
  }
}

export class DeepThinkingOrchestrator {
  async runPrelude(input: DeepThinkingPreludeInput): Promise<DeepThinkingPreludeOutput> {
    const { message, language, context, aiModes, emit, clarificationAnswers } = input;

    const forcedResearchType = (context as any)?.__forceResearchType as ResearchType | undefined;

    const enabled = aiModes?.deepResearch === true;
    if (!enabled) {
      return { systemInstructionAddon: '' };
    }

    // 0) Extract org context for personalized research
    let orgContext = input.orgContext || null;
    if (!orgContext) {
      const userId = (context as any)?.userId;
      const organizationId = (context as any)?.organizationId;
      orgContext = (await extractOrgContext(userId, organizationId)) ?? null;
    }

    // 1) Research visibility (always visible, even without web search)
    emit({
      type: 'dt_state',
      state: 'research_visibility' satisfies DtState,
      label: 'Research visibility',
    });

    const confirm =
      (context as any)?.deepThinkingConfirm || (context as any)?.deepThinking?.confirm;
    const expectedOutput =
      (context as any)?.deepThinkingExpectedOutput ||
      confirm?.understanding?.expectedOutput ||
      'FullReport';
    const planItems =
      Array.isArray(confirm?.researchPlanItems) && confirm.researchPlanItems.length
        ? confirm.researchPlanItems
        : [
            {
              id: 'plan-1',
              type: 'ConceptualFrameworks',
              label: 'Conceptual frameworks',
              rationale: 'Pick the right decision frame and axes',
            },
            {
              id: 'plan-2',
              type: 'PriorPatterns',
              label: 'Prior patterns',
              rationale: 'Use known patterns and failure modes',
            },
            {
              id: 'plan-3',
              type: 'UserInputs',
              label: 'User inputs',
              rationale: 'Use only conversation-provided facts/constraints',
            },
            {
              id: 'plan-4',
              type: 'ExternalReferences',
              label: 'External references (web search + iterative deepening)',
              rationale: 'Real-time web data with multi-round research',
            },
            ...(orgContext
              ? [
                  {
                    id: 'plan-5',
                    type: 'OrganizationContext',
                    label: 'Organization context',
                    rationale: `Personalized for ${orgContext.organizationName || 'your organization'}`,
                  },
                ]
              : []),
          ];

    emit({
      type: 'research_visibility',
      items: planItems.map((it: any) => ({
        id: it.id,
        type: it.type,
        label: it.label,
        rationale: it.rationale || '',
        status: 'planned',
      })),
    });

    // 2) Research execution (web search with iterative deepening)
    emit({ type: 'dt_state', state: 'research' satisfies DtState, label: 'Research execution' });

    const depth = normalizeDepth((context as any)?.deepThinkingDepth);
    const webSearchEnabled = aiModes?.webSearch === true;
    const showHighlights = aiModes?.showReasoning === true;

    let researchOutput: DeepResearchOutput | null = null;

    if (webSearchEnabled) {
      try {
        const orgId = String((context as any)?.organizationId || '').trim();
        const projectId = String((context as any)?.projectId || '').trim() || undefined;

        // T118: central governance (policy + SSRF + allow/deny + sanitize + cache)
        const govMod = (await import('./webSearchGovernance.js')) as any;
        const getEffectiveWebSearchPolicy =
          govMod.getEffectiveWebSearchPolicy || govMod.default?.getEffectiveWebSearchPolicy;
        const sanitizeQuery = govMod.sanitizeQuery || govMod.default?.sanitizeQuery;
        const filterResults = govMod.filterResults || govMod.default?.filterResults;
        const getCached = govMod.getCached || govMod.default?.getCached;
        const setCache = govMod.setCache || govMod.default?.setCache;

        const policy =
          orgId && typeof getEffectiveWebSearchPolicy === 'function'
            ? await getEffectiveWebSearchPolicy(orgId, projectId)
            : { internetEnabled: false, reason: 'Organization context missing' };

        if (!policy?.internetEnabled) {
          emit({
            type: 'research_progress',
            topic: message,
            stage: 'complete',
            queries: [],
            sources: [],
            error: policy?.reason || 'Internet disabled by policy',
          });
          researchOutput = null;
        } else {
          const { conductDeepResearch } = await import('./deepResearchService.js');
          const { RuntimeWebSearchService } = await import('./runtimeWebSearchService.js');
          const base = new (RuntimeWebSearchService as any)();

          const webSearchService = {
            search: async (rawQuery: string, options: any) => {
              const clean =
                typeof sanitizeQuery === 'function'
                  ? sanitizeQuery(String(rawQuery || ''))
                  : rawQuery;
              const cached =
                typeof getCached === 'function' ? getCached(orgId, clean, language) : null;
              if (cached) return cached as any;
              const resp = await base.search(clean, options);
              const filtered =
                typeof filterResults === 'function'
                  ? filterResults(resp.results || [], policy)
                  : resp.results || [];
              const out = { ...resp, query: clean, results: filtered };
              if (typeof setCache === 'function') setCache(orgId, clean, out, language);
              return out;
            },
          };

          const maxQueries = depth === 'light' ? 4 : depth === 'hard' ? 12 : 8;
          const maxSourcesPerQuery = depth === 'light' ? 4 : depth === 'hard' ? 8 : 8;
          const iterativeDeepening = depth !== 'light';
          const maxFollowUpQueries = depth === 'hard' ? 8 : 5;

          researchOutput = await conductDeepResearch(
            message,
            {
              maxQueries,
              maxSourcesPerQuery,
              includeNewsResults: true,
              timeRange: 'all',
              language: (language || 'en').split('-')[0],
              iterativeDeepening,
              maxFollowUpQueries,
              forceResearchType: forcedResearchType || undefined,
              orgContext: orgContext || undefined,
              clarificationAnswers: clarificationAnswers || undefined,
            },
            {
              webSearchService,
              onProgress: (status: {
                stage: string;
                queries: unknown[];
                round?: number;
                totalRounds?: number;
              }) => {
                emit({
                  type: 'research_progress',
                  topic: message,
                  stage: status.stage,
                  queries: status.queries,
                  round: status.round,
                  totalRounds: status.totalRounds,
                });
              },
            }
          );
        }

        if (researchOutput) {
          emit({
            type: 'research_progress',
            topic: message,
            stage: 'complete',
            queries: researchOutput.queries,
            sources: (researchOutput.sources || []).map((s: any) => ({
              url: s.url,
              title: s.title,
              domain: s.domain,
              relevanceScore: s.relevanceScore,
            })),
            researchType: researchOutput.researchType,
            rounds: researchOutput.metadata?.rounds || 1,
          });
        }
      } catch (err: any) {
        logger.warn('[DeepThinking] Web research failed, continuing without it:', err?.message);
        emit({
          type: 'research_progress',
          topic: message,
          stage: 'complete',
          queries: [],
          sources: [],
          error: 'Web research unavailable',
        });
      }
    }

    // 3) Thinking (controlled visibility)
    emit({
      type: 'dt_state',
      state: 'thinking' satisfies DtState,
      label: 'Structuring decision axes and options',
    });

    // 3b) Interim Insight checkpoint (hard depth only)
    if (depth === 'hard') {
      try {
        const { modelRouter } = await import('./modelRouter.js');
        const { llmService } = await import('./llmService.js');

        const tier = 'STANDARD';
        const modelCfg = await modelRouter.select({
          capability: 'report_section',
          tier,
          organizationId: 'system',
          options: { tier },
        } as any);

        const interimPrompt = [
          'You are a senior strategy consultant. Given this problem, identify 2-3 dominant solution paths that are emerging.',
          'For each path, provide: a short label (5-10 words) and a one-line summary.',
          'Be concise. Output as JSON array: [{"id":"path_1","label":"...","summary":"..."}]',
          `Language: ${(language || 'en').split('-')[0] === 'pl' ? 'Polish' : 'English'}`,
        ].join('\n');

        const interimResult = (await llmService.callText({
          type: 'chat',
          modelConfig: {
            provider: modelCfg.provider,
            id: modelCfg.id,
            endpoint: (modelCfg as any).endpoint,
            apiKey: (modelCfg as any).apiKey,
          },
          systemPrompt: interimPrompt,
          messages: [{ role: 'user', content: message }],
        } as any)) as any;

        const rawText = String(interimResult?.content || '').trim();

        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const paths = JSON.parse(jsonMatch[0]) as Array<{
            id: string;
            label: string;
            summary: string;
          }>;
          if (Array.isArray(paths) && paths.length > 0) {
            emit({
              type: 'dt_interim_insight',
              paths: paths.slice(0, 3).map((p, i) => ({
                id: p.id || `path_${i + 1}`,
                label: String(p.label || ''),
                summary: String(p.summary || ''),
              })),
            });
          }
        }
      } catch (interimErr: any) {
        logger.warn('[DeepThinking] Interim insight failed, continuing:', interimErr?.message);
      }
    }

    // 4) Synthesis — inject historical decision context (organization memory)
    emit({ type: 'dt_state', state: 'synthesis' satisfies DtState, label: 'Synthesis' });

    let historicalContextAddon = '';
    try {
      const organizationId = (context as any)?.organizationId;
      if (organizationId) {
        const { buildHistoricalContextAddon } = await import('./decisionMemoryService.js');
        historicalContextAddon = await buildHistoricalContextAddon({
          organizationId,
          currentProblem: message,
          language: (language || 'en').split('-')[0],
        });
        if (historicalContextAddon) {
          logger.info(
            `[DeepThinking] Injected historical decision context for org ${organizationId}`
          );
        }
      }
    } catch (histErr: any) {
      logger.debug(`[DeepThinking] Historical context not available: ${histErr?.message}`);
    }

    // 5) Closure
    emit({ type: 'dt_state', state: 'closure' satisfies DtState, label: 'Closure' });

    const researchType = forcedResearchType || researchOutput?.researchType;
    const addon = [
      buildDeepThinkingFormatAddon(showHighlights, researchType, expectedOutput),
      historicalContextAddon,
      researchOutput ? buildResearchAddon(researchOutput) : '',
      researchOutput ? '\n\nRules (research):\n- If sources are provided, cite them as [n].' : '',
    ]
      .filter(Boolean)
      .join('\n');

    return { systemInstructionAddon: addon, researchOutput, researchType };
  }
}

export default DeepThinkingOrchestrator;

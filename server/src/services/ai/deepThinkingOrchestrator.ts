/**
 * Deep Thinking Orchestrator (MVP)
 *
 * Standalone orchestration that:
 * - emits state events for UI (SSE-friendly payloads)
 * - optionally runs web research (Tavily + deepResearchService)
 * - returns a system-instruction addon to enforce decision-grade output
 *
 * Important: This is one-way / composable. It does not know or care about downstream consumers.
 */
import logger from '../../utils/Logger.js';
import type { DeepResearchOutput } from './deepResearchService.js';

export type DeepThinkingDepth = 'light' | 'standard' | 'hard';

export type DtState = 'research_visibility' | 'research' | 'thinking' | 'synthesis' | 'closure';

export type EmitFn = (payload: Record<string, unknown>) => void;

export type DeepThinkingPreludeInput = {
  message: string;
  language?: string;
  context?: Record<string, unknown> | null;
  aiModes?: { deepResearch?: boolean; webSearch?: boolean; showReasoning?: boolean } | null;
  emit: EmitFn;
};

export type DeepThinkingPreludeOutput = {
  systemInstructionAddon: string;
  researchOutput?: DeepResearchOutput | null;
};

function normalizeDepth(raw: unknown): DeepThinkingDepth {
  const d = String(raw || '').toLowerCase();
  if (d === 'light') return 'light';
  if (d === 'hard') return 'hard';
  return 'standard';
}

function buildDeepThinkingFormatAddon(showHighlights?: boolean): string {
  return [
    '\n\n## DEEP THINKING OUTPUT FORMAT (must follow)',
    '1) Executive Summary (5–7 lines)',
    '2) Problem Framing',
    '3) Options (2–4)',
    '4) Recommendation + boundary conditions',
    ...(showHighlights ? ['5) Reasoning highlights (3–6 bullets, high-level)'] : []),
    `5${showHighlights ? 'b' : ''}) Risks & Blind spots (Assumptions & Gaps)`,
    '6) Next actions (checklist + early signals)',
    '',
    'Rules:',
    '- No fluff. No blog style. This is boardroom-grade.',
    '- Separate facts vs assumptions explicitly.',
    '- Do NOT reveal chain-of-thought. If reasoning highlights are requested, keep them high-level.',
  ].join('\n');
}

function buildResearchAddon(researchOutput: DeepResearchOutput): string {
  const topSources = (researchOutput.sources || []).slice(0, 10);
  const sourcesBlock = topSources
    .map((s: any, i: number) => `[${i + 1}] ${s.title} — ${s.url}`)
    .join('\n');

  return [
    '\n\n## WEB RESEARCH (provided by system)',
    'Use these sources to ground your recommendations. Cite sources using [n] markers.',
    'Do not claim you searched the web beyond the provided sources.',
    '',
    researchOutput.synthesis ? `Synthesis:\n${researchOutput.synthesis}` : '',
    sourcesBlock ? `Sources:\n${sourcesBlock}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export class DeepThinkingOrchestrator {
  async runPrelude(input: DeepThinkingPreludeInput): Promise<DeepThinkingPreludeOutput> {
    const { message, language, context, aiModes, emit } = input;

    const enabled = aiModes?.deepResearch === true;
    if (!enabled) {
      return { systemInstructionAddon: '' };
    }

    // 1) Research visibility (always visible, even without web search)
    emit({
      type: 'dt_state',
      state: 'research_visibility' satisfies DtState,
      label: 'Research visibility',
    });

    const confirm =
      (context as any)?.deepThinkingConfirm || (context as any)?.deepThinking?.confirm;
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
              label: 'External references (optional)',
              rationale: 'Only if web search is explicitly enabled',
            },
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

    // 2) Research execution (optional web search)
    emit({ type: 'dt_state', state: 'research' satisfies DtState, label: 'Research execution' });

    const depth = normalizeDepth((context as any)?.deepThinkingDepth);
    const webSearchEnabled = aiModes?.webSearch === true;
    const tavilyKey = (process.env.TAVILY_API_KEY || '').trim();
    const showHighlights = aiModes?.showReasoning === true;

    let researchOutput: DeepResearchOutput | null = null;

    if (webSearchEnabled && tavilyKey) {
      try {
        const { conductDeepResearch } = await import('./deepResearchService.js');
        const { TavilyWebSearchService } = await import('./tavilyWebSearchService.js');
        const webSearchService = new (TavilyWebSearchService as any)(tavilyKey);

        const maxQueries = depth === 'light' ? 4 : depth === 'hard' ? 10 : 8;
        const maxSourcesPerQuery = depth === 'light' ? 3 : depth === 'hard' ? 6 : 5;

        researchOutput = await conductDeepResearch(
          message,
          {
            maxQueries,
            maxSourcesPerQuery,
            includeNewsResults: true,
            timeRange: 'all',
            language: (language || 'en').split('-')[0],
          },
          {
            webSearchService,
            onProgress: (status: { stage: string; queries: unknown[] }) => {
              emit({
                type: 'research_progress',
                topic: message,
                stage: status.stage,
                queries: status.queries,
              });
            },
          }
        );

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
        });
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
    } else if (webSearchEnabled && !tavilyKey) {
      emit({
        type: 'research_progress',
        topic: message,
        stage: 'complete',
        queries: [],
        sources: [],
        error: 'Web research enabled but TAVILY_API_KEY is missing',
      });
    }

    // 3) Thinking (controlled visibility)
    emit({
      type: 'dt_state',
      state: 'thinking' satisfies DtState,
      label: 'Structuring decision axes and options',
    });

    // 3b) Interim Insight checkpoint (hard depth only)
    // For complex tasks, generate a preliminary insight showing emerging paths.
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

        // Parse JSON from response (may be wrapped in markdown code fences)
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

    // 4) Synthesis
    emit({ type: 'dt_state', state: 'synthesis' satisfies DtState, label: 'Synthesis' });

    // 5) Closure
    emit({ type: 'dt_state', state: 'closure' satisfies DtState, label: 'Closure' });

    const addon = [
      buildDeepThinkingFormatAddon(showHighlights),
      researchOutput ? buildResearchAddon(researchOutput) : '',
      researchOutput ? '\n\nRules (research):\n- If sources are provided, cite them as [n].' : '',
    ]
      .filter(Boolean)
      .join('\n');

    return { systemInstructionAddon: addon, researchOutput };
  }
}

export default DeepThinkingOrchestrator;

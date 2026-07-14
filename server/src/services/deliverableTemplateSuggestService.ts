/**
 * deliverableTemplateSuggestService — T4: Teresa-suggests
 *
 * Tryb A: deterministyczny keyword-matcher (PL + EN).
 * Tryb B: LLM (opcjonalny, via llmService.call / structured output).
 *
 * Fail-open: błąd → null suggestion, nigdy wyjątek do callera.
 */

import logger from '../utils/Logger.js';
import type { DeliverableTemplateType } from './deliverableTemplateService.js';
import { listDeliverableTemplates } from './deliverableTemplateService.js';

export interface TemplateSuggestion {
  templateId: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

// ──────────────────────────────────────────────────────────────
// Keyword map — PL + EN per template id (T2 seed ids)
// ──────────────────────────────────────────────────────────────
const INTENT_KEYWORDS: Record<string, string[]> = {
  'dbr77-doc-audit-report': [
    'audit',
    'audyt',
    'raport',
    'report',
    'przegląd',
    'review',
    'kontrola',
    'weryfikacja',
    'check',
    'inspekcja',
    'ocena',
  ],
  'dbr77-doc-exec-memo': [
    'memo',
    'decyzj',
    'zarząd',
    'executive',
    'brief',
    'decyz',
    'notatka służbowa',
    'nota',
    'executive summary',
    'kierownictwo',
    'management',
  ],
  'dbr77-deck-board': [
    'board',
    'zarząd',
    'rada',
    'nadzorcz',
    'akcjonariusz',
    'nadzorczy',
    'supervisory',
    'stakeholder',
    'udziałowiec',
    'dyrekcja',
  ],
  'dbr77-deck-diagnostic': [
    'diagnoz',
    'diagnostic',
    'analiz',
    'ocen',
    'assess',
    'diagnoza',
    'analysis',
    'ocena',
    'read-out',
    'readout',
    'wyniki',
  ],
  'dbr77-table-risk-register': [
    'ryzyko',
    'risk',
    'zagrożen',
    'rejestr',
    'ryzyk',
    'zagrożenie',
    'hazard',
    'threat',
    'mitigat',
    'rejestr ryzyk',
  ],
  'dbr77-table-kpi-dashboard': [
    'kpi',
    'wskaźnik',
    'dashboard',
    'metric',
    'wynik',
    'kpis',
    'miernik',
    'scorecard',
    'indicator',
    'performance',
    'wyniki',
  ],
};

function scoreTemplate(templateId: string, intentLower: string): number {
  const keywords = INTENT_KEYWORDS[templateId] ?? [];
  return keywords.filter((kw) => intentLower.includes(kw)).length;
}

function bestMatchFromKeywords(
  templateIds: string[],
  intentLower: string
): TemplateSuggestion | null {
  let bestId: string | null = null;
  let bestScore = 0;

  for (const id of templateIds) {
    const score = scoreTemplate(id, intentLower);
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  if (!bestId || bestScore < 1) return null;

  const confidence: TemplateSuggestion['confidence'] =
    bestScore >= 3 ? 'high' : bestScore >= 2 ? 'medium' : 'low';

  const kws = (INTENT_KEYWORDS[bestId] ?? []).filter((kw) => intentLower.includes(kw));
  const reasoning = `Keyword match (score ${bestScore}): ${kws.slice(0, 3).join(', ')}`;

  return { templateId: bestId, confidence, reasoning };
}

// ──────────────────────────────────────────────────────────────
// Tryb B — LLM (strukturalne)
// ──────────────────────────────────────────────────────────────
async function suggestViaLlm(
  intent: string,
  type: DeliverableTemplateType,
  orgId: string
): Promise<TemplateSuggestion | null> {
  // Importujemy dynamicznie żeby unit-testy nie ciągnęły całego stacku AI.
  const { llmService } = await import('./ai/llmService.js');
  const { z } = await import('zod');

  const templates = await listDeliverableTemplates(type, orgId);
  if (templates.length === 0) return null;

  const templateList = templates
    .filter((t) => !t.isBlank)
    .map((t) => `- ${t.id}: "${t.name}"${t.description ? ` — ${t.description}` : ''}`)
    .join('\n');

  const systemPrompt =
    'You are a template matcher. Given a user intent and a list of document templates, ' +
    'suggest the best matching template ID. Reply with ONLY a JSON object conforming to the schema.';

  const userPrompt =
    `User intent: "${intent}"\n` +
    `Available templates (type=${type}):\n${templateList}\n\n` +
    'Return the single best match, or templateId=null with confidence=low if none fit.';

  const LlmOutputSchema = z.object({
    templateId: z.string().nullable(),
    confidence: z.enum(['high', 'medium', 'low']),
    reasoning: z.string(),
  });

  const result = await (llmService as any).call({
    type: 'structured',
    modelConfig: { id: 'standard' },
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    schema: LlmOutputSchema,
    maxTokens: 300,
    temperature: 0.1,
    cache: false,
  });

  const obj = (result as any)?.object;
  if (!obj || !obj.templateId) return null;

  return {
    templateId: obj.templateId,
    confidence: obj.confidence ?? 'low',
    reasoning: obj.reasoning ?? 'LLM suggestion',
  };
}

// ──────────────────────────────────────────────────────────────
// Główna funkcja
// ──────────────────────────────────────────────────────────────
export async function suggestTemplate(
  intent: string,
  type: DeliverableTemplateType,
  orgId: string,
  options?: { useLlm?: boolean }
): Promise<TemplateSuggestion | null> {
  const intentLower = intent.toLowerCase();

  // Tryb B — LLM (gdy jawnie włączony)
  if (options?.useLlm) {
    try {
      const llmResult = await suggestViaLlm(intent, type, orgId);
      if (llmResult) return llmResult;
      // Fallback do keyword-matchera jeśli LLM nie zwrócił wyniku
    } catch (err) {
      logger.warn('[deliverableTemplateSuggest] LLM failed, falling back to keywords', { err });
    }
  }

  // Tryb A — deterministyczny keyword-matcher
  try {
    // Filtrujemy klucze INTENT_KEYWORDS do pasującego typu
    const typePrefix: Record<DeliverableTemplateType, string> = {
      doc: 'dbr77-doc-',
      deck: 'dbr77-deck-',
      table: 'dbr77-table-',
    };
    const prefix = typePrefix[type];
    const candidateIds = Object.keys(INTENT_KEYWORDS).filter((id) => id.startsWith(prefix));

    return bestMatchFromKeywords(candidateIds, intentLower);
  } catch (err) {
    logger.error('[deliverableTemplateSuggest] keyword matching failed', { err });
    return null;
  }
}

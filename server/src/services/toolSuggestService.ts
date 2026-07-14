/**
 * toolSuggestService — #64: "which tool do I pick?" AI picker
 *
 * Given a short free-text problem description, returns up to 3 candidate
 * tools from the active KnownToolsService catalog, each with a 1-sentence
 * reasoning. Mirrors the pattern in deliverableTemplateSuggestService.ts
 * (T4 Teresa-suggests): reuse the existing AI pipeline (llmService), zero
 * new AI clients.
 *
 * Fail-soft: any error (LLM down, bad JSON, empty catalog) resolves to an
 * empty suggestions array — the caller falls back to manual tool selection,
 * never a 500.
 */

import logger from '../utils/Logger.js';
import KnownToolsService from './KnownToolsService.js';

export interface ToolSuggestion {
  toolType: string;
  name: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

const MAX_SUGGESTIONS = 3;

async function suggestViaLlm(
  problemDescription: string,
  lang: 'en' | 'pl'
): Promise<ToolSuggestion[]> {
  // Dynamic import so unit tests don't have to pull in the whole AI stack.
  const { llmService } = await import('./ai/llmService.js');
  const { z } = await import('zod');

  const { items } = await KnownToolsService.listKnownTools({ lang, limit: 50 });
  const catalog = items.filter((t) => t.isActive);
  if (catalog.length === 0) return [];

  const catalogList = catalog
    .map((t) => `- ${t.toolType}: "${t.name}" — ${t.description}`)
    .join('\n');

  const systemPrompt =
    lang === 'pl'
      ? 'Jesteś doradcą konsultingowym, który dobiera najlepiej pasujące narzędzie z katalogu do opisu problemu klienta. Odpowiedz WYŁĄCZNIE obiektem JSON zgodnym ze schematem.'
      : 'You are a consulting advisor matching the best-fitting tool from a catalog to a client problem description. Reply with ONLY a JSON object conforming to the schema.';

  const userPrompt =
    lang === 'pl'
      ? `Opis problemu klienta: "${problemDescription}"\n\n` +
        `Dostępne narzędzia:\n${catalogList}\n\n` +
        `Zwróć TOP ${MAX_SUGGESTIONS} najlepiej pasujących narzędzi (pole toolType musi być dokładnie jednym z identyfikatorów z listy powyżej), każde z 1-zdaniowym uzasadnieniem PO POLSKU. Jeśli nic nie pasuje sensownie, zwróć pustą listę.`
      : `Client problem description: "${problemDescription}"\n\n` +
        `Available tools:\n${catalogList}\n\n` +
        `Return the TOP ${MAX_SUGGESTIONS} best-matching tools (the toolType field must be exactly one of the identifiers listed above), each with a 1-sentence reasoning in English. If nothing fits reasonably, return an empty list.`;

  const LlmOutputSchema = z.object({
    suggestions: z
      .array(
        z.object({
          toolType: z.string(),
          confidence: z.enum(['high', 'medium', 'low']),
          reasoning: z.string(),
        })
      )
      .max(5),
  });

  const result = await (llmService as any).call({
    type: 'structured',
    modelConfig: { id: 'standard' },
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    schema: LlmOutputSchema,
    maxTokens: 500,
    temperature: 0.2,
    cache: false,
  });

  const obj = (result as any)?.object;
  const rawSuggestions: Array<{ toolType: string; confidence: string; reasoning: string }> =
    Array.isArray(obj?.suggestions) ? obj.suggestions : [];

  // Guard: only ever surface tools that actually exist and are launchable —
  // never trust a hallucinated toolType from the LLM.
  const byType = new Map(catalog.map((t) => [t.toolType, t]));
  const resolved: ToolSuggestion[] = [];
  for (const s of rawSuggestions) {
    const tool = byType.get(String(s?.toolType || '').trim());
    if (!tool) continue;
    if (resolved.some((r) => r.toolType === tool.toolType)) continue; // de-dup
    resolved.push({
      toolType: tool.toolType,
      name: tool.name,
      confidence: (s.confidence as ToolSuggestion['confidence']) ?? 'low',
      reasoning: String(s.reasoning || '').trim(),
    });
    if (resolved.length >= MAX_SUGGESTIONS) break;
  }

  return resolved;
}

/**
 * Suggest up to 3 tools for a free-text problem description.
 * Never throws — resolves to [] on any failure (fail-soft per §64).
 */
export async function suggestTools(
  problemDescription: string,
  lang: 'en' | 'pl' = 'en'
): Promise<ToolSuggestion[]> {
  const trimmed = String(problemDescription || '').trim();
  if (!trimmed) return [];

  try {
    return await suggestViaLlm(trimmed, lang);
  } catch (err) {
    logger.warn('[toolSuggestService] LLM suggest failed, returning empty list', { err });
    return [];
  }
}
